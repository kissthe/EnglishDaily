'use client';
import {Fragment,useEffect,useMemo,useState} from 'react';
import {BookOpenText,CheckCircle2,Circle,Download,EyeOff,Eye,Pencil,Quote,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {filterWordbook,sourceHref,sourceLabels,type WordbookEntry,type WordbookKind} from '@/lib/wordbook';

async function call(body?:unknown){const r=await fetch('/api/wordbook',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'请求未完成，请重试');return d}
const day=(s:string)=>s.slice(5,10).replace('-','/');
const escapeRe=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function Highlight({text,word}:{text:string;word:string}){const parts=text.split(new RegExp('('+escapeRe(word)+')','i'));return <>{parts.map((p,i)=>p.toLowerCase()===word.toLowerCase()?<mark key={i}>{p}</mark>:<Fragment key={i}>{p}</Fragment>)}</>}

export function Wordbook({teacher}:{teacher:boolean}){
 const [entries,setEntries]=useState<WordbookEntry[]|null>(null),[error,setError]=useState('');
 const [tab,setTab]=useState<'all'|WordbookKind>('all'),[query,setQuery]=useState(''),[source,setSource]=useState('all'),[hideMastered,setHideMastered]=useState(false),[cover,setCover]=useState(false),[sort,setSort]=useState<'new'|'az'>('new');
 const [revealed,setRevealed]=useState<Set<string>>(new Set()),[edit,setEdit]=useState<WordbookEntry|null>(null),[exportOpen,setExportOpen]=useState(false),[busy,setBusy]=useState('');
 async function load(){try{setEntries((await call()).entries);setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{load()},[]);
 const all=entries||[];
 const stats=useMemo(()=>{const week=Date.now()-7*864e5;return {words:all.filter(e=>e.kind==='word').length,sentences:all.filter(e=>e.kind==='sentence').length,mastered:all.filter(e=>e.mastered).length,week:all.filter(e=>Date.parse(e.created)>week).length}},[all]);
 const visible=filterWordbook(all,{kind:tab,query,source,includeMastered:!hideMastered}).sort((a,b)=>sort==='az'?a.text.localeCompare(b.text,'en',{sensitivity:'base'}):b.created.localeCompare(a.created));
 const words=visible.filter(e=>e.kind==='word'),sentences=visible.filter(e=>e.kind==='sentence');
 async function patch(e:WordbookEntry,body:Record<string,unknown>,message:string){setBusy(e.id);try{await call({op:'update',id:e.id,...body});toast.success(message);await load()}catch(err){toast.error((err as Error).message)}finally{setBusy('')}}
 async function remove(e:WordbookEntry){if(!window.confirm(`从单词本删除“${e.text.slice(0,40)}”？${e.fromAnnotation?'原文中的划线会保留。':''}`))return;setBusy(e.id);try{await call({op:'delete',id:e.id});toast.success('已删除');await load()}catch(err){toast.error((err as Error).message)}finally{setBusy('')}}
 const reveal=(id:string)=>setRevealed(r=>{const n=new Set(r);n.has(id)?n.delete(id):n.add(id);return n});

 const actions=(e:WordbookEntry)=>!teacher&&<div className="wb-actions"><button aria-label="编辑" title="编辑释义" disabled={busy===e.id} onClick={()=>setEdit(e)}><Pencil size={16}/></button><button aria-label="删除" title="删除" disabled={busy===e.id} onClick={()=>remove(e)}><Trash2 size={16}/></button></div>;
 const sourceLink=(e:WordbookEntry)=><a className="wb-source" href={sourceHref(e)} title="回到原文">{sourceLabels[e.sourceKind]}{e.sourceTitle?' · '+e.sourceTitle:''}</a>;
 const meaning=(e:WordbookEntry,empty:string)=>{const hidden=cover&&!revealed.has(e.id);return <button type="button" className={'wb-meaning'+(hidden?' covered':'')+(e.note?'':' empty')} onClick={()=>cover&&reveal(e.id)} aria-label={hidden?'点击查看释义':undefined} tabIndex={cover?0:-1}>{hidden?<span>想一想，再点开</span>:e.note||empty}</button>};

 return <div className="wordbook">
  <header className="wb-hero"><div><span className="kicker">MY WORD BOOK</span><h1>{teacher?'学生的单词本':'单词本'}</h1><p>{teacher?'学生在作业、知识拓展和资料库中收藏的单词与句子。':'在作业、知识拓展或资料库里选中文字，就能收藏到这里。遮住释义自测，或导出 Word 打印复习。'}</p></div>
   <button className="btn" onClick={()=>setExportOpen(true)} disabled={!all.length}><Download size={18}/>导出 Word</button></header>
  <section className="wb-stats" aria-label="单词本统计"><div><strong>{stats.words}</strong><span>单词</span></div><div><strong>{stats.sentences}</strong><span>句子</span></div><div><strong>{stats.mastered}</strong><span>已掌握</span></div><div><strong>{stats.week}</strong><span>本周新增</span></div></section>
  <div className="wb-toolbar">
   <nav className="wb-tabs" aria-label="收藏类型">{([['all','全部'],['word','单词'],['sentence','句子']] as const).map(([k,l])=><button key={k} aria-pressed={tab===k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</nav>
   <input type="search" aria-label="搜索单词本" placeholder="搜索单词、释义或例句" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="来源" value={source} onChange={e=>setSource(e.target.value)}><option value="all">全部来源</option><option value="task">作业</option><option value="knowledge">知识拓展</option><option value="library">资料库</option></select>
   <select aria-label="排序" value={sort} onChange={e=>setSort(e.target.value as 'new'|'az')}><option value="new">最新收藏</option><option value="az">按字母 A–Z</option></select>
  </div>
  <div className="wb-switches"><label><Switch checked={cover} onCheckedChange={v=>{setCover(v);setRevealed(new Set())}}/>{cover?<EyeOff size={16}/>:<Eye size={16}/>}遮住释义自测</label><label><Switch checked={hideMastered} onCheckedChange={setHideMastered}/>隐藏已掌握</label><span>{visible.length} 条</span></div>
  {error&&<div role="alert" className="panel"><p>{error}</p><button className="btn secondary" onClick={load}>重新加载</button></div>}
  {!entries&&!error&&<p className="helper">正在打开单词本…</p>}
  {entries&&!visible.length&&<div className="wb-empty"><BookOpenText size={36}/><h2>{all.length?'没有符合条件的收藏':'单词本还是空的'}</h2><p>{all.length?'换个筛选条件试试。':'做作业时选中单词，点“收藏 / 批注”选择“单词”；在知识拓展和资料库页面选中文字，点底部的“收藏单词”。'}</p></div>}
  {words.length>0&&<section aria-labelledby="wb-words"><h2 id="wb-words" className="wb-section-title">单词 <small>{words.length}</small></h2><div className="wb-word-grid">{words.map(e=><article className={'wb-card wb-word'+(e.mastered?' mastered':'')} key={e.id}>
   <header><h3 lang="en">{e.text}</h3>{!teacher?<button className="wb-master" aria-pressed={e.mastered} disabled={busy===e.id} title={e.mastered?'取消已掌握':'标记为已掌握'} onClick={()=>patch(e,{mastered:!e.mastered},e.mastered?'已移回复习':'太棒了，已掌握')}>{e.mastered?<CheckCircle2 size={20}/>:<Circle size={20}/>}<span>{e.mastered?'已掌握':'掌握了'}</span></button>:e.mastered&&<span className="tag green">已掌握</span>}</header>
   {meaning(e,teacher?'未写释义':'还没写释义，点铅笔补充')}
   {e.context&&<p className="wb-context" lang="en"><Highlight text={e.context} word={e.text}/></p>}
   <footer>{sourceLink(e)}<span className="wb-date">{day(e.created)}</span>{actions(e)}</footer>
  </article>)}</div></section>}
  {sentences.length>0&&<section aria-labelledby="wb-sentences"><h2 id="wb-sentences" className="wb-section-title">句子 <small>{sentences.length}</small></h2><div className="wb-sentence-list">{sentences.map(e=><article className={'wb-card wb-sentence'+(e.mastered?' mastered':'')} key={e.id}>
   <Quote className="wb-quote-mark" size={28} aria-hidden/><blockquote lang="en">{e.text}</blockquote>
   {meaning(e,teacher?'未写理解':'还没写理解或翻译，点铅笔补充')}
   <footer>{sourceLink(e)}<span className="wb-date">{day(e.created)}</span>{!teacher&&<button className="wb-master small" aria-pressed={e.mastered} disabled={busy===e.id} onClick={()=>patch(e,{mastered:!e.mastered},e.mastered?'已移回复习':'已掌握')}>{e.mastered?<CheckCircle2 size={16}/>:<Circle size={16}/>}{e.mastered?'已掌握':'掌握了'}</button>}{actions(e)}</footer>
  </article>)}</div></section>}
  {edit&&<EditDialog entry={edit} onClose={()=>setEdit(null)} onSaved={async()=>{setEdit(null);await load()}}/>}
  <ExportDialog open={exportOpen} onClose={()=>setExportOpen(false)} query={query}/>
 </div>;
}

function EditDialog({entry,onClose,onSaved}:{entry:WordbookEntry;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [kind,setKind]=useState(entry.kind),[note,setNote]=useState(entry.note),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await call({op:'update',id:entry.id,kind,note});toast.success('已保存');await onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>编辑收藏</DialogTitle><DialogDescription>{entry.fromAnnotation?'修改会同步到作业原文的批注。':'来自'+sourceLabels[entry.sourceKind]+(entry.sourceTitle?' · '+entry.sourceTitle:'')}</DialogDescription></DialogHeader>
  <blockquote className="annotation-quote">{entry.text}</blockquote>
  <div className="wb-kind-pick" role="radiogroup" aria-label="类型">{(['word','sentence'] as const).map(k=><label key={k} className={kind===k?'active':''}><input type="radio" name="wb-kind" checked={kind===k} onChange={()=>setKind(k)}/>{k==='word'?'单词':'句子'}</label>)}</div>
  <label>{kind==='word'?'释义 / 用法':'理解 / 翻译'}<textarea rows={5} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/></label>
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div className="dialog-actions"><button className="btn secondary" disabled={busy} onClick={onClose}>取消</button><button className="btn" disabled={busy} onClick={save}>{busy?'正在保存…':'保存'}</button></div>
 </DialogContent></Dialog>;
}

function ExportDialog({open,onClose,query}:{open:boolean;onClose:()=>void;query:string}){
 const [kind,setKind]=useState<'all'|WordbookKind>('all'),[mode,setMode]=useState<'full'|'quiz'>('full'),[mastered,setMastered]=useState(true);
 const href='/api/wordbook?'+new URLSearchParams({export:'docx',kind,mode,includeMastered:mastered?'1':'0',...(query.trim()?{q:query.trim()}:{})});
 const option=<T extends string>(value:T,current:T,set:(v:T)=>void,title:string,text:string)=><label className={current===value?'active':''}><input type="radio" checked={current===value} onChange={()=>set(value)}/><b>{title}</b><small>{text}</small></label>;
 return <Dialog open={open} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>导出 Word 单词本</DialogTitle><DialogDescription>生成 .docx 文件，可以直接用 Word / WPS 打开打印。{query.trim()?`只导出搜索“${query.trim()}”的结果。`:''}</DialogDescription></DialogHeader>
  <div className="wb-export"><h3>版本</h3><div className="wb-export-options">{option('full',mode,setMode,'完整版','单词、释义和原文例句；句子附理解')}{option('quiz',mode,setMode,'默写版','只印单词和句子，释义处留空自测')}</div>
   <h3>内容</h3><div className="wb-export-options three">{option('all',kind,setKind,'全部','单词 + 句子')}{option('word',kind,setKind,'只要单词','表格排版')}{option('sentence',kind,setKind,'只要句子','好句积累')}</div>
   <label className="review-switch"><Switch checked={mastered} onCheckedChange={setMastered}/>包含已掌握的条目</label></div>
  <div className="dialog-actions"><button className="btn secondary" onClick={onClose}>取消</button><a className="btn" href={href} onClick={()=>setTimeout(onClose,300)}><Download size={16}/>下载 Word</a></div>
 </DialogContent></Dialog>;
}
