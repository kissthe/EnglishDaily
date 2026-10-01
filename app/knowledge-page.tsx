'use client';
import {useEffect,useState} from 'react';
import {Toaster} from 'sonner';
import {CultureLab} from './culture-lab';
import {SafeHtml} from './safe-html';
import type {CourseData} from '@/lib/course';
export function KnowledgePage({id}:{id:string}){
 const [data,setData]=useState<CourseData|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch('/api/course',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'无法加载主题');if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id]);
 const m=data?.materials.find(m=>m.id===id&&m.kind==='知识拓展'&&(m.reviewed||data.role==='teacher'));
 return <div className="knowledge-page"><Toaster position="top-center"/><header className="knowledge-topbar"><a className="btn secondary" href="/?view=knowledge">← 返回知识拓展</a><span>EXPLORE THE WORLD · 用英语探索世界</span></header>{error||data&&!m?<main className="student-empty"><h1>暂时无法打开主题</h1><p>{error||'主题尚未发布或不存在。'}</p><a href="/">返回登录</a></main>:!m?<main className="student-empty">正在加载主题…</main>:<main className="knowledge-content">{m.cultureConfig?<CultureLab material={m} teacher={data?.role==='teacher'}/>:<><header className="knowledge-title"><span className="kicker">CULTURE & DISCOVERY</span><h1>{m.title}</h1><p>{m.subtitle}</p></header><SafeHtml html={m.body}/></>}<details className="knowledge-source"><summary>来源与学习说明</summary><p>{m.source||'教师提供'} · {m.rights}</p>{m.sourceUrl&&<a href={m.sourceUrl} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}</details></main>}</div>
}
