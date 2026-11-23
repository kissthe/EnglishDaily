'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {ArrowLeft,ArrowRight,BookMarked,Check,Eye,EyeOff,Sparkles} from 'lucide-react';
import {AnnotationProvider,captureSelection,useAnnotations} from './annotations-ui';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {findSentence,findWord,practiceKey,type CRParagraph,type CRProgress} from '@/lib/close-reading';
import type {Submission,Task} from '@/lib/course';

type Props={task:Task;sample:boolean;initial?:Submission;onClose:()=>void;onRefresh:()=>Promise<void>;page?:boolean;userId?:string};
type Focus={kind:'word'|'sentence';index:number}|null;
async function request(body?:unknown,task?:string){const r=await fetch('/api/close-reading'+(task?'?task='+encodeURIComponent(task):''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'精读记录暂时无法保存');return d}

// 段落正文：重点句加底色，重点词加下划线，学生的划线显示为标记；选中文字可划线、批注和翻译。
function ParagraphText({p,index,onFocus}:{p:CRParagraph;index:number;onFocus:(f:Focus)=>void}){
 const ref=useRef<HTMLSpanElement>(null),ctx=useAnnotations(),section='para:'+index,timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const on=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{if(ref.current)captureSelection(ref.current,section,ctx.choose)},180)};document.addEventListener('selectionchange',on);return ()=>{document.removeEventListener('selectionchange',on);if(timer.current)clearTimeout(timer.current)}},[section,ctx.choose]);
 const text=p.text,sentences=p.sentences.map((s,i)=>({...findSentence(text,s.text),i})).filter(r=>r.start!==undefined) as {start:number;end:number;i:number}[];
 const words=p.words.map((w,i)=>({...findWord(text,w.word),i})).filter(r=>r.start!==undefined) as {start:number;end:number;i:number}[];
 const marks=ctx.rows.filter(a=>a.section===section&&text.slice(a.start,a.end)===a.text);
 const points=[...new Set([0,text.length,...sentences.flatMap(r=>[r.start,r.end]),...words.flatMap(r=>[r.start,r.end]),...marks.flatMap(a=>[a.start,a.end])])].sort((a,b)=>a-b);
 return <span ref={ref} className="selectable-text cr-text" onMouseUp={()=>{if(ref.current)captureSelection(ref.current,section,ctx.choose)}}>{points.slice(0,-1).map((start,k)=>{
  const end=points[k+1],part=text.slice(start,end),s=sentences.find(r=>r.start<=start&&r.end>=end),w=words.find(r=>r.start<=start&&r.end>=end),a=marks.find(r=>r.start<=start&&r.end>=end);
  let node:ReactNode=part;
  if(a)node=<mark className="study-underline" title={a.note||'点击编辑批注'} onClick={e=>{if(!document.getSelection()?.isCollapsed)return;e.stopPropagation();ctx.edit(a)}}>{node}</mark>;
  if(w)node=<span className="cr-word" role="button" tabIndex={0} onClick={e=>{if(!document.getSelection()?.isCollapsed)return;e.stopPropagation();onFocus({kind:'word',index:w.i})}} onKeyDown={e=>{if(e.key==='Enter')onFocus({kind:'word',index:w.i})}}>{node}</span>;
  return s?<span key={start} className="cr-sentence" data-sentence={s.i} onClick={()=>{if(document.getSelection()?.isCollapsed)onFocus({kind:'sentence',index:s.i})}}>{node}</span>:<span key={start}>{node}</span>;
 })}</span>;
}

function Collect({task,section,text,start,end,kind,note,sample}:{task:string;section:string;text:string;start:number;end:number;kind:'word'|'sentence';note:string;sample:boolean}){
 const ctx=useAnnotations(),[busy,setBusy]=useState(false),saved=ctx.rows.some(a=>a.section===section&&a.start===start&&a.end===end&&a.kind===kind);
 if(sample)return null;
 return <button type="button" className={'cr-collect'+(saved?' saved':'')} disabled={busy||saved} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/annotations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'save',task,section,start,end,text,kind,note})}),d=await r.json();if(!r.ok)throw Error(d.error||'收藏失败');await ctx.reload();toast.success('已加入单词本')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{saved?<><Check size={15}/>已收藏</>:<><BookMarked size={15}/>收藏</>}</button>;
}

