'use client';
// 北京中考“听后转述”两种训练方式：转述训练（听记要点 → 核对 → 组织表达）与全真模拟（限时、连放三遍）。
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {AiAssessment,CourseData,Material,RetellMode,Submission,Task} from '@/lib/course';
import {answerText,parseMindMap,readNotes,retellModeTitles,type RetellNote} from '@/lib/retell';
import {LessonAudio} from './lesson-media';
import {TipsButton} from './tips';
import {Maximize2,Minus,Plus,X,Map as MapIcon} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export const EXAM_PREVIEW_SECONDS=60,EXAM_PLAYS=3,EXAM_ANSWER_SECONDS=360;
const checkTips=['开头一字不差地使用给定开头句','导图里每个一级提纲都讲到了','人称已转换：原文的 you → we，说话人 I → he / she','时态一致：通知类多用将来时，经历类多用过去时','每个要点都是完整句，不是只念关键词','用了 First / Then / What’s more / Finally 等连接词'];

async function request(body?:unknown):Promise<CourseData>{
 const r=await fetch('/api/course',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'暂时无法保存，请重试');return data;
}
async function listen(task:string,body?:unknown){const r=await fetch('/api/listen'+(body?'':'?task='+encodeURIComponent(task)),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'播放失败');return d}
const clock=(s:number)=>{const t=Math.max(0,Math.ceil(s-0.05));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
function useNow(active:boolean){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{if(!active)return;const t=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(t)},[active]);return now}

// AI 返回的要点数量或顺序可能和导图不一致：先按要点名称匹配，数量一致时才按顺序对应。
const normLabel=(s:string)=>s.split(/[:：]/)[0].toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g,'');
function matchPoint(points:AiAssessment['points'],label:string,index:number,total:number){if(!points?.length)return undefined;const key=normLabel(label);return points.find(p=>normLabel(p.label)===key)||points.find(p=>{const l=normLabel(p.label);return !!l&&(l.includes(key)||key.includes(l))})||(points.length===total?points[index]:undefined)}
function MindMap({slots,notes,editable,revealed,points,onChange}:{slots:string;notes:RetellNote[];editable:boolean;revealed:boolean;points?:AiAssessment['points'];onChange?:(i:number,p:Partial<RetellNote>)=>void}){
 const groups=parseMindMap(slots),total=groups.reduce((n,g)=>n+g.items.length,0);
 return <div className="mind-map">{groups.map((g,gi)=><section className="mind-branch" key={gi}>{g.title&&<h3>{g.title}</h3>}{g.items.map(item=>{const note=notes[item.index],point=matchPoint(points,item.label,item.index,total);return <div className={'mind-leaf'+(point?' '+point.status:'')} key={item.index}>
  <label>{item.label}{editable?<input value={note?.text||''} maxLength={300} placeholder="关键词 / 缩写…" onChange={e=>onChange?.(item.index,{text:e.target.value})}/>:<span className="mind-note">{note?.text||(note?.status==='missed'?'（没听到）':'—')}</span>}</label>
  {editable&&<select aria-label={`${item.label}记录情况`} value={note?.status||'noted'} onChange={e=>onChange?.(item.index,{status:e.target.value as RetellNote['status']})}><option value="noted">{note?.text.trim()?'已记录':'待记录'}</option><option value="unsure">不确定</option><option value="missed">没听到</option></select>}
  {revealed&&item.answer&&<p className="mind-answer">标准要点：<b>{answerText(item.answer)}</b>{point&&<span> · {point.status==='correct'?'✓ 记对了':point.status==='missing'?'○ 漏记':'△ 有偏差'}</span>}</p>}
  {revealed&&point?.advice&&point.status!=='correct'&&<p className="helper">{point.advice}</p>}
 </div>})}</section>)}</div>;
}

