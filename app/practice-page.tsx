'use client';
import {useEffect,useState} from 'react';
import {Toaster} from 'sonner';
import {Practice} from './daily-app';
import type {CourseData} from '@/lib/course';
export function PracticePage({id}:{id:string}){
 const [data,setData]=useState<CourseData|null>(null),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/course',{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error||'无法加载作业');setData(d)}
 useEffect(()=>{load().catch(e=>setError(e.message))},[id]);
 const task=data?.tasks.find(t=>t.id===id);
 if(error||data&&!task)return <main className="student-empty"><h1>暂时无法打开作业</h1><p>{error||'作业尚未开放或不存在。'}</p><a className="btn secondary" href="/">返回作业 / 登录</a></main>;
 if(!task||!data)return <main className="student-empty"><p>正在加载作业…</p></main>;
 return <><Toaster position="top-center"/><Practice page userId={data.userId||data.email} task={task} sample={data.role==='teacher'} initial={data.submissions.find(s=>s.task===id)} onRefresh={load} onClose={()=>window.location.assign('/')}/></>
}
