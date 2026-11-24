'use client';
import {useEffect,useRef,useState,type KeyboardEvent,type MouseEvent,type ReactNode} from 'react';
import {Toaster,toast} from 'sonner';
import {ArrowLeft,BookMarked,Check,Eye,EyeOff,FileUp,MousePointerClick,Pencil,RotateCcw,Sparkles,Trash2,X} from 'lucide-react';
import {AnnotationProvider,captureSelection,useAnnotations} from './annotations-ui';
import {CloseReadingEditor} from './close-reading-editor';
import {StudyCards} from './study-cards';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {articleText,findSentence,findWord,practiceKey,type CRParagraph,type CRProgress,type CloseReading,type ReadingSummary} from '@/lib/close-reading';
import {sampleCloseReading} from '@/lib/close-reading-sample';
import type {Material} from '@/lib/course';

type Article={id:string;title:string;subtitle:string;source:string;closeReading:CloseReading;archived:boolean};
type Pick={kind:'word'|'sentence';para:number;index:number}|null;
async function request(body?:unknown,query=''){const r=await fetch('/api/close-reading'+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'精读暂时无法加载');return d}

// 段落正文：重点句加底色、重点词加下划线，学生的划线显示为标记；选中文字可划线、批注和翻译。
function ParagraphText({p,index,picked,onPick}:{p:CRParagraph;index:number;picked:Pick;onPick:(f:Pick)=>void}){
 const ref=useRef<HTMLSpanElement>(null),ctx=useAnnotations(),section='para:'+index,timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const on=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{if(ref.current)captureSelection(ref.current,section,ctx.choose)},180)};document.addEventListener('selectionchange',on);return ()=>{document.removeEventListener('selectionchange',on);if(timer.current)clearTimeout(timer.current)}},[section,ctx.choose]);
 const text=p.text,sentences=p.sentences.map((s,i)=>({...findSentence(text,s.text),i})).filter(r=>r.start!==undefined) as {start:number;end:number;i:number}[];
 const words=p.words.map((w,i)=>({...findWord(text,w.word),i})).filter(r=>r.start!==undefined) as {start:number;end:number;i:number}[];
 const marks=ctx.rows.filter(a=>a.section===section&&text.slice(a.start,a.end)===a.text);
 const points=[...new Set([0,text.length,...sentences.flatMap(r=>[r.start,r.end]),...words.flatMap(r=>[r.start,r.end]),...marks.flatMap(a=>[a.start,a.end])])].sort((a,b)=>a-b);
 const click=(f:NonNullable<Pick>)=>(e:MouseEvent|KeyboardEvent)=>{if(!document.getSelection()?.isCollapsed)return;e.stopPropagation();onPick(f)};
 const is=(k:'word'|'sentence',i:number)=>picked?.kind===k&&picked.para===index&&picked.index===i;
 return <span ref={ref} className="selectable-text cr-text" onMouseUp={()=>{if(ref.current)captureSelection(ref.current,section,ctx.choose)}}>{points.slice(0,-1).map((start,k)=>{
  const end=points[k+1],part=text.slice(start,end),s=sentences.find(r=>r.start<=start&&r.end>=end),w=words.find(r=>r.start<=start&&r.end>=end),a=marks.find(r=>r.start<=start&&r.end>=end);
  let node:ReactNode=part;
  if(a)node=<mark className="study-underline" title={a.note||'点击编辑批注'} onClick={e=>{if(!document.getSelection()?.isCollapsed)return;e.stopPropagation();ctx.edit(a)}}>{node}</mark>;
  if(w)node=<span className={'cr-word'+(is('word',w.i)?' picked':'')} role="button" tabIndex={0} onClick={click({kind:'word',para:index,index:w.i})} onKeyDown={e=>{if(e.key==='Enter')click({kind:'word',para:index,index:w.i})(e)}}>{node}</span>;
  return s?<span key={start} className={'cr-sentence'+(is('sentence',s.i)?' picked':'')} onClick={click({kind:'sentence',para:index,index:s.i})}>{node}</span>:<span key={start}>{node}</span>;
 })}</span>;
}

function Collect({task,section,text,start,end,kind,note,disabled}:{task:string;section:string;text:string;start:number;end:number;kind:'word'|'sentence';note:string;disabled:boolean}){
 const ctx=useAnnotations(),[busy,setBusy]=useState(false),saved=ctx.rows.some(a=>a.section===section&&a.start===start&&a.end===end&&a.kind===kind);
 if(disabled)return null;
 return <button type="button" className={'cr-collect'+(saved?' saved':'')} disabled={busy||saved} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/annotations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'save',task,section,start,end,text,kind,note})}),d=await r.json();if(!r.ok)throw Error(d.error||'收藏失败');await ctx.reload();toast.success('已加入单词本')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{saved?<><Check size={15}/>已收藏</>:<><BookMarked size={15}/>收藏到单词本</>}</button>;
}