function Feedback({a}:{a:AiAssessment}){
 const points=a.points||[];
 return <div className="retell-feedback">
  {a.exam?<div className="exam-score"><strong>{Math.round((a.exam.content+a.exam.language)*10)/10}</strong><span>/ 10</span><small>内容 {a.exam.content}/6 · 语言 {a.exam.language}/4</small></div>:<h3>{points.length?`准确表达 ${points.filter(p=>p.status==='correct').length} / ${points.length} 个要点`:'本次反馈'}</h3>}
  <p>{a.summary}</p>
  {a.checks&&a.checks.length>0&&<ul className="retell-checks">{a.checks.map((c,i)=><li key={i} className={c.ok?'ok':'bad'}><b>{c.ok?'✓':'✗'} {c.item}</b>{c.note&&<span>{c.note}</span>}</li>)}</ul>}
  {points.filter(p=>p.status!=='correct').map((p,i)=><article className={'retell-point '+p.status} key={i}><b>{p.status==='missing'?'○ 遗漏':'△ 需修正'} · {p.label}</b>{p.studentEvidence&&<p>你的表达：{p.studentEvidence}</p>}{p.advice&&<p>{p.advice}</p>}<details><summary>查看材料依据</summary><p>{p.sourceEvidence||'请结合原文核对。'}</p></details></article>)}
  {a.strengths.length>0&&<p>做得好的地方：{a.strengths.join('；')}</p>}
  {a.improvements.length>0&&<><h4>下次先改这些</h4><ul>{a.improvements.map((p,i)=><li key={i}>{p}</li>)}</ul></>}
 </div>;
}

type ExamClock={phase:'intro'|'preview'|'listen'|'answer';previewEnd?:number;answerEnd?:number;plays?:number};

