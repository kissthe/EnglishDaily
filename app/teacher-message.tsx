'use client';
import {useEffect,useState} from 'react';
import type {Settings} from '@/lib/course';

export function TeacherMessage({settings,editable=false,onRefresh}:{settings:Settings;editable?:boolean;onRefresh?:()=>Promise<void>}){
 const [message,setMessage]=useState(settings.teacherMessage||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 useEffect(()=>{setMessage(settings.teacherMessage||'')},[settings.teacherMessage]);
 async function save(){setBusy(true);setError('');setSaved('');try{const r=await fetch('/api/course',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'teacherMessage',message})});const d=await r.json();if(!r.ok)throw Error(d.error||'留言保存失败');await onRefresh?.();setSaved(message.trim()?'留言已发布，学生首页可见。':'留言已清空。')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel teacher-message-board" aria-label="老师留言板"><div className="section-heading"><h2>老师留言板</h2>{settings.teacherMessageUpdated&&<small className="helper">更新于 {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(settings.teacherMessageUpdated))}</small>}</div>
  {editable?<><p className="helper">学习安排、休息通知或提醒会显示在学生首页，即使今天没有作业。清空内容后保存可撤下留言。</p><label>给学生的留言<textarea rows={4} maxLength={5000} value={message} disabled={busy} placeholder="例如：这周的作业已完成，周末休息，下周一继续。" onChange={e=>{setMessage(e.target.value);setSaved('')}}/></label><button className="btn" disabled={busy} onClick={save}>{busy?'正在发布…':'保存留言'}</button>{error&&<p role="alert" className="error-text">{error}</p>}{saved&&<p role="status" className="success-text">{saved}</p>}</>:<p className={settings.teacherMessage?'teacher-message-text':'helper'}>{settings.teacherMessage||'老师暂时没有新的留言。'}</p>}
 </section>;
}
