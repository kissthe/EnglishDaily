import {AlignmentType,BorderStyle,Document,Footer,Packer,PageNumber,Paragraph,TextRun} from 'docx';
import {db,ApiError} from './storage';
import {normalizeMaterial,today,type Material} from './course';
import {buildCard,cardDataSchema,cardTypeLabels,type CRProgress,type CardData,type StudyCard} from './close-reading';
import {escapeHtml} from './annotations';

// 读取学生可见的精读作业（已到开放日期）。
export async function closeReadingTask(task:string){
 const row=await db().prepare('SELECT id,material FROM tasks WHERE id=? AND date<=?').bind(task,today()).first();
 const m=row?normalizeMaterial(JSON.parse(row.material)) as Material:null;
 if(!m||m.kind!=='精读'||!m.closeReading)throw new ApiError('精读文章不存在或尚未开放',404);
 return m;
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
const toCard=(r:any):StudyCard=>({id:r.id,task:r.task,data:JSON.parse(r.data),created:r.created,updated:r.updated});
export async function listCards(student:string):Promise<StudyCard[]>{return (await db().prepare('SELECT * FROM study_cards WHERE student=? ORDER BY updated DESC,id').bind(student).all()).results.map(toCard)}
export async function getCard(student:string,id:string){const r=await db().prepare('SELECT * FROM study_cards WHERE id=? AND student=?').bind(id,student).first();if(!r)throw new ApiError('学习卡片不存在',404);return toCard(r)}

// 每篇精读一张卡片；replace=true 时按最新内容重新生成（会覆盖学生对卡片的修改）。
export async function generateCard(student:string,task:string,replace=false){
 const m=await closeReadingTask(task),existing=await db().prepare('SELECT id FROM study_cards WHERE student=? AND task=?').bind(student,task).first();
 if(existing&&!replace)return existing.id as string;
 const annotations=(await db().prepare("SELECT kind,text,note FROM annotations WHERE student=? AND task=? AND kind IN ('word','sentence') ORDER BY start").bind(student,task).all()).results as {kind:string;text:string;note:string}[];
 const data=cardDataSchema.parse(buildCard(m.title,m.source||'',m.closeReading!,await readProgress(student,task),annotations,()=>crypto.randomUUID().slice(0,8)));
 const now=new Date().toISOString(),id=existing?.id||crypto.randomUUID();
 await db().prepare('INSERT INTO study_cards(id,student,task,data,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(student,task) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(id,student,task,JSON.stringify(data),now,now).run();
 return id;
}

// ---------- 打印与导出 ----------
const colors:Record<CardData['theme'],[string,string]>={violet:['#5346eb','#eeecff'],ocean:['#0369a1','#e0f2fe'],forest:['#15803d','#dcfce7'],sunset:['#c2410c','#ffedd5'],rose:['#be185d','#fce7f3'],slate:['#334155','#e2e8f0']};
const groups=(d:CardData)=>(['word','sentence','practice','note'] as const).map(type=>({type,items:d.items.filter(i=>i.type===type)})).filter(g=>g.items.length);
const lines=(s:string)=>escapeHtml(s).replace(/\n/g,'<br>');
export function cardsDocument(cards:StudyCard[],owner:string){
 const body=cards.map(c=>{const [ink,soft]=colors[c.data.theme]||colors.violet;return `<section class="card" style="--ink:${ink};--soft:${soft}"><header><span>ENGLISH DAILY · 精读学习卡片</span><h1>${escapeHtml(c.data.title)}</h1><p>${escapeHtml([c.data.subtitle,owner,c.updated.slice(0,10)].filter(Boolean).join(' · '))}</p></header>${groups(c.data).map(g=>`<h2>${cardTypeLabels[g.type]}<small>${g.items.length}</small></h2>${g.type==='word'?`<div class="words">${g.items.map(i=>`<div class="word"><b>${escapeHtml(i.text)}</b>${i.meaning?`<span>${lines(i.meaning)}</span>`:''}${i.note?`<em>${lines(i.note)}</em>`:''}</div>`).join('')}</div>`:g.items.map(i=>`<div class="item ${g.type}"><p class="en">${lines(i.text)}</p>${i.meaning?`<p class="zh">${lines(i.meaning)}</p>`:''}${i.note?`<p class="note">${lines(i.note)}</p>`:''}</div>`).join('')}`).join('')}</section>`}).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>精读学习卡片</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:14px/1.7 Arial,"PingFang SC","Microsoft YaHei",sans-serif;color:#1c2435;max-width:860px;margin:24px auto;padding:0 16px;background:#f6f5f1}.controls{padding:12px;background:#fff;border:1px solid #ddd;border-radius:10px;margin-bottom:16px}button{padding:9px 16px;font-size:14px;cursor:pointer}.card{background:#fff;border:1px solid #dcdfe7;border-radius:18px;overflow:hidden;margin-bottom:24px;break-after:page}.card:last-child{break-after:auto}header{background:var(--ink);color:#fff;padding:22px 26px}header span{font-size:11px;letter-spacing:.14em;opacity:.8}header h1{font:700 26px/1.25 Georgia,"Songti SC",serif;margin:6px 0}header p{margin:0;opacity:.85;font-size:12px}h2{margin:18px 26px 8px;font-size:15px;color:var(--ink);border-bottom:2px solid var(--soft);padding-bottom:4px}h2 small{margin-left:8px;color:#8a90a0;font-weight:400}.words{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:0 26px}.word{border:1px solid #e3e6ee;border-left:4px solid var(--ink);border-radius:8px;padding:8px 12px;break-inside:avoid}.word b{display:block;font:700 17px Georgia,serif}.word span{display:block}.word em{display:block;color:#5b6475;font-size:12.5px;font-style:normal}.item{margin:0 26px 10px;padding:10px 14px;background:var(--soft);border-radius:10px;break-inside:avoid}.en{font:16px/1.7 Georgia,serif;margin:0}.zh{margin:4px 0 0}.note{margin:4px 0 0;color:#4b5363;font-size:13px}.card>*:last-child{margin-bottom:22px}@media print{body{background:#fff;margin:0;padding:0}.controls{display:none}.card{border:0;border-radius:0}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.item,.word{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="controls"><button id="print">打印 / 另存为 PDF</button> <span>A4 排版，每篇文章一页起</span></div>${body||'<p>还没有学习卡片。</p>'}<script>document.getElementById('print').addEventListener('click',()=>window.print())</script></body></html>`;
}

const font={ascii:'Times New Roman',hAnsi:'Times New Roman',eastAsia:'Microsoft YaHei'};
const run=(text:string,o:Record<string,unknown>={})=>new TextRun({text,font,size:22,color:'1C2435',...o});
const para=(text:string,o:Record<string,unknown>={},p:Record<string,unknown>={})=>text.split('\n').map(t=>new Paragraph({spacing:{after:40},...p,children:[run(t,o)]}));
export async function cardsDocx(cards:StudyCard[],owner:string){
 const children:Paragraph[]=[];
 cards.forEach((c,ci)=>{
  const accent=(colors[c.data.theme]||colors.violet)[0].slice(1).toUpperCase();
  children.push(new Paragraph({pageBreakBefore:ci>0,spacing:{after:40},children:[run('ENGLISH DAILY · 精读学习卡片',{size:18,color:'6B7588',characterSpacing:40})]}),
   new Paragraph({spacing:{after:60},children:[run(c.data.title,{size:40,bold:true})]}),
   new Paragraph({spacing:{after:200},border:{bottom:{style:BorderStyle.SINGLE,size:12,color:accent,space:8}},children:[run([c.data.subtitle,owner,c.updated.slice(0,10)].filter(Boolean).join(' · '),{size:20,color:'6B7588'})]}));
  for(const g of groups(c.data)){
   children.push(new Paragraph({spacing:{before:240,after:100},children:[run(`${cardTypeLabels[g.type]}（${g.items.length}）`,{size:28,bold:true,color:accent})]}));
   g.items.forEach((i,n)=>{
    children.push(new Paragraph({keepNext:true,spacing:{before:120,after:40},indent:{left:200},border:{left:{style:BorderStyle.SINGLE,size:18,color:accent,space:8}},children:[run(`${n+1}. `,{bold:true,color:accent}),run(i.text,{size:g.type==='word'?26:24,bold:g.type==='word'})]}));
    if(i.meaning)children.push(...para(i.meaning,{},{indent:{left:200},keepNext:!!i.note}));
    if(i.note)children.push(...para(i.note,{size:20,color:'4B5363'},{indent:{left:200}}));
   });
  }
 });
 if(!cards.length)children.push(new Paragraph({children:[run('还没有学习卡片。')]}));
 const doc=new Document({creator:'English Daily',title:'精读学习卡片',styles:{default:{document:{run:{font,size:22}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1000,right:1000}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run('English Daily 学习卡片 · 第 ',{size:18,color:'6B7588'}),new TextRun({children:[PageNumber.CURRENT],size:18,color:'6B7588',font}),run(' 页',{size:18,color:'6B7588'})]})]})},children}]});
 return Packer.toBuffer(doc);
}
