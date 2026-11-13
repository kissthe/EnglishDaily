import {AlignmentType,BorderStyle,Document,Footer,HeadingLevel,Packer,PageNumber,Paragraph,ShadingType,Table,TableCell,TableLayoutType,TableRow,TextRun,WidthType} from 'docx';
import {db} from './storage';
import type {Material} from './course';
import {normalizeEntry,sentenceAround,sourceLabels,type ExportOptions,type WordbookEntry,type WordbookKind,type WordbookSource} from './wordbook';

type Row={id:string;kind:WordbookKind;text:string;note:string;context:string;source_kind:WordbookSource;source_id:string;source_title:string;annotation:string|null;mastered:number;created:string;updated:string};
export function toEntry(r:Row):WordbookEntry{return {id:r.id,kind:r.kind,text:r.text,note:r.note,context:r.context,sourceKind:r.source_kind,sourceId:r.source_id,sourceTitle:r.source_title,mastered:!!r.mastered,fromAnnotation:!!r.annotation,created:r.created,updated:r.updated}}
export async function listEntries(student:string){return ((await db().prepare('SELECT * FROM wordbook WHERE student=? ORDER BY created DESC,id').bind(student).all()).results as Row[]).map(toEntry)}

export function upsertStatement(student:string,e:{kind:WordbookKind;text:string;note:string;context:string;sourceKind:WordbookSource;sourceId:string;sourceTitle:string;annotation?:string|null},now:string){
 return db().prepare(`INSERT INTO wordbook(id,student,kind,text,norm,note,context,source_kind,source_id,source_title,annotation,mastered,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,?)
  ON CONFLICT(student,kind,norm) DO UPDATE SET note=CASE WHEN excluded.note!='' THEN excluded.note ELSE wordbook.note END,context=CASE WHEN wordbook.context='' THEN excluded.context ELSE wordbook.context END,annotation=coalesce(wordbook.annotation,excluded.annotation),updated=excluded.updated`)
  .bind(crypto.randomUUID(),student,e.kind,e.text.trim(),normalizeEntry(e.text),e.note,e.context,e.sourceKind,e.sourceId,e.sourceTitle.slice(0,200),e.annotation??null,now,now);
}

function plain(html:string){return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"')}
// 作业划线收藏为单词/句子时，同步写入单词本（带原句）。
export async function syncAnnotation(student:string,a:{id:string;kind:string;text:string;note:string;section:string;start:number;end:number},task:string,m:Material,now:string){
 await db().prepare('DELETE FROM wordbook WHERE annotation=? AND student=?').bind(a.id,student).run();
 if(a.kind!=='word'&&a.kind!=='sentence')return;
 let context='';
 if(a.kind==='word'){
  let text='';if(a.section==='body')text=m.contentFormat==='html'?'':m.body;else if(a.section.startsWith('question:'))text=m.questions.find(q=>'question:'+q.id===a.section)?.prompt||'';
  if(text&&text.slice(a.start,a.end)===a.text)context=sentenceAround(text,a.start,a.end);
  else if(m.contentFormat==='html'){const t=plain(m.body).replace(/\s+/g,' '),i=t.indexOf(a.text);if(i>=0)context=sentenceAround(t,i,i+a.text.length)}
 }
 await upsertStatement(student,{kind:a.kind as WordbookKind,text:a.text,note:a.note,context:context===a.text?'':context,sourceKind:'task',sourceId:task,sourceTitle:m.title,annotation:a.id},now).run();
}
export {plain as htmlToText};

// ---------- Word 导出 ----------
const font={ascii:'Times New Roman',hAnsi:'Times New Roman',eastAsia:'Microsoft YaHei'};
const ink='1C2435',accent='5346EB',muted='6B7588',line='D9DCE5';
const run=(text:string,o:Record<string,unknown>={})=>new TextRun({text,font,size:22,color:ink,...o});
const cellBorder={style:BorderStyle.SINGLE,size:4,color:line};
const borders={top:cellBorder,bottom:cellBorder,left:cellBorder,right:cellBorder};
// A4 纸宽 11906 twip，左右边距各 1000，可用 9906。
const PAGE_WIDTH=9906,COLUMNS=[560,2150,3196,4000];
const dxa=(pct:number)=>COLUMNS[[6,22,32,40].indexOf(pct)]??Math.round(PAGE_WIDTH*pct/100);
function cell(children:Paragraph[],width:number,shade?:string){return new TableCell({children,width:{size:dxa(width),type:WidthType.DXA},borders,margins:{top:100,bottom:100,left:120,right:120},...(shade?{shading:{type:ShadingType.CLEAR,color:'auto',fill:shade}}:{})})}
const blank=(n=1)=>Array.from({length:n},()=>new Paragraph({children:[run(' ')],spacing:{after:120}}));
function heading(text:string,sub:string){return [new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:360,after:80},children:[run(text,{size:32,bold:true,color:accent})]}),new Paragraph({spacing:{after:200},children:[run(sub,{size:20,color:muted})]})]}

