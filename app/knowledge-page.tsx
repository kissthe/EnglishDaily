'use client';
import {useEffect,useState} from 'react';
import {Toaster,toast} from 'sonner';
import {CultureLab,recordActivity} from './culture-lab';
import {LessonHtml} from './interactive-html';
import type {Material} from '@/lib/course';
export function KnowledgePage({id}:{id:string}){
 const [data,setData]=useState<{role:'teacher'|'student';material:Material}|null>(null),[error,setError]=useState(''),[activities,setActivities]=useState<string[]>([]);
 useEffect(()=>{let active=true;fetch('/api/knowledge?id='+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'无法加载主题');if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id]);
 const m=data?.material,teacher=data?.role==='teacher';
 useEffect(()=>{if(m&&!teacher&&!m.cultureConfig)fetch('/api/culture?material='+encodeURIComponent(m.id),{cache:'no-store'}).then(r=>r.json()).then(d=>setActivities(d.progress?.activities||[])).catch(()=>{})},[m,teacher]);
 async function done(name:string){if(!m)return;if(teacher){toast.info('教师预览 · 页面记录了互动：'+name);return}try{setActivities((await recordActivity(m.id,name)).activities||[])}catch(e){toast.error((e as Error).message)}}
 return <div className="knowledge-page"><Toaster position="top-center"/><header className="knowledge-topbar"><a className="btn secondary" href="/?view=knowledge">← 返回知识拓展</a><span>EXPLORE THE WORLD · 用英语探索世界</span></header>{error?<main className="student-empty"><h1>暂时无法打开主题</h1><p>{error}</p><a href="/">返回登录</a></main>:!m?<main className="student-empty">正在加载主题…</main>:<main className="knowledge-content">{m.cultureConfig?<CultureLab material={m} teacher={teacher}/>:<><header className="knowledge-title"><span className="kicker">CULTURE & DISCOVERY</span><h1>{m.title}</h1><p>{m.subtitle}</p>{activities.length>0&&<p className="knowledge-activity">本页互动 · 已完成 {activities.length} 项</p>}</header><LessonHtml material={m} onDone={done}/></>}<details className="knowledge-source"><summary>来源与学习说明</summary><p>{m.source||'教师提供'} · {m.rights}</p>{m.sourceUrl&&<a href={m.sourceUrl} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}</details></main>}</div>
}