function Detail({a,picked,task,student,onClose}:{a:Article;picked:NonNullable<Pick>;task:string;student:boolean;onClose:()=>void}){
 const [show,setShow]=useState<Set<string>>(new Set()),p=a.closeReading.paragraphs[picked.para],toggle=(k:string)=>setShow(s=>{const n=new Set(s);if(n.has(k))n.delete(k);else n.add(k);return n});
 useEffect(()=>setShow(new Set()),[picked]);
 const head=<div className="cr-detail-head"><span>第 {picked.para+1} 段 · {picked.kind==='word'?'重点单词':'重点句子'}</span><button aria-label="关闭讲解" onClick={onClose}><X size={18}/></button></div>;
 if(picked.kind==='word'){const w=p.words[picked.index],r=findWord(p.text,w.word);return <div className="cr-detail">{head}<h3 lang="en">{w.word}{w.phonetic&&<span className="cr-phonetic">{w.phonetic}</span>}</h3>{w.meaning&&<p className="cr-meaning">{w.meaning}</p>}{w.usage&&<p className="cr-usage" lang="en">{w.usage}</p>}{r&&<Collect task={task} section={'para:'+picked.para} text={p.text.slice(r.start,r.end)} start={r.start} end={r.end} kind="word" note={[w.meaning,w.usage].filter(Boolean).join('\n')} disabled={!student}/>}</div>}
 const s=p.sentences[picked.index],r=findSentence(p.text,s.text);
 return <div className="cr-detail">{head}<blockquote lang="en">{s.text}</blockquote>
  {s.grammar&&<><button className="cr-reveal" onClick={()=>toggle('g')}>{show.has('g')?<EyeOff size={15}/>:<Eye size={15}/>}语法分析</button>{show.has('g')&&<p className="cr-grammar">{s.grammar}</p>}</>}
  {s.translation&&<><button className="cr-reveal" onClick={()=>toggle('t')}>{show.has('t')?<EyeOff size={15}/>:<Eye size={15}/>}翻译</button>{show.has('t')&&<p className="cr-translation">{s.translation}</p>}</>}
  {r&&<Collect task={task} section={'para:'+picked.para} text={s.text} start={r.start} end={r.end} kind="sentence" note={[s.translation,s.grammar].filter(Boolean).join('\n')} disabled={!student}/>}</div>;
}