export function RetellModePractice({task,sample,initial,onClose,onRefresh,page=false,userId=''}:{task:Task;sample:boolean;initial?:Submission;onClose:()=>void;onRefresh:()=>Promise<void>;page?:boolean;userId?:string}){
 const [material,setMaterial]=useState(task.material),[sub,setSub]=useState(initial);
 const cfg=material.retellConfig!;
 const [previewMode,setPreviewMode]=useState<RetellMode>('guided');const mode:RetellMode=cfg.mode||previewMode;
 const opening=cfg.opening||'';
 const [answers,setAnswers]=useState<Record<string,string>>(()=>sample?{}:{...initial?.answers,...initial?.corrections});
 const submitted=!sample&&!!sub&&sub.state!=='draft';
 const [revision,setRevision]=useState(false),[sampleChecked,setSampleChecked]=useState(false),[sampleDone,setSampleDone]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('草稿自动保存'),[checks,setChecks]=useState<Record<number,boolean>>({});
 const latest=useRef(answers),timer=useRef<ReturnType<typeof setTimeout>|null>(null),dirty=useRef(false);
 const notes=readNotes(answers.retellNotes),labelsCount=parseMindMap(cfg.slots).reduce((n,g)=>n+g.items.length,0);
 const notesChecked=sample?sampleChecked:answers.notesChecked==='1'||sub?.answers.notesChecked==='1';
 const result=sub?.revisionAssessment||sub?.aiAssessment;
 const assessmentState=sub?.corrections.retell?sub?.revisionAssessmentState:sub?.assessmentState;
 const done=sample?sampleDone:submitted&&!revision;

 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>{window.removeEventListener('beforeunload',warn);if(timer.current)clearTimeout(timer.current)}},[]);
 async function save(a=latest.current){if(sample||revision||submitted)return;setSaved('正在保存…');try{await request({op:'draft',task:task.id,answers:a});if(latest.current===a){dirty.current=false;setSaved('草稿已保存')}}catch(e){setSaved('保存失败，请稍后再试');throw e}}
 function change(next:Record<string,string>){latest.current=next;setAnswers(next);dirty.current=true;if(timer.current)clearTimeout(timer.current);if(!sample&&!revision)timer.current=setTimeout(()=>{save(next).catch(()=>{})},900);else setSaved(sample?'老师试做，不保存成绩':'订正中，提交后再次评测')}
 function changeNote(i:number,p:Partial<RetellNote>){const next=Array.from({length:labelsCount},(_,j)=>({...(notes[j]||{text:'',status:'noted' as const}),...(i===j?p:{})}));change({...latest.current,retellNotes:JSON.stringify(next)})}
 async function refresh(){const data=await request();const s=data.submissions.find(s=>s.task===task.id);setSub(s);const t=data.tasks.find(t=>t.id===task.id);if(t)setMaterial(t.material);if(s){const next={...s.answers,...s.corrections};latest.current=next;setAnswers(next)}await onRefresh()}
 function notesComplete(){return Array.from({length:labelsCount},(_,i)=>notes[i]).every(n=>n&&(n.text.trim()||n.status==='missed'))}

 async function checkNotes(){
  if(!notesComplete()){setError('请给每个要点记录关键词；没听到的选择“没听到”。');return}
  setError('');if(sample){setSampleChecked(true);if(!latest.current.retell)change({...latest.current,retell:opening+' '});return}
  setBusy(true);if(timer.current)clearTimeout(timer.current);
  try{await request({op:'checkNotes',task:task.id,notes:latest.current.retellNotes});dirty.current=false;await refresh();if(!latest.current.retell?.trim())change({...latest.current,retell:opening+' '})}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function submit(auto=false){
  const a={...latest.current};const text=(a.retell||'').trim();
  if(!auto&&(!text||text===opening.trim())){setError('请先完成英文转述。');return}
  if(auto&&!text)a.retell=opening||'(time is up)';
  if(mode==='exam'&&!revision)a.examLog=JSON.stringify({plays:clockState.plays||0,answerSeconds:clockState.answerEnd?Math.round(EXAM_ANSWER_SECONDS-(clockState.answerEnd-Date.now())/1000):0,timedOut:auto});
  setError('');if(sample){setSampleDone(true);return}
  setBusy(true);if(timer.current)clearTimeout(timer.current);
  try{await request({op:revision?'correct':'submit',task:task.id,answers:a});dirty.current=false;setRevision(false);try{localStorage.removeItem(clockKey)}catch{}await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function close(){if(busy)return;try{if(dirty.current&&!revision&&!sample&&!submitted)await save()}catch{}onClose()}

 // 全真模拟计时：保存在本机，刷新后按剩余时间继续。
 const clockKey=`ed-exam:${userId}:${task.id}`;
 const [clockState,setClockState]=useState<ExamClock>({phase:'intro'});
 useEffect(()=>{if(sample)return;try{const saved=JSON.parse(localStorage.getItem(clockKey)||'null');if(saved?.phase)setClockState(saved)}catch{}},[clockKey,sample]);
 function setClock(c:ExamClock){setClockState(c);if(!sample)try{localStorage.setItem(clockKey,JSON.stringify(c))}catch{}}
 const examRunning=mode==='exam'&&!done&&!revision&&(clockState.phase==='preview'||clockState.phase==='answer');
 const now=useNow(examRunning);
 const previewLeft=clockState.previewEnd?(clockState.previewEnd-now)/1000:EXAM_PREVIEW_SECONDS,answerLeft=clockState.answerEnd?(clockState.answerEnd-now)/1000:EXAM_ANSWER_SECONDS;
 const autoSubmitted=useRef(false);
 useEffect(()=>{if(mode!=='exam'||done||revision)return;if(clockState.phase==='preview'&&previewLeft<=0)setClock({...clockState,phase:'listen'});if(clockState.phase==='answer'&&answerLeft<=0&&!autoSubmitted.current&&!busy){autoSubmitted.current=true;submit(true)}});
 function startAnswer(plays:number){setClock({...clockState,phase:'answer',plays,answerEnd:Date.now()+EXAM_ANSWER_SECONDS*1000});if(!latest.current.retell?.trim())change({...latest.current,retell:opening+' '})}

 function revise(){const next={...sub?.answers,...sub?.corrections};latest.current=next;setAnswers(next);setRevision(true);setChecks({});setError('');setSaved('订正不计时；首次成绩保留')}

 const writing=<section className="retell-card" id="retell-expression"><h2>{mode==='exam'&&!revision?'整理并作答':'第三步 · 用开头句组织转述'}</h2>
  <p className="retell-opening">给定开头：<b>{opening}</b></p>
  {mode==='guided'&&<details className="retell-tips" open={!revision}><summary>转述小贴士：人称与时态</summary><ul><li>原文对听众说 <i>you should…</i> → 转述说 <i>we should…</i></li><li>说话人说 <i>I…</i> → 转述说 <i>he / she / the speaker…</i>；<i>my</i> → <i>his / her</i></li><li>通知、活动安排 → 一般将来时（will / be going to）；讲经历 → 一般过去时</li><li>按导图顺序说：First… Then… What’s more… Finally…</li></ul></details>}
  <label>我的英文转述<textarea rows={10} maxLength={10000} value={answers.retell||''} disabled={busy} placeholder={opening} onChange={e=>change({...answers,retell:e.target.value})}/></label>
  <p className="helper">{(answers.retell||'').trim().split(/\s+/).filter(Boolean).length} 词 · 真实考试口头转述约 100 秒到 2 分钟，参考长度 70–110 词。</p>
 </section>;

 const checklist=<section className="retell-card" id="retell-check"><h2>提交前检查</h2>{checkTips.map((s,i)=><label className="retell-check" key={s}><input type="checkbox" checked={!!checks[i]} onChange={e=>setChecks({...checks,[i]:e.target.checked})}/>{s}</label>)}<p className="helper">自查不计分。{revision?'这是订正练习，首次答案和成绩会保留。':''}</p></section>;

 const feedback=<section className="retell-card" aria-live="polite"><h2>{sample?'试做已完成':sub?.revisionAssessment?'订正反馈':mode==='exam'?'模拟成绩与点评':'AI 点评'}</h2>
  {sample?<p>学生提交后，AI 会核对每个要点，检查开头句、人称、时态、完整句和连接，并给出两条最值得改的建议{mode==='exam'?'，同时按 10 分制评分':''}。</p>:<>
  {assessmentState==='failed'&&<p role="alert">本次 AI 评测未成功，答案已保存。可以点“重新评测”，或等待老师批改。</p>}
  {assessmentState==='paused'&&<p>老师已暂停自动评测，答案已保留，等待老师批改。</p>}
  {!result&&assessmentState!=='failed'&&assessmentState!=='paused'&&<p>答案已提交，等待评测或老师批改。</p>}
  {result&&<Feedback a={result}/>}
  {sub?.revisionAssessment&&sub.aiAssessment&&<p className="helper">首次成绩保留：{sub.aiAssessment.exam?`${Math.round((sub.aiAssessment.exam.content+sub.aiAssessment.exam.language)*10)/10} / 10`:`${sub.aiAssessment.score} / 100`}。订正可能参考了反馈，不等同于独立测试成绩。</p>}
  <p>{sub?.correction_status==='required'?'请根据反馈修改，再提交一次。':sub?.correction_status==='pending'?'等待老师确认。':''}</p>
  {sub?.feedback&&<details><summary>查看完整评语 / 老师反馈</summary><p className="retell-text">{sub.feedback}</p></details>}
  {sub?.corrections.retell&&<details><summary>查看首次作答</summary><p className="retell-text">{sub.answers.retell}</p></details>}
  {sub?.unreadFeedback&&<button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await request({op:'readFeedback',id:sub.id,version:sub.feedback_updated});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>我已看过反馈</button>}</>}
  {answers.retellNotes&&<details><summary>我的导图笔记与标准要点</summary><MindMap slots={cfg.slots} notes={notes} editable={false} revealed points={sub?.notesAssessment?.points}/></details>}
  {(material.body||cfg.referenceRetell)&&<details className="retell-reference"><summary>查看原文与参考转述</summary><p className="helper">建议先根据反馈自己修改。参考转述不是唯一答案。</p>{material.body&&<><h3>听力原文</h3><p className="retell-text">{material.body}</p></>}{cfg.referenceRetell&&<><h3>参考转述</h3><p className="retell-text">{cfg.referenceRetell}</p></>}</details>}
 </section>;

 let content;
 if(done)content=feedback;
 else if(mode==='guided'||revision){
  const step=revision?3:notesChecked?3:1;
  content=<>{!revision&&<ol className="retell-progress"><li className={step===1?'active':'done'}>听音记要点</li><li className={notesChecked?'done':''}>AI 核对要点</li><li className={step===3?'active':''}>组织转述</li><li>AI 点评</li></ol>}
   {!notesChecked&&!revision&&<><section className="retell-card"><h2>第一步 · 听音频，把要点记进导图</h2><p>可以反复听、调语速。优先记<b>动词 + 关键名词 + 时间地点数字</b>，用缩写和符号；听不清的标“不确定”，完全没听到的标“没听到”。录音播放器在导图下方。</p></section>
    <section className="retell-card" id="retell-notes"><h2>思维导图笔记</h2><MindMap slots={cfg.slots} notes={notes} editable={!busy} revealed={false} onChange={changeNote}/></section></>}
   {notesChecked&&!revision&&<section className="retell-card" id="retell-notes"><h2>第二步 · 对照标准要点</h2>{sample&&<p className="helper">老师试做：此处直接显示标准要点，不调用 AI。</p>}
    {!sample&&sub?.notesAssessmentState==='complete'&&sub.notesAssessment&&<p>{sub.notesAssessment.summary}</p>}
    {!sample&&sub?.notesAssessmentState==='failed'&&<p className="helper">AI 核对暂时没有成功，下面先给出标准要点，你可以自己对照。</p>}
    {!sample&&sub?.notesAssessmentState==='paused'&&<p className="helper">老师暂停了 AI 核对，请自行对照标准要点。</p>}
    <MindMap slots={cfg.slots} notes={notes} editable={false} revealed points={sub?.notesAssessment?.points}/>
    {!sample&&sub?.notesAssessment?.improvements.length?<><h4>听的时候注意</h4><ul>{sub.notesAssessment.improvements.map((x,i)=><li key={i}>{x}</li>)}</ul></>:null}
    <p className="helper">记错或漏掉的要点，组织转述时用标准要点；可以再听一遍原音频找到它。</p></section>}
   {(notesChecked||revision)&&<>{writing}{checklist}</>}</>;
 }else{
  const phase=clockState.phase;
  content=<>
   <ol className="retell-progress exam"><li className={phase==='intro'?'active':'done'}>说明</li><li className={phase==='preview'?'active':phase==='intro'?'':'done'}>看导图 1 分钟</li><li className={phase==='listen'?'active':phase==='answer'?'done':''}>连听 3 遍</li><li className={phase==='answer'?'active':''}>整理作答 {EXAM_ANSWER_SECONDS/60} 分钟</li></ol>
   {phase==='intro'&&<section className="retell-card"><h2>全真模拟 · 听后转述</h2><ul><li>先用 1 分钟看思维导图和开头句。</li><li>原文<b>连续播放 3 遍</b>，不能暂停或拖动；边听边在导图里记笔记。</li><li>听完后有 {EXAM_ANSWER_SECONDS/60} 分钟整理并写出转述，<b>时间到自动提交</b>。真实考试是准备 2 分钟 + 口头转述约 2 分钟；打字比说话慢，所以这里多给一些时间。</li><li>开始后请不要离开页面。刷新后计时会继续。</li></ul><button className="btn" onClick={()=>setClock({phase:'preview',previewEnd:Date.now()+EXAM_PREVIEW_SECONDS*1000})}>开始模拟</button></section>}
   {phase==='preview'&&<div className="exam-timer" role="timer">看导图 · 剩余 {clock(previewLeft)}</div>}
   {phase==='answer'&&<div className={'exam-timer'+(answerLeft<60?' urgent':'')} role="timer">整理作答 · 剩余 {clock(answerLeft)}</div>}
   {phase==='answer'&&writing}
   {phase!=='intro'&&<section className="retell-card" id="retell-notes"><h2>{phase==='answer'?'我的导图笔记':'思维导图（可记笔记）'}</h2><MindMap slots={cfg.slots} notes={notes} editable={!busy} revealed={false} onChange={changeNote}/></section>}
  </>;
 }

 const phaseNow=clockState.phase,examLive=mode==='exam'&&!revision&&!done;
 const split=!done&&!(examLive&&phaseNow==='intro');
 const tipsAllowed=!examLive;// 全真模拟进行中不看技巧，和考场一致
 const audio=examLive?(phaseNow==='listen'?<ExamAudio task={{...task,material}} sample={sample} onDone={startAnswer}/>:null):<LessonAudio task={{...task,material}} sample={sample}/>;
 const body=<div className={'retell-practice retell-v2'+(split?' has-split':'')}>
  <header className="retell-heading"><span className="tag orange">北京中考 · 听后转述</span><h1>{material.title}</h1><h2>{retellModeTitles[mode]}</h2>
   <p>{mode==='guided'?'先听音频把要点记进思维导图，AI 核对后给出标准要点；再用给定开头组织一段完整的英文转述，AI 会点评要点、人称、时态和连贯性。':'按考试流程完成：看导图、连听三遍、限时作答。AI 按北京中考 10 分制（内容 6 + 语言 4）评分。'}</p>
   <p className="helper">当前以文字作答，不评价发音；意思准确、句子完整比复杂句更重要。</p>
   {sample&&!cfg.mode&&<div className="retell-preview-switch">老师试做：{(['guided','exam'] as const).map(m=><button key={m} className={'btn secondary'+(previewMode===m?' active':'')} onClick={()=>{setPreviewMode(m);setSampleChecked(false);setSampleDone(false);setClockState({phase:'intro'})}}>{m==='guided'?'转述训练':'全真模拟'}</button>)}</div>}
   {sample&&<p className="helper">老师试做 · 不调用 AI、不保存学生成绩</p>}
  </header>
  {split?<div className="retell-split"><RetellReference material={material} slots={cfg.slots} opening={opening} tips={tipsAllowed} timer={examLive&&phaseNow==='preview'?'看导图 '+clock(previewLeft):examLive&&phaseNow==='answer'?'作答剩余 '+clock(answerLeft):''}>{audio}</RetellReference><div className="retell-work">{content}</div></div>:content}
  {error&&<p className="error-text" role="alert">{error}</p>}
  <footer className="retell-actions"><span role="status" className={error?'error-text':''}>{error||(busy?'正在保存或评测，请稍候…':done?'先看反馈，再决定如何修改':saved)}</span><div>
   {done?<>{!sample&&['failed','paused','running'].includes(assessmentState||'')&&<button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await request({op:'retryRetell',task:task.id});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>重新评测</button>}<button className="btn" disabled={busy} onClick={()=>sample?(setSampleDone(false),setSampleChecked(false),setClockState({phase:'intro'})):revise()}>{sample?'重新试做':'根据反馈再练一次'}</button></>
   :mode==='guided'&&!notesChecked&&!revision?<><button className="btn" disabled={busy} onClick={checkNotes}>{busy?'AI 正在核对…':'完成笔记，核对要点'}</button></>
   :mode==='exam'&&!revision&&clockState.phase!=='answer'?null
   :<><button className="btn" disabled={busy} onClick={()=>submit(false)}>{sample?'完成试做':revision?'提交订正并评测':'提交并查看点评'}</button></>}
  </div></footer>
 </div>;
 return page?<main className="practice-page retell-page"><nav className="practice-page-nav"><button className="btn secondary" disabled={busy||examRunning} onClick={close}>← 返回作业</button><span>听力练习 · English Daily</span></nav>{body}</main>:<Dialog open onOpenChange={open=>{if(!open)close()}}><DialogContent className="practice-dialog"><DialogTitle className="sr-only">听后转述试做</DialogTitle><DialogDescription className="sr-only">预览转述训练或全真模拟流程，不保存成绩。</DialogDescription>{body}</DialogContent></Dialog>;
}

// 连续播放三遍：每遍向服务器领取一次播放凭证；遍与遍之间停顿 2 秒，与考试一致不能暂停或拖动。
function ExamAudio({task,sample,onDone}:{task:Task;sample:boolean;onDone:(plays:number)=>void}){
 const ref=useRef<HTMLAudioElement>(null),blob=useRef(''),[played,setPlayed]=useState(0),[ready,setReady]=useState(sample),[playing,setPlaying]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(0);
 const playedRef=useRef(0);
 useEffect(()=>{if(sample)return;listen(task.id).then(d=>{playedRef.current=Math.min(d.count,EXAM_PLAYS);setPlayed(playedRef.current);setReady(true);if(d.count>=EXAM_PLAYS)onDone(d.count)}).catch(e=>setError(e.message));return()=>{if(blob.current)URL.revokeObjectURL(blob.current)}},[task.id,sample]);
 async function play(){
  const a=ref.current;if(!a||busy)return;setBusy(true);setError('');
  try{let src=task.material.audio;if(!sample){const d=await listen(task.id,{task:task.id});const r=await fetch(d.url);if(!r.ok)throw Error('音频加载失败');if(blob.current)URL.revokeObjectURL(blob.current);blob.current=URL.createObjectURL(await r.blob());src=blob.current}
   a.src=src;a.currentTime=0;playedRef.current+=1;setPlayed(playedRef.current);await a.play();setPlaying(true)}
  catch(e){setError((e as Error).name==='NotAllowedError'?'浏览器拦截了自动播放，请点击按钮继续播放。':(e as Error).message+'；如果次数已用完但没听到，请联系老师补充。')}
  finally{setBusy(false)}
 }
 function ended(){setPlaying(false);setProgress(0);if(playedRef.current>=EXAM_PLAYS){onDone(playedRef.current);return}setTimeout(()=>{play()},2000)}
 return <section className="lesson-audio-bar exam-audio" aria-label="考试录音播放"><div className="audio-main"><b>原文录音 · 第 {Math.max(1,Math.min(played,EXAM_PLAYS))} / {EXAM_PLAYS} 遍</b><span className="helper">{playing?'正在播放，请边听边记':played?'下一遍即将开始…':'准备好后开始，三遍连续播放'}</span>
  <audio ref={ref} onEnded={ended} onTimeUpdate={()=>{const a=ref.current;if(a&&a.duration)setProgress(a.currentTime/a.duration)}}/>
  {!playing&&ready&&played<EXAM_PLAYS&&<button className="btn audio-play-primary" disabled={busy} onClick={play}>{busy?'正在加载…':played?'继续播放第 '+(played+1)+' 遍':'开始播放'}</button>}</div>
  <progress className="audio-timeline" value={progress} max={1}/>{error&&<p className="error-text" role="alert">{error}</p>}</section>;
}

// 导图与录音参考区：电脑端固定在左侧；手机端在顶部，滑走后可用悬浮按钮把它固定在屏幕上方。
function RetellReference({material,slots,opening,tips,timer,children}:{material:Material;slots:string;opening:string;tips:boolean;timer:string;children:ReactNode}){
 const box=useRef<HTMLElement>(null),slot=useRef<HTMLDivElement>(null),[pinned,setPinned]=useState(false),[away,setAway]=useState(false),[height,setHeight]=useState(0),[zoom,setZoom]=useState<{url:string;scale:number}|null>(null);
 useEffect(()=>{const el=slot.current;if(!el||typeof IntersectionObserver==='undefined')return;const o=new IntersectionObserver(([e])=>setAway(!e.isIntersecting&&e.boundingClientRect.top<0),{threshold:0});o.observe(el);return()=>o.disconnect()},[]);
 useEffect(()=>{if(!zoom)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setZoom(null)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[zoom]);
 const images=material.images||[],groups=parseMindMap(slots);
 function pin(){setHeight(box.current?.offsetHeight||0);setPinned(true)}
 return <div className="retell-ref-slot" ref={slot} style={pinned&&height?{minHeight:height}:undefined}>
  <aside ref={box} className={'retell-ref'+(pinned?' pinned':'')} aria-label="思维导图与录音">
   {pinned&&<div className="retell-ref-bar"><b>{timer||'导图已固定在顶部'}</b><button className="btn secondary" onClick={()=>setPinned(false)}><X size={16}/>收起</button></div>}
   {images.length?images.map((im,i)=><figure className="retell-ref-image" key={im.url}><button type="button" onClick={()=>setZoom({url:im.url,scale:1})} aria-label={`放大查看思维导图 ${i+1}`}><img src={im.url} alt={im.caption||'思维导图'}/><span className="retell-ref-zoom"><Maximize2 size={14}/>放大</span></button></figure>)
    :<div className="retell-ref-outline"><b>导图结构</b>{groups.map((g,i)=><div key={i}>{g.title&&<p className="retell-ref-branch">{g.title}</p>}<ul>{g.items.map(it=><li key={it.index}>{it.label}</li>)}</ul></div>)}</div>}
   <p className="retell-opening">给定开头：<b>{opening}</b></p>
   {children}
   {tips&&<TipsButton section="retell" label="缩写清单与转述技巧"/>}
  </aside>
  {away&&!pinned&&<button className="retell-ref-fab" onClick={pin} aria-label="把导图固定在屏幕上方"><MapIcon size={18}/>导图</button>}
  {zoom&&<div className="retell-lightbox" role="dialog" aria-modal="true" aria-label="思维导图大图" onClick={e=>{if(e.target===e.currentTarget)setZoom(null)}}>
   <div className="retell-lightbox-tools"><button onClick={()=>setZoom({...zoom,scale:Math.max(1,zoom.scale-0.5)})} aria-label="缩小"><Minus size={18}/></button><span>{Math.round(zoom.scale*100)}%</span><button onClick={()=>setZoom({...zoom,scale:Math.min(3,zoom.scale+0.5)})} aria-label="放大"><Plus size={18}/></button><button onClick={()=>setZoom(null)} aria-label="关闭"><X size={18}/></button></div>
   <div className="retell-lightbox-scroll"><img src={zoom.url} alt="思维导图大图" style={{width:zoom.scale*100+'%'}}/></div>
  </div>}
 </div>;
}
