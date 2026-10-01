'use client';
import {useState} from 'react';
import {TeacherMessage} from './teacher-message';
import {retellTitles} from '@/lib/retell';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {today,offsetDate,taskStatus,type CourseData,type Task} from '@/lib/course';
export function StudentWork({data}:{data:CourseData}){
 const [tab,setTab]=useState('today'),[date,setDate]=useState('');
 const sub=(t:Task)=>data.submissions.find(s=>s.task===t.id);
 const todayTasks=data.tasks.filter(t=>t.date===today());
 const overdue=data.tasks.filter(t=>t.date<today()&&(!sub(t)||sub(t)?.state==='draft'));
 const corrections=data.tasks.filter(t=>taskStatus(sub(t))==='待订正');
 const unread=data.tasks.filter(t=>sub(t)?.unreadFeedback);
 function row(t:Task){const s=sub(t),status=taskStatus(s);return <a className="student-task" href={'/practice/'+encodeURIComponent(t.id)} key={t.id}><div><span className="helper">{t.material.retellConfig?'听力 · '+retellTitles[t.material.retellConfig.stage]:t.material.kind} · {t.date}</span><h2>{t.material.title}</h2><span className={'task-status status-'+status}>{status}{s?.unreadFeedback?' · 新反馈':''}</span></div><span className="student-task-action">{s?.unreadFeedback?'查看反馈':status==='待订正'?'开始订正':status==='进行中'?'继续作答':status==='待完成'?'开始练习':'查看作业'} →</span></a>}
 const completed=todayTasks.filter(t=>sub(t)&&sub(t)?.state!=='draft').length;
 return <><div className="page-heading student-heading"><div><h1>我的作业</h1><p>今天已提交 {completed}/{todayTasks.length} 项</p></div></div>
 <TeacherMessage settings={data.settings}/>{unread.length>0&&<section className="student-notice"><b>你有 {unread.length} 份新反馈</b><div>{unread.map(t=><a href={'/practice/'+encodeURIComponent(t.id)} key={t.id}>{t.material.title} →</a>)}</div></section>}
 <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="today">今天</TabsTrigger><TabsTrigger value="corrections">待订正{corrections.length?' · '+corrections.length:''}</TabsTrigger><TabsTrigger value="history">历史</TabsTrigger></TabsList>
 <TabsContent value="today"><div className="student-task-list">{todayTasks.map(row)}</div>{!todayTasks.length?<div className="student-empty"><h2>今天没有新作业</h2><p>有待订正或之前未交的作业时，可以先处理。</p></div>:completed===todayTasks.length&&<p className="student-complete">今天的作业已全部提交。记得查看学习反馈，完成需要订正的练习。</p>}{overdue.length>0&&<section><h2 className="student-section-title">之前未交 · {overdue.length}</h2>{overdue.map(row)}</section>}</TabsContent>
 <TabsContent value="corrections">{corrections.length?corrections.map(row):<div className="student-empty"><h2>暂时没有待订正作业</h2><p>提交的订正如需老师确认，会显示为“待批改”。</p></div>}</TabsContent>
 <TabsContent value="history"><label className="history-filter">按日期查找<input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className="text-link" onClick={()=>setDate('')}>全部日期</button></label>{data.tasks.filter(t=>!date||t.date===date).map(row)}{!data.tasks.some(t=>!date||t.date===date)&&<p className="student-empty">没有符合日期的作业。</p>}</TabsContent></Tabs>
 <details className="student-week"><summary>本周学习回顾</summary><p>最近 7 天提交 {data.submissions.filter(s=>s.state!=='draft'&&s.submitted&&new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(s.submitted))>=offsetDate(today(),-6)).length} 份作业；还有 {corrections.length} 份待订正。</p><p>需要时可以到收藏夹打印单词与句子复习。</p></details></>
}
