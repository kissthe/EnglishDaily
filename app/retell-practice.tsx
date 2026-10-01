'use client';
import {useEffect,useRef,useState} from 'react';
import type {AiAssessment,CourseData,Submission,Task} from '@/lib/course';
import {notesText,readNotes,retellTitles,slotLabels,type RetellNote} from '@/lib/retell';
import {ListeningImages} from './listening-images';
import {LessonAudio} from './lesson-media';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

async function request(body?:unknown):Promise<CourseData>{
 const r=await fetch('/api/course',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'暂时无法保存，请重试');return data;
}
function Feedback({assessment,stage}:{assessment:AiAssessment;stage:number}){
 const points=assessment.points||[];
 return <div className="retell-feedback"><h3>{points.length?`准确表达 ${points.filter(p=>p.status==='correct').length} / ${points.length} 个信息点`:'本次反馈'}</h3><p>{assessment.summary}</p>
 {points.map((p,i)=><article className={'retell-point '+p.status} key={i}><b>{p.status==='correct'?'✓ 已表达':p.status==='missing'?'○ 遗漏':'△ 需修正'} · {p.label}</b>{p.studentEvidence&&<p>你的表达：{p.studentEvidence}</p>}{p.advice&&<p>{p.advice}</p>}<details><summary>查看材料依据</summary><p>{p.sourceEvidence||'请结合原文核对。'}</p></details></article>)}
 {!points.length&&assessment.missingPoints.length>0&&<ul>{assessment.missingPoints.map((p,i)=><li key={i}>{p}</li>)}</ul>}
 {assessment.strengths.length>0&&<p>做得好的地方：{assessment.strengths.join('；')}</p>}
 {assessment.improvements.length>0&&<><h4>这次先改这些</h4><ul>{assessment.improvements.map((p,i)=><li key={i}>{p}</li>)}</ul></>}
 <details><summary>{stage===1?'查看信息获取评分':'查看分项评分'}</summary><p>信息 {assessment.dimensions.information}{stage!==1&&` · 顺序 ${assessment.dimensions.organization} · 语言 ${assessment.dimensions.language} · 连贯 ${assessment.dimensions.coherence}`}</p></details>
 </div>;
}