export async function wordbookDocx(entries:WordbookEntry[],o:ExportOptions,owner:string){
 const quiz=o.mode==='quiz',words=entries.filter(e=>e.kind==='word'),sentences=entries.filter(e=>e.kind==='sentence');
 const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(new Date());
 const children:(Paragraph|Table)[]=[
  new Paragraph({alignment:AlignmentType.LEFT,spacing:{after:60},children:[run('ENGLISH DAILY · WORD BOOK',{size:18,color:muted,characterSpacing:40})]}),
  new Paragraph({spacing:{after:80},children:[run(quiz?'单词本 · 默写练习':'我的英语单词本',{size:48,bold:true})]}),
  new Paragraph({spacing:{after:240},border:{bottom:{style:BorderStyle.SINGLE,size:12,color:accent,space:8}},children:[run(`${owner} · ${date} · 单词 ${words.length} 个 · 句子 ${sentences.length} 句`,{size:20,color:muted})]})
 ];
 if(quiz)children.push(new Paragraph({spacing:{after:200},children:[run('先遮住右侧答案，写出中文意思或用法；句子写出翻译，再对照单词本订正。',{size:20,color:muted,italics:true})]}));
 if(words.length&&o.kind!=='sentence'){
  children.push(...heading('单词 Words',quiz?'写出词义，并用它造一个句子。':'释义来自自己的批注；例句来自原文。'));
  const header=new TableRow({tableHeader:true,children:[cell([new Paragraph({children:[run('#',{bold:true,color:'FFFFFF'})]})],6,accent),cell([new Paragraph({children:[run('单词',{bold:true,color:'FFFFFF'})]})],22,accent),cell([new Paragraph({children:[run(quiz?'词义（自己写）':'释义 / 批注',{bold:true,color:'FFFFFF'})]})],32,accent),cell([new Paragraph({children:[run(quiz?'造句':'原文例句',{bold:true,color:'FFFFFF'})]})],40,accent)]});
  const rows=words.map((w,i)=>new TableRow({cantSplit:true,children:[
   cell([new Paragraph({children:[run(String(i+1),{color:muted})]})],6,i%2?'F7F6FF':undefined),
   cell([new Paragraph({children:[run(w.text,{bold:true,size:26})]})],22,i%2?'F7F6FF':undefined),
   cell(quiz?blank(2):(w.note||'—').split('\n').map(t=>new Paragraph({children:[run(t)]})),32,i%2?'F7F6FF':undefined),
   cell(quiz?blank(2):[new Paragraph({children:[run(w.context||'',{italics:true})]}),new Paragraph({children:[run(w.sourceTitle?`— ${sourceLabels[w.sourceKind]} · ${w.sourceTitle}`:'',{size:18,color:muted})]})],40,i%2?'F7F6FF':undefined)
  ]}));
  children.push(new Table({width:{size:PAGE_WIDTH,type:WidthType.DXA},columnWidths:COLUMNS,layout:TableLayoutType.FIXED,rows:[header,...rows]}));
 }
 if(sentences.length&&o.kind!=='word'){
  children.push(...heading('句子 Sentences',quiz?'读一读，写出中文意思或句子结构。':'好句积累：理解结构，试着仿写。'));
  sentences.forEach((s,i)=>{
   children.push(new Paragraph({keepNext:true,spacing:{before:200,after:80},indent:{left:240},border:{left:{style:BorderStyle.SINGLE,size:18,color:accent,space:10}},children:[run(`${i+1}. `,{bold:true,color:accent}),run(s.text,{size:24})]}));
   if(quiz)children.push(new Paragraph({keepNext:true,indent:{left:240},children:[run('理解 / 翻译：',{color:muted,size:20})]}),...blank(2));
   else{for(const t of (s.note||'').split('\n').filter(Boolean))children.push(new Paragraph({keepNext:true,indent:{left:240},spacing:{after:40},children:[run(t,{size:21})]}));
    children.push(new Paragraph({indent:{left:240},spacing:{after:120},children:[run(s.sourceTitle?`${sourceLabels[s.sourceKind]} · ${s.sourceTitle}`:'',{size:18,color:muted})]}))}
  });
 }
 if(!entries.length)children.push(new Paragraph({children:[run('单词本还是空的。在作业或知识拓展里选中单词，点击“收藏”。',{color:muted})]}));
 const doc=new Document({creator:'English Daily',title:'英语单词本',styles:{default:{document:{run:{font,size:22}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1000,right:1000}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run('English Daily 单词本 · 第 ',{size:18,color:muted}),new TextRun({children:[PageNumber.CURRENT],size:18,color:muted,font}),run(' 页',{size:18,color:muted})]})]})},children}]});
 return Packer.toBuffer(doc);
}
