import {AlignmentType,BorderStyle,Document,Footer,Packer,PageNumber,Paragraph,TabStopType,TextRun} from 'docx';
import {db,ApiError} from './storage';
import {normalizeMaterial,today,type Material} from './course';
import {buildCard,cardDataSchema,cardTypeLabels,type CRProgress,type CardData,type CardItem,type ReadingSummary,type StudyCard} from './close-reading';
import {escapeHtml} from './annotations';

// 精读文章以“作业”记录保存（划线、翻译、单词本都依赖它），但只在“精读”页面中显示。
const parse=(r:any)=>({id:r.id as string,date:r.date as string,created:r.created as string,m:normalizeMaterial(JSON.parse(r.material)) as Material});
export async function closeReadingTask(task:string,allowArchived=true){
 const row=await db().prepare('SELECT id,material FROM tasks WHERE id=? AND date<=?').bind(task,today()).first();
 const m=row?normalizeMaterial(JSON.parse(row.material)) as Material:null;
 if(!m||m.kind!=='精读'||!m.closeReading||(!allowArchived&&m.archived))throw new ApiError('精读文章不存在或尚未开放',404);
 return m;
}
export async function listArticles(student:string|undefined,teacher:boolean):Promise<ReadingSummary[]>{
 const rows=(await db().prepare(`SELECT id,date,created,material FROM tasks WHERE json_extract(material,'$.kind')='精读'${teacher?'':' AND date<=?'} ORDER BY date DESC,created DESC`).bind(...(teacher?[]:[today()])).all()).results.map(parse) as {id:string;date:string;created:string;m:Material}[];
 const progress=new Map<string,any>(student?(await db().prepare('SELECT task,data FROM close_reading WHERE student=?').bind(student).all()).results.map((r:any)=>[r.task,JSON.parse(r.data)]):[]);
 const cards=new Map<string,string>(student?(await db().prepare('SELECT task,id FROM study_cards WHERE student=?').bind(student).all()).results.map((r:any)=>[r.task,r.id]):[]);
 return rows.flatMap(({id,date,m})=>{
  const p=progress.get(id),cr=m.closeReading!,status=p?.finished?'已读' as const:p?'在读' as const:'未开始' as const;
  if(m.archived&&(teacher||status!=='已读'))return [];
  return [{id,title:m.title,subtitle:m.subtitle||'',source:m.source||'',date,paragraphs:cr.paragraphs.length,words:cr.paragraphs.reduce((n,x)=>n+x.words.length,0),sentences:cr.paragraphs.reduce((n,x)=>n+x.sentences.length,0),status,card:cards.get(id)||null,archived:!!m.archived}];
 });
}
export async function readProgress(student:string,task:string):Promise<CRProgress>{
 const row=await db().prepare('SELECT data,updated FROM close_reading WHERE student=? AND task=?').bind(student,task).first();
 const d=row?JSON.parse(row.data):{};
 return {paragraph:d.paragraph||0,answers:d.answers||{},comments:d.comments||{},finished:d.finished||null,...(row?{updated:row.updated}:{})};
}
export function writeProgress(student:string,task:string,p:CRProgress,now:string){
 const {updated,...data}=p;void updated;
 return db().prepare('INSERT INTO close_reading(student,task,data,updated) VALUES(?,?,?,?) ON CONFLICT(student,task) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(student,task,JSON.stringify(data),now);
}
const toCard=(r:any):StudyCard=>({id:r.id,task:r.task,data:cardDataSchema.parse(JSON.parse(r.data)),created:r.created,updated:r.updated});
export async function listCards(student:string):Promise<StudyCard[]>{return (await db().prepare('SELECT * FROM study_cards WHERE student=? ORDER BY updated DESC,id').bind(student).all()).results.map(toCard)}
export async function getCard(student:string,id:string){const r=await db().prepare('SELECT * FROM study_cards WHERE id=? AND student=?').bind(id,student).first();if(!r)throw new ApiError('学习卡片不存在',404);return toCard(r)}
export function saveCardData(student:string,id:string,data:CardData){return db().prepare('UPDATE study_cards SET data=?,updated=? WHERE id=? AND student=?').bind(JSON.stringify(data),new Date().toISOString(),id,student).run()}
// 背诵抄写由老师标记：学生保存卡片时沿用原有标记，不能自行修改。
export function keepRecite(old:CardData,next:CardData):CardData{const marked=new Set(old.items.filter(i=>i.recite).map(i=>i.id));return {...next,items:next.items.map(i=>({...i,recite:marked.has(i.id)}))}}

// 每篇精读一张卡片；replace=true 时按最新内容重新生成（老师的背诵抄写标记按内容保留）。
export async function generateCard(student:string,task:string,replace=false){
 const m=await closeReadingTask(task),existing=await db().prepare('SELECT id,data FROM study_cards WHERE student=? AND task=?').bind(student,task).first();
 if(existing&&!replace)return existing.id as string;
 const annotations=(await db().prepare("SELECT kind,text,note FROM annotations WHERE student=? AND task=? AND kind IN ('word','sentence') ORDER BY start").bind(student,task).all()).results as {kind:string;text:string;note:string}[];
 let data=cardDataSchema.parse(buildCard(m.title,m.source||'',m.closeReading!,await readProgress(student,task),annotations,()=>crypto.randomUUID().slice(0,8)));
 if(existing){const marked=new Set(cardDataSchema.parse(JSON.parse(existing.data)).items.filter(i=>i.recite).map(i=>i.type+':'+i.text.trim().toLowerCase()));data={...data,items:data.items.map(i=>({...i,recite:marked.has(i.type+':'+i.text.trim().toLowerCase())}))}}
 const now=new Date().toISOString(),id=existing?.id||crypto.randomUUID();
 await db().prepare('INSERT INTO study_cards(id,student,task,data,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(student,task) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(id,student,task,JSON.stringify(data),now,now).run();
 return id;
}

// ---------- 打印与导出：黑白、简洁，背诵抄写的内容单独列在最前面 ----------
const order=['word','sentence','practice','note'] as const;
const groups=(items:CardItem[])=>order.map(type=>({type,items:items.filter(i=>i.type===type)})).filter(g=>g.items.length);
const lines=(s:string)=>escapeHtml(s).replace(/\n/g,'<br>');
function itemHtml(i:CardItem,n:number){
 if(i.type==='word')return `<li class="w"><b>${escapeHtml(i.text)}</b>${i.meaning?`<span>${lines(i.meaning)}</span>`:''}${i.note?`<small>${lines(i.note)}</small>`:''}</li>`;
 return `<li><span class="n">${n}.</span><div><p class="en">${lines(i.text)}</p>${i.meaning?`<p>${lines(i.meaning)}</p>`:''}${i.note?`<p class="note">${lines(i.note)}</p>`:''}</div></li>`;
}
export function cardsDocument(cards:StudyCard[],owner:string){
 const body=cards.map(c=>{const recite=c.data.items.filter(i=>i.recite);return `<section class="card"><h1>${escapeHtml(c.data.title)}</h1><p class="meta">${escapeHtml([c.data.subtitle,owner,c.updated.slice(0,10)].filter(Boolean).join(' · '))}</p>${recite.length?`<h2>背诵抄写 <small>${recite.length}</small></h2><ol class="recite">${recite.map((i,n)=>`<li><span class="n">${n+1}.</span><div><p class="en">${lines(i.text)}</p>${i.meaning?`<p>${lines(i.meaning)}</p>`:''}<div class="copy"></div></div></li>`).join('')}</ol>`:''}${groups(c.data.items).map(g=>`<h2>${cardTypeLabels[g.type]} <small>${g.items.length}</small></h2><ol class="${g.type==='word'?'words':'list'}">${g.items.map((i,n)=>itemHtml(i,n+1)).join('')}</ol>`).join('')}</section>`}).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>精读学习卡片</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:13.5px/1.65 "PingFang SC","Microsoft YaHei",Arial,sans-serif;color:#111;max-width:820px;margin:24px auto;padding:0 18px}.controls{padding:10px 0;margin-bottom:12px;border-bottom:1px solid #ddd;font-size:13px;color:#555}button{padding:7px 14px;font-size:13px;cursor:pointer}.card{break-after:page}.card:last-child{break-after:auto}h1{font:700 22px/1.3 Georgia,"Songti SC",serif;margin:0}.meta{color:#666;margin:2px 0 6px;font-size:12px}h2{font-size:14px;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid #222}h2 small{font-weight:400;color:#777}ol{list-style:none;margin:0;padding:0}.words{columns:2;column-gap:28px}.w{break-inside:avoid;padding:3px 0;border-bottom:1px dotted #ccc}.w b{font:700 15px Georgia,serif;margin-right:8px}.w small{display:block;color:#666;font-size:12px}.list li,.recite li{display:flex;gap:6px;break-inside:avoid;padding:4px 0}.list li>div,.recite li>div{flex:1}.n{color:#777;min-width:20px}p{margin:0}.en{font:15px/1.6 Georgia,serif}.note{color:#666;font-size:12.5px}.copy{height:44px;margin-top:4px;background:repeating-linear-gradient(transparent 0 21px,#bbb 21px 22px)}@media print{body{margin:0;padding:0}.controls{display:none}}</style></head><body><div class="controls"><button id="print">打印 / 另存为 PDF</button> A4 · 每篇文章从新的一页开始</div>${body||'<p>还没有学习卡片。</p>'}<script>document.getElementById('print').addEventListener('click',()=>window.print())</script></body></html>`;
}

const font={ascii:'Times New Roman',hAnsi:'Times New Roman',eastAsia:'Microsoft YaHei'};
const run=(text:string,o:Record<string,unknown>={})=>new TextRun({text,font,size:21,color:'111111',...o});
const sub=(text:string,o:Record<string,unknown>={})=>text.split('\n').filter(Boolean).map(t=>new Paragraph({indent:{left:360},spacing:{after:20},children:[run(t,o)]}));
const heading=(text:string,count:number)=>new Paragraph({spacing:{before:260,after:100},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'222222',space:2}},children:[run(text,{bold:true,size:24}),run(`  ${count}`,{size:20,color:'777777'})]});
export async function cardsDocx(cards:StudyCard[],owner:string){
 const children:Paragraph[]=[];
 cards.forEach((c,ci)=>{
  children.push(new Paragraph({pageBreakBefore:ci>0,spacing:{after:40},children:[run(c.data.title,{size:34,bold:true})]}),new Paragraph({spacing:{after:120},children:[run([c.data.subtitle,owner,c.updated.slice(0,10)].filter(Boolean).join(' · '),{size:18,color:'666666'})]}));
  const recite=c.data.items.filter(i=>i.recite);
  if(recite.length){children.push(heading('背诵抄写',recite.length));recite.forEach((i,n)=>{children.push(new Paragraph({keepNext:true,spacing:{before:80,after:20},children:[run(`${n+1}. `,{color:'777777'}),run(i.text,{size:23})]}),...sub(i.meaning),...[0,1].map(()=>new Paragraph({indent:{left:360},spacing:{after:60},border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'BBBBBB',space:8}},children:[run(' ')]})))})}
  for(const g of groups(c.data.items)){
   children.push(heading(cardTypeLabels[g.type],g.items.length));
   g.items.forEach((i,n)=>{
    if(g.type==='word'){children.push(new Paragraph({keepLines:true,tabStops:[{type:TabStopType.LEFT,position:2600}],spacing:{after:30},children:[run(i.text,{bold:true,size:23}),run('\t'+(i.meaning||'').replace(/\n/g,' '))]}),...sub(i.note,{size:18,color:'666666'}));return}
    children.push(new Paragraph({keepNext:!!(i.meaning||i.note),spacing:{before:80,after:20},children:[run(`${n+1}. `,{color:'777777'}),run(i.text,{size:23})]}),...sub(i.meaning),...sub(i.note,{size:18,color:'666666'}));
   });
  }
 });
 if(!cards.length)children.push(new Paragraph({children:[run('还没有学习卡片。')]}));
 const doc=new Document({creator:'English Daily',title:'精读学习卡片',styles:{default:{document:{run:{font,size:21}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:900,bottom:900,left:1000,right:1000}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run('第 ',{size:16,color:'888888'}),new TextRun({children:[PageNumber.CURRENT],size:16,color:'888888',font}),run(' 页',{size:16,color:'888888'})]})]})},children}]});
 return Packer.toBuffer(doc);
}
