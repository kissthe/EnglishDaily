'use client';
import {useEffect,useState} from 'react';
type Summary={day:string;dailyNew:number;done:number;due:number;newAvailable:number;pendingNew:number;pendingReview:number;enabledCount:number};
export function VocabularyReminder(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){if(document.visibilityState!=='visible')return;try{const r=await fetch('/api/vocabulary?summary=1',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'词汇提醒暂时无法加载');if(active){setData(d);setError('')}}catch(e){if(active)setError((e as Error).message)}}void load();const timer=setInterval(load,30000);window.addEventListener('focus',load);document.addEventListener('visibilitychange',load);return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',load)}},[]);
 const reviews=data?data.due+data.pendingReview:0,fresh=data?data.newAvailable+data.pendingNew:0;
 return <section className="panel vocabulary-reminder" aria-label="每日词汇提醒"><div><h2>今日词汇 · {data?reviews+fresh>0?`还有 ${reviews+fresh} 词待背`:data.enabledCount?'已完成今日计划':'等待老师准备':'每日积累'}</h2>{data&&<p>待复习 {reviews} 词 · 待学新词 {fresh} 词 · 今日已完成 {data.done} 词</p>}<p className="helper">{data?`每日新词上限 ${data.dailyNew} 个，到期旧词优先复习。`:'正在读取今日词汇计划…'}</p>{error&&<p role="alert" className="error-text">{error}</p>}</div><a className="btn" href="/vocabulary">{data&&reviews+fresh===0?'查看词汇学习':'去背单词'} →</a></section>
}