// 精读阅读页：整篇文章滑动阅读；点击标注的词句后，右侧（手机为底部）才显示讲解；文末是仿写练习。
export function CloseReadingReader({id}:{id:string}){
 const [a,setA]=useState<Article|null>(null),[role,setRole]=useState<'teacher'|'student'>('student'),[error,setError]=useState(''),[progress,setProgress]=useState<CRProgress|null>(null),[answers,setAnswers]=useState<Record<string,string>>({}),[comments,setComments]=useState<Record<string,string>>({}),[status,setStatus]=useState(''),[picked,setPicked]=useState<Pick>(null),[shown,setShown]=useState<Set<string>>(new Set()),[finishing,setFinishing]=useState(false),[done,setDone]=useState<string|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef<Record<string,string>>({}),student=role==='student';
 useEffect(()=>{request(undefined,'?id='+encodeURIComponent(id)).then(d=>{setA(d.article);setRole(d.role);if(d.progress){setProgress(d.progress);setAnswers(d.progress.answers);setComments(d.progress.comments)}setStatus(d.role==='teacher'?'老师查看 · 可点评仿写':'仿写自动保存')}).catch(e=>setError(e.message))},[id]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 async function flush(){if(timer.current){clearTimeout(timer.current);timer.current=null}const batch=pending.current;if(!Object.keys(batch).length)return;pending.current={};setStatus('正在保存…');try{const d=await request({op:'save',task:id,answers:batch});setProgress(d.progress);setStatus('已保存')}catch(e){pending.current={...batch,...pending.current};setStatus((e as Error).message);throw e}}
 function write(key:string,value:string){setAnswers(x=>({...x,[key]:value}));pending.current[key]=value;setStatus('正在输入…');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{flush().catch(()=>{})},1000)}
 async function finish(){setFinishing(true);try{await flush();const d=await request({op:'finish',task:id});setProgress(d.progress);setDone(d.card)}catch(e){toast.error((e as Error).message)}finally{setFinishing(false)}}
 async function comment(key:string){try{const d=await request({op:'comment',task:id,key,text:comments[key]||''});setProgress(d.progress);toast.success('点评已保存')}catch(e){toast.error((e as Error).message)}}
 const toggle=(k:string)=>setShown(s=>{const n=new Set(s);if(n.has(k))n.delete(k);else n.add(k);return n});
 if(error)return <main className="student-empty"><h1>暂时无法打开精读</h1><p>{error}</p><a className="btn secondary" href="/?view=reading">返回精读</a></main>;
 if(!a)return <main className="student-empty"><p>正在加载文章…</p></main>;
 const paras=a.closeReading.paragraphs,practice=paras.flatMap((p,i)=>p.practice.map((q,j)=>({q,i,key:practiceKey(i,j)})));
 return <div className="reading-workspace close-reading"><Toaster position="top-center"/><AnnotationProvider task={id} sample={!student} compact translationEnabled={student}>
  <header className="cr-topbar"><a className="reader-back" href="/?view=reading"><ArrowLeft size={18}/>返回精读</a><span className="cr-top-title">{a.title}</span><span className="cr-status" role="status">{progress?.finished&&student?'已读 · ':''}{status}</span></header>
  <div className={'cr-layout'+(picked?' picking':'')}>
   <article className="cr-article">
    <span className="tag purple">精读</span><h1 lang="en">{a.title}</h1>{a.subtitle&&<p className="cr-subtitle">{a.subtitle}</p>}
    <p className="cr-legend"><span className="cr-word">重点词</span> 和 <span className="cr-sentence">重点句</span> 点击查看讲解；选中任意文字可以划线、批注和翻译。</p>
    {paras.map((p,i)=><section key={i} className="cr-para"><span className="cr-para-no">{i+1}</span><p lang="en"><ParagraphText p={p} index={i} picked={picked} onPick={setPicked}/></p></section>)}
    {a.source&&<p className="cr-source">来源：{a.source}</p>}
    {practice.length>0&&<section className="cr-practice-all"><h2>仿写练习</h2><p className="helper">{student?'用文中学到的单词和句型写自己的句子，写完自动保存。':'学生写的句子会显示在这里，可以逐条点评。'}</p>
     {practice.map(({q,i,key})=>{const k='e'+key,saved=progress?.comments[key];return <div key={key} className="cr-practice"><div className="cr-practice-head"><span className="tag">{q.type==='word'?'用词造句':'仿写句型'}</span>{q.target&&<b lang="en">{q.target}</b>}<small>第 {i+1} 段</small></div><p>{q.prompt}</p>
      <textarea lang="en" rows={2} maxLength={2000} value={answers[key]||''} readOnly={!student} placeholder={student?'写下你的句子…':'学生还没有写'} onChange={e=>write(key,e.target.value)}/>
      {q.example&&<><button className="cr-reveal" onClick={()=>toggle(k)}>{shown.has(k)?<EyeOff size={15}/>:<Eye size={15}/>}参考仿写</button>{shown.has(k)&&<p className="cr-example" lang="en">{q.example}</p>}</>}
      {!student?<div className="cr-comment-edit"><input value={comments[key]||''} maxLength={1000} placeholder="给学生的点评（可选）" onChange={e=>setComments(c=>({...c,[key]:e.target.value}))}/><button className="btn secondary" onClick={()=>comment(key)}>保存点评</button></div>:saved&&<p className="cr-teacher-comment"><b>老师点评：</b>{saved}</p>}</div>})}
    </section>}
    {student&&<section className="cr-finish"><h2>{progress?.finished?'这篇已经读完了':'读完了吗？'}</h2><p className="helper">生成学习卡片：重点单词、句子、你收藏的内容和仿写都会整理进去，之后在“精读 → 学习卡片”里查看和打印。</p><button className="btn" disabled={finishing} onClick={finish}><Sparkles size={16}/>{finishing?'正在生成…':progress?.finished?'打开学习卡片':'完成精读，生成学习卡片'}</button></section>}
   </article>
   <aside className={'cr-panel'+(picked?' open':'')} aria-label="讲解">
    {picked?<Detail a={a} picked={picked} task={id} student={student} onClose={()=>setPicked(null)}/>:<div className="cr-panel-empty"><MousePointerClick size={28}/><p>点击文中<b className="cr-word">绿色下划线</b>的单词、短语或<b className="cr-sentence">黄色标记</b>的句子，这里会显示讲解。</p><small>共 {paras.reduce((n,p)=>n+p.words.length,0)} 个重点词 · {paras.reduce((n,p)=>n+p.sentences.length,0)} 个重点句</small></div>}
   </aside>
  </div>
 </AnnotationProvider>
 <Dialog open={!!done} onOpenChange={v=>{if(!v)setDone(null)}}><DialogContent className="medium-dialog cr-done"><DialogTitle>学习卡片已生成 🎉</DialogTitle><DialogDescription>本篇的重点单词、句子、你收藏的内容和仿写都整理好了，可以修改、打印或导出 Word。</DialogDescription><div className="dialog-actions"><button className="btn secondary" onClick={()=>setDone(null)}>继续看文章</button><a className="btn" href={'/?view=reading&card='+encodeURIComponent(done||'')}>查看学习卡片 →</a></div></DialogContent></Dialog>
 </div>;
}

