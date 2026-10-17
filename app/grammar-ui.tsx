'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {toast} from 'sonner';
import {ArrowRight,Check,ListChecks,RotateCcw,X} from 'lucide-react';
import {grammarTopics,type GrammarFeedback,type GrammarItem,type GrammarMistake,type GrammarQuestion,type GrammarState,type GrammarTopic,type GrammarTopicStat,type PlanKind} from '@/lib/grammar-bank';

async function request(body?:unknown,query=''){const r=await fetch('/api/grammar'+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'语法练习暂时无法加载');return d}
const letter=(i:number)=>String.fromCharCode(65+i);
const kindLabel:Record<PlanKind,string>={review:'错题复习',weak:'薄弱专项',new:'新题',repeat:'回顾旧题'};
const percent=(c:number,n:number)=>n?Math.round(c/n*100):null;

// 题干与解析中的 `代码` 显示为强调词，连续下划线显示为填空横线。
export function Rich({text,className}:{text:string;className?:string}){
 return <span className={className}>{text.split(/(`[^`]+`|_{3,})/).map((part,i)=>part.startsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:/^_{3,}$/.test(part)?<span key={i} className="grammar-blank" aria-label="空格">&nbsp;</span>:part)}</span>;
}

function reviewNote(f:GrammarFeedback){
 if(!f.correct)return '已加入错题本，明天再练这道题。';
 if(f.unsure)return '选对了，但你标记了不确定，明天再巩固一次。';
 if(f.mastered&&f.nextDue)return `错题连续答对 ${f.streak} 次，已掌握！${f.nextDue} 再巩固一次。`;
 if(f.mastered)return '这道错题已经彻底掌握。';
 if(f.nextDue)return `答对了，${f.nextDue} 再复习一次。`;
 return '';
}

function Options({item,choice,feedback,onChoose,disabled}:{item:Pick<GrammarItem,'options'|'id'>;choice:number|null;feedback?:Pick<GrammarFeedback,'answer'|'chosen'>|null;onChoose?:(i:number)=>void;disabled?:boolean}){
 return <fieldset className="vocab-options grammar-options" disabled={disabled||!!feedback}><legend className="sr-only">选择答案</legend>{item.options.map((o,i)=>{const state=feedback?(i===feedback.answer?'correct':i===feedback.chosen?'wrong':''):choice===i?'selected':'';return <label key={i} className={state}><input type="radio" name={'grammar-'+item.id} checked={(feedback?feedback.chosen:choice)===i} onChange={()=>onChoose?.(i)}/><span>{letter(i)}</span><span lang="en">{o}</span>{feedback&&i===feedback.answer&&<Check size={18} aria-label="正确答案"/>}{feedback&&i!==feedback.answer&&i===feedback.chosen&&<X size={18} aria-label="你的选择"/>}</label>})}</fieldset>;
}

function Explanation({topic,point,explanation}:{topic:string;point:string;explanation:string}){
 return <><p className="grammar-point"><b>{topic}</b>{point&&<> · {point}</>}</p><p className="grammar-explanation"><Rich text={explanation}/></p></>;
}

export function GrammarPage(){
 const [data,setData]=useState<GrammarState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[choice,setChoice]=useState<number|null>(null),[unsure,setUnsure]=useState(false),[feedback,setFeedback]=useState<GrammarFeedback|null>(null),[currentId,setCurrentId]=useState<string|null>(null),nextButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{request().then(setData).catch(e=>setError(e.message))},[]);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const items=data?.items||[],current=currentId?items.find(i=>i.id===currentId):items.find(i=>!i.result),index=current?items.indexOf(current):items.length;
 const start=(op:'start'|'more')=>run(async()=>{setData(await request({op}));setFeedback(null);setCurrentId(null);setChoice(null);setUnsure(false)});
 const answer=()=>run(async()=>{if(!current||choice===null)return;const f=(await request({op:'answer',id:current.id,choice,unsure})).feedback as GrammarFeedback;setFeedback(f);setCurrentId(current.id);requestAnimationFrame(()=>{nextButton.current?.focus({preventScroll:true});document.querySelector('.grammar-feedback')?.scrollIntoView({block:'nearest',behavior:'smooth'})});setData(d=>d&&{...d,done:d.done+1,correct:d.correct+(f.correct?1:0),items:d.items.map(i=>i.id===current.id?{...i,topic:f.topic,result:f}:i)})});
 function next(){setFeedback(null);setCurrentId(null);setChoice(null);setUnsure(false);window.scrollTo({top:0,behavior:'smooth'})}
 const wrong=items.filter(i=>i.result&&!i.result.correct);
 useEffect(()=>{if(!current)return;const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement&&e.target.type!=='radio'||e.target instanceof HTMLTextAreaElement||e.metaKey||e.ctrlKey||e.altKey)return;const n=Number(e.key);if(!feedback&&n>=1&&n<=current.options.length){e.preventDefault();setChoice(n-1)}else if(e.key==='Enter'&&document.activeElement===document.body){e.preventDefault();if(feedback)next();else if(choice!==null)answer()}};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)});
 return <div className="vocabulary-page grammar-page">
  <header className="knowledge-topbar"><a className="btn secondary" href="/?view=grammar">← 返回语法练习</a><span>GRAMMAR · A LITTLE EVERY DAY</span></header>
  <main className="vocabulary-content">
   {error&&<div role="alert" className="vocab-error">{error}<button className="text-link" disabled={busy} onClick={()=>request().then(d=>{setData(d);setError('');next()}).catch(e=>setError(e.message))}>重新加载</button></div>}
   {!data?<p role="status">正在准备今天的语法题…</p>
   :data.role==='teacher'?<div className="panel"><h1>请使用学生账号练习</h1><p>在“语法练习”页面中设置每日题量、开放的语法类别和题库。</p></div>
   :current?<>
     <div className="vocab-session-bar"><span>第 {index+1} / {items.length} 题 · {kindLabel[current.kind]}</span><span>今日答对 {data.correct} / {data.done}</span></div>
     <progress className="grammar-progress" max={items.length} value={data.done} aria-label="今日进度"/>
     <article className="vocab-study-card">
      <span className="kicker">CHOOSE THE BEST ANSWER</span>
      <p className="grammar-prompt" lang="en"><Rich text={current.prompt}/></p>
      <Options item={current} choice={choice} feedback={feedback} onChoose={setChoice} disabled={busy}/>
      {!feedback?<label className="vocab-unsure"><input type="checkbox" checked={unsure} disabled={busy} onChange={e=>setUnsure(e.target.checked)}/>有点不确定，是猜的（明天再练一次）</label>
      :<section className={'vocab-feedback grammar-feedback '+(feedback.correct?'remembered':'again')} aria-live="polite">
       <h2>{feedback.correct?'回答正确！':`答错了，正确答案是 ${letter(feedback.answer)}`}</h2>
       <Explanation topic={feedback.topic} point={feedback.point} explanation={feedback.explanation}/>
       {reviewNote(feedback)&&<p className="vocab-next-date">{reviewNote(feedback)}</p>}
      </section>}
     </article>
     <div className="vocab-sticky-bar">{feedback?<><span className={feedback.correct?'success-text':'error-text'}>{feedback.correct?'✓ 回答正确':`✗ 正确答案 ${letter(feedback.answer)}`}<small>按 Enter 继续</small></span><button ref={nextButton} className="btn" onClick={next}>{index+1<items.length?'下一题':'查看今日结果'}<ArrowRight size={17}/></button></>:<><span>{choice===null?'选择一个答案':`已选 ${letter(choice)}`}<small>键盘 1–4 选择，Enter 确认</small></span><button className="btn" disabled={busy||choice===null} onClick={answer}>{busy?'正在提交…':'确认答案'}<Check size={17}/></button></>}</div>
    </>
   :<>
     <div className="page-heading"><div><span className="kicker">GRAMMAR REVIEW</span><h1>{items.length?'今天的语法题完成了':'每天几道题，把语法练熟'}</h1><p>{items.length?`答对 ${data.correct} / ${items.length} 题。错题会在之后几天自动再出现。`:'系统每天从题库中挑题：先复习到期错题，再练薄弱类别，其余类别轮流覆盖。'}</p></div><ListChecks size={34}/></div>
     {!items.length?<section className="vocab-study-card"><h2>{data.available?`今日 ${Math.min(data.dailyCount,data.available)} 题`:'老师还没有开放语法题目'}</h2><p>{data.due?`其中有 ${data.due} 道到期错题。`:'做完一题马上显示对错和解析。'}</p>{data.available>0&&<button className="btn" disabled={busy} onClick={()=>start('start')}>{busy?'正在出题…':'开始今日练习'}<ArrowRight size={17}/></button>}</section>
     :<section className="vocab-study-card">
       <h2>{wrong.length?`今天错了 ${wrong.length} 题，再看一遍`:'全部答对，真棒！'}</h2>
       {wrong.map(i=><details key={i.id} className="grammar-review-item"><summary><Rich text={i.prompt.split('\n')[0]}/></summary><p className="grammar-prompt small" lang="en"><Rich text={i.prompt}/></p><Options item={i} choice={null} feedback={i.result}/><Explanation topic={i.result!.topic} point={i.result!.point} explanation={i.result!.explanation}/></details>)}
       <div className="vocab-actions"><a className="btn secondary" href="/?view=grammar">查看错题本和掌握情况</a><button className="btn" disabled={busy} onClick={()=>start('more')}>{busy?'正在出题…':'再练 5 题'}<RotateCcw size={16}/></button></div>
      </section>}
    </>}
  </main>
 </div>;
}

function TopicTable({stats}:{stats:GrammarTopicStat[]}){
 const rows=stats.filter(s=>s.enabled||s.total);
 return <section className="panel grammar-topics"><h2>各语法类别掌握情况</h2><p className="helper">近 30 天正确率；做题少于 3 道时不作判断。正确率低于 80% 的类别会多出题。</p>
  <div className="grammar-topic-list">{rows.map(s=>{const recent=percent(s.recentCorrect,s.recentTotal),all=percent(s.correct,s.total),weak=s.recentTotal>=3&&recent!==null&&recent<80;return <div key={s.topic} className={'grammar-topic'+(weak?' weak':'')}>
   <div><b>{s.topic}</b>{!s.enabled&&<small> · 未开放</small>}{weak&&<small className="grammar-weak-tag"> · 需加强</small>}<small>已练 {s.practiced} / {s.questions} 题{s.pending?` · ${s.pending} 道错题待复习`:''}</small></div>
   <div className="grammar-meter" role="img" aria-label={recent===null?'暂无记录':`近 30 天正确率 ${recent}%`}><span style={{width:(s.recentTotal>=3?recent??0:0)+'%'}}/></div>
   <span className="grammar-rate">{s.recentTotal<3?'—':recent+'%'}<small>{all===null?'':`累计 ${all}%`}</small></span>
  </div>})}</div>
 </section>;
}

function MistakeBook({mistakes}:{mistakes:GrammarMistake[]}){
 const [filter,setFilter]=useState<'pending'|'mastered'|'all'>('pending');
 const shown=mistakes.filter(m=>filter==='all'||(filter==='mastered')===m.mastered);
 return <section className="panel grammar-mistakes"><div className="grammar-section-head"><h2>错题本</h2><div className="knowledge-filters"><nav aria-label="错题筛选">{([['pending','待复习'],['mastered','已掌握'],['all','全部']] as const).map(([k,l])=><button key={k} className={filter===k?'active':''} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l} {k==='all'?mistakes.length:mistakes.filter(m=>(k==='mastered')===m.mastered).length}</button>)}</nav></div></div>
  <p className="helper">答错或标记“不确定”的题会进入错题本，按 1、3、7、14 天的间隔重新出现；连续答对两次算已掌握。</p>
  {!shown.length?<p className="grammar-empty">{filter==='pending'?'目前没有待复习的错题。':'暂无记录。'}</p>:shown.map(m=><details key={m.id} className="grammar-review-item"><summary><Rich text={m.prompt.split('\n')[0]}/><small>{m.topic} · {m.wrong?`错 ${m.wrong} 次`:'标记过不确定'} · {m.mastered?'已掌握':m.nextDue?`${m.nextDue} 复习`:'待复习'}</small></summary><p className="grammar-prompt small" lang="en"><Rich text={m.prompt}/></p><Options item={m} choice={null} feedback={{answer:m.answer,chosen:null}}/><Explanation topic={m.topic} point={m.point} explanation={m.explanation}/></details>)}
 </section>;
}

export function GrammarHub(){
 const [data,setData]=useState<GrammarState|null>(null),[error,setError]=useState('');
 useEffect(()=>{request().then(setData).catch(e=>setError(e.message))},[]);
 if(error)return <div role="alert" className="vocab-error">{error}</div>;
 if(!data)return <p role="status">正在读取语法练习…</p>;
 const pending=data.mistakes.filter(m=>!m.mastered).length,mastered=data.mistakes.length-pending,started=data.items.length>0,finished=started&&data.done===data.items.length;
 return <>
  <div className="page-heading"><div><div className="kicker">GRAMMAR · A LITTLE EVERY DAY</div><h1>语法练习</h1><p>每天几道北京中考语法选择题，做完一题马上看解析，错题按间隔自动复习。</p></div>{data.role==='student'&&<a className="btn" href="/grammar">{!started?'开始今日练习':finished?'查看今日结果':'继续练习'} →</a>}</div>
  <div className="vocab-metrics grammar-metrics">
   <article><strong>{started?`${data.done}/${data.items.length}`:Math.min(data.dailyCount,data.available)}</strong><span>{started?'今日完成':'今日题量'}</span></article>
   <article><strong>{data.streakDays}</strong><span>连续练习天数</span></article>
   <article><strong>{pending}</strong><span>待复习错题</span></article>
   <article><strong>{mastered}</strong><span>已掌握错题</span></article>
  </div>
  {data.role==='teacher'&&<GrammarTeacher data={data} onChange={setData}/>}
  <TopicTable stats={data.stats}/>
  <MistakeBook mistakes={data.mistakes}/>
  {data.role==='teacher'&&<GrammarBank data={data} onChange={setData}/>}
 </>;
}

function GrammarTeacher({data,onChange}:{data:GrammarState;onChange:(d:GrammarState)=>void}){
 const [daily,setDaily]=useState(data.dailyCount),[topics,setTopics]=useState<GrammarTopic[]>(data.topics),[busy,setBusy]=useState(false);
 const counts=useMemo(()=>Object.fromEntries(grammarTopics.map(t=>[t,(data.questions||[]).filter(q=>q.topic===t&&q.enabled).length])),[data.questions]);
 const max=Math.max(1,...(data.recent||[]).map(r=>r.total));
 async function save(){setBusy(true);try{onChange(await request({op:'settings',dailyCount:daily,topics}));toast.success('已保存，明天起按新设置出题')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel grammar-settings">
  <h2>出题设置</h2>
  <p className="helper">每天按设置自动出题：到期错题最多占一半，其余优先练正确率低于 80% 的类别，再按“最久没练”轮流覆盖。今天已生成的题目不受影响。</p>
  <label className="grammar-daily">每日题量<input type="number" min={1} max={50} value={daily} onChange={e=>setDaily(Number(e.target.value))}/></label>
  <fieldset className="grammar-topic-picks"><legend>开放的语法类别（只从勾选的类别出题）</legend>{grammarTopics.map(t=><label key={t}><input type="checkbox" checked={topics.includes(t)} onChange={e=>setTopics(e.target.checked?[...topics,t]:topics.filter(x=>x!==t))}/>{t}<small>{counts[t]} 题</small></label>)}</fieldset>
  <div className="vocab-actions"><span className="helper">学生今日：{data.items.length?`已完成 ${data.done} / ${data.items.length}，答对 ${data.correct}`:'尚未开始'}</span><button className="btn" disabled={busy||!topics.length||daily<1||daily>50} onClick={save}>{busy?'正在保存…':'保存设置'}</button></div>
  {data.recent&&<div className="grammar-week" aria-label="最近 7 天练习量">{data.recent.map(r=><div key={r.day} title={`${r.day}：${r.correct}/${r.total}`}><span style={{height:Math.round(r.total/max*60)+'px'}}><i style={{height:r.total?Math.round(r.correct/r.total*100)+'%':0}}/></span><small>{r.day.slice(5)}</small><small>{r.total?`${r.correct}/${r.total}`:'—'}</small></div>)}</div>}
 </section>;
}

const blankQuestion=(q:GrammarQuestion)=>({...q});
function GrammarBank({data,onChange}:{data:GrammarState;onChange:(d:GrammarState)=>void}){
 const [topic,setTopic]=useState<'全部'|GrammarTopic>('全部'),[status,setStatus]=useState('全部'),[query,setQuery]=useState(''),[limit,setLimit]=useState(20),[edit,setEdit]=useState<GrammarQuestion|null>(null),[busy,setBusy]=useState(false),[markdown,setMarkdown]=useState(''),[preview,setPreview]=useState<{questions:GrammarQuestion[];errors:string[]}|null>(null);
 const list=(data.questions||[]).filter(q=>(topic==='全部'||q.topic===topic)&&(status==='全部'||(status==='已启用'?q.enabled:status==='已暂停'?!q.enabled:!!q.note))&&[q.prompt,q.point,...q.options].join(' ').toLowerCase().includes(query.toLowerCase()));
 async function save(q:GrammarQuestion){setBusy(true);try{onChange(await request({op:'save',question:q}));setEdit(null);toast.success('题目已保存')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 async function importBank(confirm:boolean){setBusy(true);try{const d=await request({op:'import',markdown,preview:!confirm});if(confirm&&d.added){toast.success(`已导入 ${d.added} 题`);setMarkdown('');setPreview(null);onChange(await request())}else setPreview(d)}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 return <>
  <section className="panel grammar-bank">
   <div className="grammar-section-head"><h2>题库 · {data.questions?.length||0} 题</h2><span className="helper">已启用 {data.questions?.filter(q=>q.enabled).length||0} 题</span></div>
   <div className="grammar-bank-filters"><label>类别<select value={topic} onChange={e=>{setTopic(e.target.value as GrammarTopic);setLimit(20)}}><option>全部</option>{grammarTopics.map(t=><option key={t}>{t}</option>)}</select></label><label>状态<select value={status} onChange={e=>{setStatus(e.target.value);setLimit(20)}}>{['全部','已启用','已暂停','需核对'].map(s=><option key={s}>{s}</option>)}</select></label><label>搜索<input type="search" value={query} placeholder="题干、选项或考点" onChange={e=>{setQuery(e.target.value);setLimit(20)}}/></label></div>
   <div className="vocab-word-list">{list.slice(0,limit).map(q=>edit?.id===q.id?<QuestionEditor key={q.id} value={edit} onChange={setEdit} onCancel={()=>setEdit(null)} onSave={()=>save(edit)} busy={busy}/>:<div key={q.id} className="vocab-word-row grammar-bank-row"><span><Rich text={q.prompt.split('\n').join(' ')}/><small>{q.topic}{q.point&&` · ${q.point}`}{q.level&&` · ${q.level}`} · 答案 {letter(q.answer)} · {q.source}</small>{q.note&&<small className="error-text">需核对：{q.note}</small>}</span><span className="grammar-row-actions"><button className="text-link" disabled={busy} onClick={()=>save({...q,enabled:!q.enabled})}>{q.enabled?'暂停':'启用'}</button><button className="text-link" onClick={()=>setEdit(blankQuestion(q))}>编辑</button></span></div>)}</div>
   {list.length>limit&&<button className="btn secondary" onClick={()=>setLimit(limit+40)}>显示更多（还有 {list.length-limit} 题）</button>}
   {!list.length&&<p className="grammar-empty">没有符合条件的题目。</p>}
  </section>
  <section className="panel grammar-import"><h2>导入题目</h2><p className="helper">粘贴 Markdown 题库，格式与现有两份题库相同：用“## 类别”分组，每题写题干、A–D 四个选项、答案、考点和解析。先预览，确认无误再导入。</p>
   <textarea rows={10} value={markdown} maxLength={500000} onChange={e=>{setMarkdown(e.target.value);setPreview(null)}} placeholder={'## 动词时态\n\n### 第 1 题｜基础\n\nMy father ______ to work by bike every day.\n\nA. goes\nB. went\nC. is going\nD. has gone\n\n**答案：A**\n\n**考点：** 一般现在时\n\n**解析：** every day 表示习惯性动作……'}/>
   <div className="vocab-actions"><span className="helper">{preview?`识别到 ${preview.questions.length} 题${preview.errors.length?`，${preview.errors.length} 处问题需要修改`:''}`:''}</span><span><button className="btn secondary" disabled={busy||!markdown.trim()} onClick={()=>importBank(false)}>预览</button> <button className="btn" disabled={busy||!preview||!!preview.errors.length||!preview.questions.length} onClick={()=>importBank(true)}>确认导入</button></span></div>
   {preview?.errors.length?<ul className="error-text">{preview.errors.map(e=><li key={e}>{e}</li>)}</ul>:null}
   {preview&&!preview.errors.length&&preview.questions.slice(0,3).map((q,i)=><div key={i} className="grammar-review-item"><p className="grammar-prompt small" lang="en"><Rich text={q.prompt}/></p><p className="helper">{q.topic} · {q.point} · 答案 {letter(q.answer)}：{q.options[q.answer]}</p></div>)}
  </section>
 </>;
}

function QuestionEditor({value,onChange,onCancel,onSave,busy}:{value:GrammarQuestion;onChange:(q:GrammarQuestion)=>void;onCancel:()=>void;onSave:()=>void;busy:boolean}){
 const set=(p:Partial<GrammarQuestion>)=>onChange({...value,...p});
 return <form className="grammar-editor" onSubmit={e=>{e.preventDefault();onSave()}}>
  <div className="grammar-bank-filters"><label>类别<select value={value.topic} onChange={e=>set({topic:e.target.value as GrammarTopic})}>{grammarTopics.map(t=><option key={t}>{t}</option>)}</select></label><label>考点<input value={value.point} maxLength={100} onChange={e=>set({point:e.target.value})}/></label><label>难度<select value={value.level} onChange={e=>set({level:e.target.value as GrammarQuestion['level']})}>{['','基础','提升','易错'].map(l=><option key={l} value={l}>{l||'未标注'}</option>)}</select></label></div>
  <label>题干（对话可分行，空格用 ____ 表示）<textarea required rows={3} maxLength={2000} value={value.prompt} onChange={e=>set({prompt:e.target.value})}/></label>
  <fieldset className="grammar-editor-options"><legend>选项（点选正确答案）</legend>{value.options.map((o,i)=><label key={i}><input type="radio" name="grammar-answer" checked={value.answer===i} onChange={()=>set({answer:i})} aria-label={`正确答案 ${letter(i)}`}/><span>{letter(i)}</span><input required value={o} maxLength={300} onChange={e=>set({options:value.options.map((x,j)=>j===i?e.target.value:x)})}/></label>)}</fieldset>
  <label>解析<textarea required rows={4} maxLength={3000} value={value.explanation} onChange={e=>set({explanation:e.target.value})}/></label>
  {value.note&&<p className="error-text">需核对：{value.note}<button type="button" className="text-link" onClick={()=>set({note:undefined})}>已修改，清除提示</button></p>}
  <label className="vocab-unsure"><input type="checkbox" checked={value.enabled} onChange={e=>set({enabled:e.target.checked})}/>启用这道题</label>
  <div className="vocab-actions"><button type="button" className="btn secondary" onClick={onCancel}>取消</button><button className="btn" disabled={busy}>{busy?'正在保存…':'保存题目'}</button></div>
 </form>;
}

export function GrammarReminder(){
 const [data,setData]=useState<{dailyCount:number;started:boolean;total:number;done:number;correct:number;due:number;available:number}|null>(null);
 useEffect(()=>{let active=true;const load=()=>{if(document.visibilityState==='visible')request(undefined,'?summary=1').then(d=>{if(active)setData(d)}).catch(()=>{})};load();window.addEventListener('focus',load);return ()=>{active=false;window.removeEventListener('focus',load)}},[]);
 if(!data||!data.available)return null;
 const left=data.started?data.total-data.done:Math.min(data.dailyCount,data.available);
 return <section className="panel vocabulary-reminder grammar-reminder" aria-label="每日语法提醒"><div><h2>今日语法 · {left?`还有 ${left} 题`:'已完成'}</h2><p>{data.started?`已完成 ${data.done} / ${data.total} 题，答对 ${data.correct} 题`:data.due?`包含 ${data.due} 道到期错题`:'做完一题马上看解析'}</p></div><a className="btn" href="/grammar">{left?(data.started?'继续练习':'开始练习'):'查看结果'} →</a></section>;
}