export function RetellPractice({task,sample,initial,onClose,onRefresh,page=false,userId=''}:{task:Task;sample:boolean;initial?:Submission;onClose:()=>void;onRefresh:()=>Promise<void>;page?:boolean;userId?:string}){
 const [material,setMaterial]=useState(task.material),[sub,setSub]=useState(initial);
 const cfg=material.retellConfig!,labels=slotLabels(cfg.slots);
 const [answers,setAnswers]=useState<Record<string,string>>(sample?{}:{...initial?.answers,...initial?.corrections});
 const [editing,setEditing]=useState(sample||!initial||initial.state==='draft'),[revision,setRevision]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('草稿自动保存');
 const [recovery,setRecovery]=useState<{answers:Record<string,string>;revision:boolean}|null>(null),[checks,setChecks]=useState<Record<number,boolean>>({});
 const latest=useRef(answers),dirty=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),queue=useRef(Promise.resolve());
 const key=`ed-retell:${userId}:${task.id}`;
 const notes=readNotes(answers.retellNotes),legacyNotes=cfg.stage===1&&!answers.retellNotes&&!!answers.retell;
 const result=sub?.revisionAssessment||sub?.aiAssessment;
 const assessmentState=sub?.corrections.retell?sub?.revisionAssessmentState:sub?.assessmentState;
 const failed=assessmentState==='failed',stalled=assessmentState==='running',pausedAssessment=assessmentState==='paused';
 useEffect(()=>{if(sample)return;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&value.at>Date.parse(initial?.updated||'1970-01-01')&&value.answers&&(!initial||initial.state==='draft'||value.revision))setRecovery(value)}catch{}},[key,sample]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>{window.removeEventListener('beforeunload',warn);if(timer.current)clearTimeout(timer.current)}},[]);
 function clearDraft(){try{localStorage.removeItem(key)}catch{}}
 function cache(a:Record<string,string>,isRevision=revision){if(sample)return;try{localStorage.setItem(key,JSON.stringify({answers:a,revision:isRevision,at:Date.now()}))}catch{setSaved('本地备份不可用，请及时保存')}}
 async function save(a=latest.current){
  if(sample||revision)return;setSaved('正在保存…');
  const next=queue.current.catch(()=>{}).then(async()=>{await request({op:'draft',task:task.id,answers:a});if(latest.current===a){dirty.current=false;setSaved('草稿已保存');clearDraft()}});queue.current=next;
  try{await next}catch(e){setSaved('保存失败，请点击保存草稿重试');throw e}
 }
 function change(next:Record<string,string>){latest.current=next;setAnswers(next);dirty.current=true;cache(next);if(timer.current)clearTimeout(timer.current);if(!sample&&!revision)timer.current=setTimeout(()=>{save(next).catch(()=>{})},900);else setSaved(sample?'老师试做，不保存成绩':'订正草稿已在本机备份');}
 function changeNote(i:number,patch:Partial<RetellNote>){const next=labels.map((_,j)=>({...notes[j]||{text:'',status:'noted' as const},...(i===j?patch:{})}));change({...latest.current,retellNotes:JSON.stringify(next),...(cfg.stage===1?{retell:notesText(labels,next)}:{})})}
 async function refresh(){const data=await request();setSub(data.submissions.find(s=>s.task===task.id));const t=data.tasks.find(t=>t.id===task.id);if(t)setMaterial(t.material);await onRefresh()}
 async function submit(){
  if(cfg.stage!==2&&!legacyNotes&&labels.some((_,i)=>!notes[i]?.text.trim()&&notes[i]?.status!=='missed')){setError('请记录每项要点；没有听到的项目可以选择“没听到”。');return}
  if(cfg.stage!==1&&!answers.retell?.trim()){setError('请先写一段英文转述。');return}
  if(cfg.stage===1&&legacyNotes&&!answers.retell?.trim()){setError('请填写听力笔记。');return}
  setError('');if(sample){setEditing(false);return}setBusy(true);if(timer.current)clearTimeout(timer.current);
  try{await queue.current.catch(()=>{});await request({op:revision?'correct':'submit',task:task.id,answers:latest.current});dirty.current=false;clearDraft();setRecovery(null);setEditing(false);await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function close(){if(busy)return;setBusy(true);if(timer.current)clearTimeout(timer.current);try{if(dirty.current&&!revision&&!sample)await save();onClose()}catch(e){setError((e as Error).message);setBusy(false)}}
 function revise(){const next={...sub?.answers,...sub?.corrections};latest.current=next;setAnswers(next);setRevision(true);setEditing(true);setChecks({});setSaved('修改后请提交订正；首次答案保留');setError('');}
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
 const body=<div className="retell-practice">
 <header className="retell-heading"><span className="tag orange">听力转述 · {cfg.practiceMode==='learning'?'学习练习':'限次练习'}</span><h1>{material.title}</h1><h2>阶段{cfg.stage} · {retellTitles[cfg.stage]}</h2><p>{cfg.stage===1?'本次只需要听音频并记录关键词，不必写完整句。重点是把重要信息听准确。':cfg.stage===2?'本次不用听音频。根据老师给出的要点，用简单、完整的英语重新表达。':'先听音频记录要点，再用自己的英语完成转述；笔记和转述分开保存。'}</p><p className="helper">不必背原文，意思准确比复杂句更重要。当前使用文字作答，不评价发音。</p>{sample&&<p className="helper">老师试做 · 不调用 AI、不保存学生成绩</p>}</header><ListeningImages material={material}/><nav className="retell-jump-links" aria-label="听力练习区域"><button className="btn secondary" onClick={()=>jump('retell-notes')}>{cfg.stage===2?'1 · 查看要点':'1 · 记录要点'}</button>{cfg.stage!==1&&<button className="btn secondary" onClick={()=>jump('retell-expression')}>2 · 写转述</button>}{editing&&<button className="btn secondary" onClick={()=>jump('retell-check')}>{cfg.stage===1?'2':'3'} · 检查并提交</button>}</nav>

 {recovery&&<section className="retell-card"><p>发现本机保存的较新草稿。</p><button className="btn secondary" disabled={busy} onClick={()=>{latest.current=recovery.answers;setAnswers(recovery.answers);setRevision(recovery.revision);setEditing(true);dirty.current=true;setRecovery(null);setSaved('已恢复草稿，请保存或提交')}}>恢复草稿</button> <button className="btn secondary" onClick={()=>{setRecovery(null);clearDraft()}}>使用服务器版本</button></section>}
 {cfg.stage!==2&&<section className="retell-card"><h2>听音频，带着目标记录</h2><p>{cfg.practiceMode==='learning'?'可以重听；先听懂主题，再补充细节，最后核对不确定处。':`本次允许开始播放 ${material.playLimit||'不限'} 次；暂停后继续不计次。`}</p>{material.playLimit===3&&cfg.practiceMode!=='learning'&&<p>第一遍听主题 → 第二遍记细节 → 第三遍核对不确定处。</p>}<LessonAudio task={{...task,material}} sample={sample}/></section>}
 <div className="retell-workspace"><section id="retell-notes" className="retell-card"><h2>{cfg.stage===2?'老师给出的要点':'我的听力笔记'}</h2>
 {cfg.stage===2?<p className="retell-text">{cfg.guidedKeywords}</p>:<><p className="helper">只记关键词，可以用缩写。不确定就标记，没有听到也可以继续。</p>{legacyNotes?<label>原有笔记<textarea rows={7} value={answers.retell||''} disabled={!editing||busy} maxLength={10000} onChange={e=>change({...answers,retell:e.target.value})}/></label>:labels.map((label,i)=><div className="retell-note" key={i}><label>{label}<input value={notes[i]?.text||''} maxLength={300} disabled={!editing||busy} placeholder="记录关键词…" onChange={e=>changeNote(i,{text:e.target.value})}/></label><label className="retell-note-status">记录情况<select aria-label={`${label}记录情况`} value={notes[i]?.status||'noted'} disabled={!editing||busy} onChange={e=>changeNote(i,{status:e.target.value as RetellNote['status']})}><option value="noted">{notes[i]?.text.trim()?'已记录':'待记录'}</option><option value="unsure">不确定</option><option value="missed">没听到</option></select></label></div>)}</>}
 </section>
 {cfg.stage!==1&&<section id="retell-expression" className="retell-card"><h2>我的英文转述</h2><p className="helper">先交代主题，再按时间或事情发展的顺序表达，最后补充结果或注意事项。</p><label>用自己的英语说清楚<textarea rows={10} value={answers.retell||''} maxLength={10000} disabled={!editing||busy} placeholder="用简单完整的句子，把重要信息连起来…" onChange={e=>change({...answers,retell:e.target.value})}/></label>{cfg.practiceMode!=='simulation'&&<details><summary>不会组织？看看另一个例子</summary><p>示例笔记：Saturday / museum / by bus</p><p>We will visit the museum on Saturday. We will go there by bus.</p><p>先把要点写成完整句，再按内容关系连接。只有需要时才使用 First、Then、Finally。</p></details>}</section>}
 </div>
 {editing&&<section id="retell-check" className="retell-card"><h2>提交前检查</h2>{(cfg.stage===1?['每项都记录了关键词，或标记了没听到','不确定的时间、地点和数字已核对']:['重要信息是否都用上了？','人物、时间和地点是否对应正确？','句子是否完整，顺序是否容易理解？']).map((s,i)=><label className="retell-check" key={s}><input type="checkbox" checked={!!checks[i]} onChange={e=>setChecks({...checks,[i]:e.target.checked})}/>{s}</label>)}<p className="helper">自查帮助你发现问题，不计分。{revision?'这是订正练习，首次答案和成绩会保留。':''}</p></section>}
 {!editing&&<section className="retell-card" aria-live="polite"><h2>{sample?'试做已完成':sub?.revisionAssessment?'订正反馈':'学习反馈'}</h2>{sample?<p>正式学生提交后会得到信息点核对和修改建议。</p>:<><p>{sub?.total?`首次成绩 ${sub.score} / ${sub.total}`:'首次作答已保存'}{sub?.revisionAssessment&&` · 订正表现 ${sub.revisionAssessment.score} / 100`}</p>{failed&&<p role="alert">本次 AI 评测未成功，答案已保存。可以使用下方“重新评测”，或等待老师批改。</p>}{pausedAssessment&&<p>老师已暂停自动评测，答案已保留，等待老师批改；恢复评测后可以重试。</p>}{!result&&!failed&&!pausedAssessment&&<p>答案已提交，等待评测或老师批改。</p>}{result&&<Feedback assessment={result} stage={cfg.stage}/>}<p>{sub?.correction_status==='required'?'请根据反馈修改，再提交一次。':sub?.correction_status==='pending'?'答案已保存，等待评测或老师确认。':sub?.state==='reviewed'?'本次练习已完成，也可以主动再练。':''}</p>{sub?.feedback&&<details><summary>查看完整评语 / 老师反馈</summary><p className="retell-text">{sub.feedback}</p></details>}{sub?.corrections.retell&&<details><summary>查看首次作答</summary><p className="retell-text">{sub.answers.retell}</p></details>}{sub?.revisionAssessment&&<p className="helper">订正可能使用了提示或参考答案，不等同于独立测试成绩。建议用新材料检验掌握情况。</p>}{sub?.unreadFeedback&&<button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await request({op:'readFeedback',id:sub.id,version:sub.feedback_updated});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>我已看过反馈</button>}</>}
 {(sample||material.body||cfg.referenceRetell)&&<details className="retell-reference"><summary>需要更多帮助？查看原文与参考表达</summary><p className="helper">建议先尝试根据反馈修改。参考表达不是唯一正确答案。</p>{material.body&&<><h3>听力原文</h3><p className="retell-text">{material.body}</p></>}{cfg.referenceRetell&&<><h3>{cfg.stage===1?'参考表达（本阶段不要求写完整句）':'参考转述'}</h3><p className="retell-text">{cfg.referenceRetell}</p></>}</details>}
 </section>}
 {error&&<p className="error-text" role="alert">{error}</p>}
 <footer className="retell-actions"><span role="status" className={error?'error-text':''}>{error||(busy?'正在保存或评测，请稍候…':editing?saved:'先看反馈，再决定如何修改')}</span><div>{editing?<>{!sample&&!revision&&<button className="btn secondary" disabled={busy} onClick={()=>save().catch(e=>setError(e.message))}>保存草稿</button>}<button className="btn" disabled={busy} onClick={submit}>{sample?'完成试做':revision?'提交订正并评测':'提交并查看反馈'}</button></>:<>{(failed||stalled||pausedAssessment)&&<button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await request({op:'retryRetell',task:task.id});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>重新评测</button>}<button className="btn" disabled={busy} onClick={()=>sample?setEditing(true):revise()}>{sample?'继续试做':'根据反馈再练一次'}</button></>}</div></footer>
 </div>;
 return page?<main className="practice-page retell-page"><nav className="practice-page-nav"><button className="btn secondary" disabled={busy} onClick={close}>← 返回作业</button><span>听力练习 · English Daily</span></nav>{body}</main>:<Dialog open onOpenChange={open=>{if(!open)close()}}><DialogContent className="practice-dialog"><DialogTitle className="sr-only">听力转述试做</DialogTitle><DialogDescription className="sr-only">预览学习流程，不保存成绩。</DialogDescription>{body}</DialogContent></Dialog>;
}