export function CloseReadingPractice(props:Props){
 const {task,sample,onClose,onRefresh,page}=props,m=task.material,cr=m.closeReading!,paras=cr.paragraphs,realTask=!task.id.startsWith('preview-');
 const [progress,setProgress]=useState<CRProgress|null>(null),[cur,setCur]=useState(0),[answers,setAnswers]=useState<Record<string,string>>({}),[status,setStatus]=useState(sample?'老师预览 · 不保存':'自动保存'),[focus,setFocus]=useState<Focus>(null),[shown,setShown]=useState<Set<string>>(new Set()),[full,setFull]=useState(false),[finishing,setFinishing]=useState(false),[done,setDone]=useState<string|null>(null),[comments,setComments]=useState<Record<string,string>>({});
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef<Record<string,string>>({}),panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(!realTask)return;request(undefined,task.id).then(d=>{const p=d.progress as CRProgress|null;if(!p)return;setProgress(p);setAnswers(p.answers);setComments(p.comments);setCur(Math.min(p.paragraph,paras.length-1))}).catch(e=>setStatus(e.message))},[task.id]);
 // 仿写停笔 1 秒后保存；切换段落时立即保存当前位置。
 function save(paragraph=cur,immediate=false){if(sample||!realTask)return;if(timer.current)clearTimeout(timer.current);const run=async()=>{const batch=pending.current;pending.current={};setStatus('正在保存…');try{const d=await request({op:'save',task:task.id,paragraph,answers:batch});setProgress(d.progress);setStatus('已保存')}catch(e){pending.current={...batch,...pending.current};setStatus((e as Error).message)}};if(immediate)void run();else timer.current=setTimeout(run,1000)}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 function go(i:number){const next=Math.max(0,Math.min(paras.length-1,i));setCur(next);setFocus(null);save(next,true);window.scrollTo({top:0,behavior:'smooth'})}
 function write(key:string,value:string){setAnswers(a=>({...a,[key]:value}));pending.current[key]=value;setStatus('正在输入…');save(cur)}
 const toggle=(k:string)=>setShown(s=>{const n=new Set(s);if(n.has(k))n.delete(k);else n.add(k);return n});
 useEffect(()=>{if(!focus)return;const el=panel.current?.querySelector(`[data-focus="${focus.kind}-${focus.index}"]`);el?.scrollIntoView({block:'nearest',behavior:'smooth'});el?.classList.add('cr-flash');const t=setTimeout(()=>el?.classList.remove('cr-flash'),1200);return ()=>clearTimeout(t)},[focus]);
 async function finish(){setFinishing(true);try{if(timer.current){clearTimeout(timer.current);timer.current=null}if(Object.keys(pending.current).length){await request({op:'save',task:task.id,paragraph:cur,answers:pending.current});pending.current={}}const d=await request({op:'finish',task:task.id});setProgress(d.progress);setDone(d.card);await onRefresh()}catch(e){toast.error((e as Error).message)}finally{setFinishing(false)}}
 async function comment(key:string){try{const d=await request({op:'comment',task:task.id,key,text:comments[key]||''});setProgress(d.progress);toast.success('点评已保存')}catch(e){toast.error((e as Error).message)}}
 const p=paras[cur],last=cur===paras.length-1;
 const content=<div className="reading-workspace close-reading"><AnnotationProvider task={task.id} sample={sample||!realTask} compact translationEnabled={!sample&&realTask}>
  <header className="cr-topbar"><button className="reader-back" onClick={onClose}><ArrowLeft size={18}/>{sample?'返回':'返回作业'}</button><nav className="cr-dots" aria-label="段落">{paras.map((_,i)=><button key={i} className={(i===cur?'active ':'')+(i<cur?'past':'')} aria-current={i===cur?'step':undefined} aria-label={`第 ${i+1} 段`} onClick={()=>go(i)}>{i+1}</button>)}</nav><span className="cr-status" role="status">{progress?.finished&&!sample?'已完成 · ':''}{status}</span></header>
  <div className={'cr-layout'+(full?' full':'')}>
   <article className="cr-article">
    <span className="tag purple">精读 · {m.level||'中考阅读'}</span><h1>{m.title}</h1>{m.subtitle&&<p className="cr-subtitle">{m.subtitle}</p>}
    <button className="cr-full-toggle" onClick={()=>setFull(!full)}>{full?'只看当前段':'显示全文'}</button>
    {paras.map((q,i)=><section key={i} className={'cr-para'+(i===cur?' current':'')} onClick={()=>{if(i!==cur&&document.getSelection()?.isCollapsed)go(i)}}><span className="cr-para-no">{i+1}</span><p lang="en"><ParagraphText p={q} index={i} onFocus={f=>{if(i!==cur)go(i);setFocus(f)}}/></p></section>)}
    <details className="reader-source"><summary>材料来源</summary><p>{m.source||'教师提供'} · {m.rights}</p></details>
   </article>
   <aside ref={panel} className="cr-panel" aria-label={`第 ${cur+1} 段学习`}>
    <div className="cr-panel-head"><span>PARAGRAPH {cur+1} / {paras.length}</span><h2>第 {cur+1} 段</h2></div>
    {p.words.length>0&&<section className="cr-block"><h3>重点单词</h3><div className="cr-words">{p.words.map((w,i)=>{const r=findWord(p.text,w.word);return <div key={i} className={'cr-word-card'+(focus?.kind==='word'&&focus.index===i?' focused':'')} data-focus={'word-'+i}><div><b lang="en">{w.word}</b>{w.phonetic&&<span className="cr-phonetic">{w.phonetic}</span>}</div>{w.meaning&&<p>{w.meaning}</p>}{w.usage&&<p className="cr-usage" lang="en">{w.usage}</p>}{r&&<Collect task={task.id} section={'para:'+cur} text={p.text.slice(r.start,r.end)} start={r.start} end={r.end} kind="word" note={[w.meaning,w.usage].filter(Boolean).join('\n')} sample={sample||!realTask}/>}</div>})}</div></section>}
    {p.sentences.length>0&&<section className="cr-block"><h3>重点句子</h3>{p.sentences.map((s,i)=>{const r=findSentence(p.text,s.text),k=`s${cur}-${i}`;return <div key={i} className={'cr-sentence-card'+(focus?.kind==='sentence'&&focus.index===i?' focused':'')} data-focus={'sentence-'+i}><blockquote lang="en">{s.text}</blockquote>
     {s.grammar&&<><button className="cr-reveal" onClick={()=>toggle(k+'g')}>{shown.has(k+'g')?<EyeOff size={15}/>:<Eye size={15}/>}语法分析</button>{shown.has(k+'g')&&<p className="cr-grammar">{s.grammar}</p>}</>}
     {s.translation&&<><button className="cr-reveal" onClick={()=>toggle(k+'t')}>{shown.has(k+'t')?<EyeOff size={15}/>:<Eye size={15}/>}翻译</button>{shown.has(k+'t')&&<p className="cr-translation">{s.translation}</p>}</>}
     {r&&<Collect task={task.id} section={'para:'+cur} text={s.text} start={r.start} end={r.end} kind="sentence" note={[s.translation,s.grammar].filter(Boolean).join('\n')} sample={sample||!realTask}/>}</div>})}</section>}
    {p.practice.length>0&&<section className="cr-block"><h3>仿写</h3>{p.practice.map((q,i)=>{const key=practiceKey(cur,i),k=`e${key}`,answer=answers[key]||'',saved=progress?.comments[key];return <div key={i} className="cr-practice"><div className="cr-practice-head"><span className="tag">{q.type==='word'?'用词造句':'仿写句型'}</span>{q.target&&<b lang="en">{q.target}</b>}</div><p>{q.prompt}</p>
     <textarea lang="en" rows={3} maxLength={2000} value={answer} readOnly={sample} placeholder={sample?(realTask?'学生还没有写':'学生在这里写仿写句'):'写下你的句子…'} onChange={e=>write(key,e.target.value)}/>
     {q.example&&<><button className="cr-reveal" onClick={()=>toggle(k)}>{shown.has(k)?<EyeOff size={15}/>:<Eye size={15}/>}参考仿写</button>{shown.has(k)&&<p className="cr-example" lang="en">{q.example}</p>}</>}
     {sample&&realTask?<div className="cr-comment-edit"><input value={comments[key]||''} maxLength={1000} placeholder="给学生的点评（可选）" onChange={e=>setComments(c=>({...c,[key]:e.target.value}))}/><button className="btn secondary" onClick={()=>comment(key)}>保存点评</button></div>:saved&&<p className="cr-teacher-comment"><b>老师点评：</b>{saved}</p>}</div>})}</section>}
    {!p.words.length&&!p.sentences.length&&!p.practice.length&&<p className="helper">这一段没有标注，读懂大意即可。选中文字可以划线、批注或翻译。</p>}
    <div className="cr-nav"><button className="btn secondary" disabled={cur===0} onClick={()=>go(cur-1)}><ArrowLeft size={16}/>上一段</button>{!last?<button className="btn" onClick={()=>go(cur+1)}>下一段<ArrowRight size={16}/></button>:sample?<span className="helper">学生读完最后一段后生成学习卡片</span>:<button className="btn" disabled={finishing} onClick={finish}><Sparkles size={16}/>{finishing?'正在生成…':progress?.finished?'再次完成并打开卡片':'完成精读，生成学习卡片'}</button>}</div>
   </aside>
  </div>
 </AnnotationProvider>
 <Dialog open={!!done} onOpenChange={v=>{if(!v)setDone(null)}}><DialogContent className="medium-dialog cr-done"><DialogTitle>学习卡片已生成 🎉</DialogTitle><DialogDescription>本篇的重点单词、重点句子、你收藏的内容和仿写都整理好了，可以继续修改，也可以打印或导出 Word。</DialogDescription><div className="dialog-actions"><button className="btn secondary" onClick={()=>setDone(null)}>继续看文章</button><a className="btn" href={'/?view=cards&card='+encodeURIComponent(done||'')}>查看学习卡片 →</a></div></DialogContent></Dialog>
 </div>;
 return page?content:<Dialog open onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="reader-preview"><DialogTitle className="sr-only">精读预览</DialogTitle><DialogDescription className="sr-only">逐段阅读，查看重点词、重点句和仿写。</DialogDescription>{content}</DialogContent></Dialog>;
}