// ---------- 精读主页 ----------
const statusClass={未开始:'todo',在读:'doing',已读:'done'} as const;
function ArticleRow({a,teacher,onChanged}:{a:ReadingSummary;teacher:boolean;onChanged:()=>void}){
 const [busy,setBusy]=useState(''),[edit,setEdit]=useState<Material|null>(null);
 async function run(op:string,body:Record<string,unknown>,msg:string){setBusy(op);try{await request({op,id:a.id,...body});toast.success(msg);onChanged()}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 async function openEditor(){try{const d=await request(undefined,'?id='+encodeURIComponent(a.id));setEdit({id:a.id,title:d.article.title,subtitle:d.article.subtitle,source:d.article.source,kind:'精读',level:'',minutes:0,body:articleText(d.article.closeReading),sourceUrl:'',rights:'',audio:'',reviewed:true,questions:[],closeReading:d.article.closeReading})}catch(e){toast.error((e as Error).message)}}
 return <article className="cr-row"><a className="cr-row-main" href={'/close-reading/'+encodeURIComponent(a.id)}><span className="cr-row-date">{a.date.slice(5).replace('-','/')}</span><span><b lang="en">{a.title}</b>{a.subtitle&&<small>{a.subtitle}</small>}<small>{a.paragraphs} 段 · {a.words} 个重点词 · {a.sentences} 个重点句{a.source?` · ${a.source}`:''}</small></span></a>
  <span className={'cr-chip '+statusClass[a.status]}>{teacher?`学生${a.status}`:a.status==='在读'?'读到一半':a.status}</span>
  {a.card&&<a className="text-link" href={'/?view=reading&card='+encodeURIComponent(a.card)}>学习卡片</a>}
  {teacher&&<span className="cr-row-actions"><button className="text-link" onClick={openEditor}><Pencil size={14}/>编辑讲解</button><button className="text-link" disabled={!!busy} onClick={()=>{if(window.confirm('用 AI 重新生成这篇文章的讲解？现有的重点词、句和仿写会被替换。'))run('regenerate',{},'已重新生成讲解')}}><RotateCcw size={14}/>{busy==='regenerate'?'生成中…':'重新生成'}</button><button className="text-link danger" disabled={!!busy} onClick={()=>{if(window.confirm(`从精读列表移除“${a.title}”？学生已有的阅读记录和学习卡片会保留。`))run('remove',{},'已移除')}}><Trash2 size={14}/>移除</button></span>}
  {edit&&<Dialog open onOpenChange={v=>{if(!v)setEdit(null)}}><DialogContent className="large-dialog"><DialogTitle>编辑讲解</DialogTitle><DialogDescription>修改标题和每段的重点词、重点句、仿写，保存后学生立即看到。</DialogDescription>
   <div className="form-grid"><label>标题<input value={edit.title} maxLength={150} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><label>中文副标题<input value={edit.subtitle} maxLength={200} onChange={e=>setEdit({...edit,subtitle:e.target.value})}/></label></div>
   <CloseReadingEditor m={edit} patch={p=>setEdit(x=>x&&{...x,...p})}/>
   <div className="dialog-actions"><button className="btn secondary" onClick={()=>setEdit(null)}>取消</button><button className="btn" disabled={busy==='update'} onClick={async()=>{if(!edit.closeReading)return;await run('update',{title:edit.title,subtitle:edit.subtitle,source:edit.source,closeReading:edit.closeReading},'讲解已更新');setEdit(null)}}>保存</button></div></DialogContent></Dialog>}
 </article>;
}

function PushForm({onPushed}:{onPushed:()=>void}){
 const [title,setTitle]=useState(''),[source,setSource]=useState(''),[text,setText]=useState(''),[ai,setAi]=useState(true),[busy,setBusy]=useState('');
 async function upload(f:File){if(f.size>10*1024*1024){toast.error('文件不能超过 10MB');return}setBusy('upload');try{const buf=new Uint8Array(await f.arrayBuffer());let bin='';for(let i=0;i<buf.length;i+=0x8000)bin+=String.fromCharCode(...buf.subarray(i,i+0x8000));const d=await request({op:'extract',name:f.name,data:btoa(bin)});setText(d.text);if(!title)setTitle(f.name.replace(/\.(docx|txt)$/i,''));toast.success('已读取文章，请检查段落后推送')}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 async function push(){setBusy('push');try{await request({op:'create',title,source,text,ai});toast.success('已推送给学生');setTitle('');setSource('');setText('');onPushed()}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 return <section className="panel cr-push"><h2>推送一篇新文章</h2><p className="helper">粘贴或上传文章（段落之间空一行），AI 会按“AI 配置中心 → 精读 · 讲解草稿”的提示词生成标题、每段的重点词、重点句和仿写，生成后学生立即可以看到。推送后仍可编辑讲解。</p>
  <div className="form-grid"><label>标题（可选，留空由 AI 拟定）<input value={title} maxLength={150} onChange={e=>setTitle(e.target.value)}/></label><label>来源（可选）<input value={source} maxLength={300} placeholder="如：2024 北京中考阅读 D 篇" onChange={e=>setSource(e.target.value)}/></label></div>
  <label>文章<textarea lang="en" rows={10} maxLength={60000} value={text} onChange={e=>setText(e.target.value)} placeholder="粘贴英文文章，段落之间空一行…"/></label>
  <div className="cr-push-actions"><label className="cr-upload"><FileUp size={16}/>{busy==='upload'?'正在读取…':'上传 Word / TXT'}<input type="file" accept=".docx,.txt" disabled={!!busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/></label><button type="button" className="text-link" onClick={()=>{setText(articleText(sampleCloseReading.closeReading));setTitle(sampleCloseReading.title);setSource(sampleCloseReading.source)}}>填入示例（2024 中考 D 篇）</button><span/><label className="vocab-unsure"><input type="checkbox" checked={ai} onChange={e=>setAi(e.target.checked)}/>AI 生成讲解</label><button className="btn" disabled={!!busy||!text.trim()} onClick={push}><Sparkles size={16}/>{busy==='push'?(ai?'AI 正在生成讲解…':'正在推送…'):'生成并推送给学生'}</button></div>
 </section>;
}

export function CloseReadingHub(){
 const [data,setData]=useState<{role:'teacher'|'student';articles:ReadingSummary[]}|null>(null),[error,setError]=useState(''),[tab,setTab]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('card')?'cards':'todo');
 const load=()=>request().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 if(error)return <div role="alert" className="vocab-error">{error}</div>;
 if(!data)return <p role="status">正在读取精读文章…</p>;
 const teacher=data.role==='teacher',todo=data.articles.filter(a=>a.status!=='已读'),read=data.articles.filter(a=>a.status==='已读');
 const list=(rows:ReadingSummary[],empty:string)=>rows.length?<div className="cr-list">{rows.map(a=><ArticleRow key={a.id} a={a} teacher={teacher} onChanged={load}/>)}</div>:<p className="cr-empty">{empty}</p>;
 return <>
  <div className="page-heading"><div><div className="kicker">CLOSE READING</div><h1>精读</h1><p>{teacher?'推送文章给学生，上课时一起逐段精读；学生读完后生成学习卡片。':'和老师一起精读文章：学重点词、分析好句、写仿写，读完生成学习卡片。'}</p></div></div>
  {teacher?<><PushForm onPushed={load}/><section className="cr-section"><h2>已推送的文章 <small>{data.articles.length}</small></h2>{list(data.articles,'还没有推送文章。')}</section><section className="cr-section"><h2>学生的学习卡片</h2><StudyCards/></section></>
  :<Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="todo">待精读 {todo.length||''}</TabsTrigger><TabsTrigger value="cards">学习卡片</TabsTrigger><TabsTrigger value="read">读过的文章 {read.length||''}</TabsTrigger></TabsList>
   <TabsContent value="todo">{list(todo,'老师还没有推送新的文章。')}</TabsContent><TabsContent value="cards"><StudyCards/></TabsContent><TabsContent value="read">{list(read,'读完的文章会出现在这里。')}</TabsContent></Tabs>}
 </>;
}
