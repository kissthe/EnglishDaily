'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowRight,Sparkles} from 'lucide-react';
import type {DailyPick} from '@/lib/daily-pick';

// 每个主题系列一组配色和图标；有页面图片时用图片作封面。
const looks:Record<string,[string,string,string]>={
 '城市与地理':['#2563eb','#60a5fa','🏙️'],'电影里的英语':['#7c3aed','#c084fc','🎬'],'歌曲与表达':['#db2777','#f9a8d4','🎵'],'音乐影视':['#9333ea','#f472b6','🎤'],
 '人物故事':['#b45309','#fbbf24','🌟'],'小说与人物':['#0f766e','#5eead4','📚'],'体育运动':['#ea580c','#fdba74','🏀'],'流行文化':['#c026d3','#f0abfc','🏆'],
 '品牌与生活':['#334155','#94a3b8','🚗'],'习语与表达':['#0891b2','#67e8f9','💬'],'节日文化':['#dc2626','#fca5a5','🎉'],'日常文化':['#4d7c0f','#bef264','☕'],
 '科学与自然':['#047857','#6ee7b7','🔭'],'校园生活':['#4f46e5','#a5b4fc','🎒'],'地方与身份':['#0369a1','#7dd3fc','🧭'],'主题阅读':['#5346eb','#a99bff','✨'],
};
const weekday=(day:string)=>new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));

export function DailyPickCard(){
 const [data,setData]=useState<{day:string;total:number;explored:number;pick:DailyPick|null}|null>(null);
 useEffect(()=>{fetch('/api/knowledge?daily=1',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(setData).catch(()=>{})},[]);
 const p=data?.pick;if(!data||!p)return null;
 const [from,to,icon]=looks[p.category]||looks['主题阅读'];
 return <section className="daily-pick-wrap" aria-label="今日推荐">
  <a className="daily-pick" href={'/knowledge/'+encodeURIComponent(p.id)} style={{'--pick-from':from,'--pick-to':to} as CSSProperties}>
   <div className="daily-pick-art" aria-hidden>{p.cover?<img src={p.cover} alt=""/>:<><span className="daily-pick-ring one"/><span className="daily-pick-ring two"/><span className="daily-pick-icon">{icon}</span></>}</div>
   <div className="daily-pick-body">
    <span className="daily-pick-eyebrow"><Sparkles size={14}/>今日推荐 · {weekday(data.day)}</span>
    <span className="daily-pick-chip">{icon} {p.category}</span>
    <h2 lang="en">{p.title}</h2>
    {p.tagline&&<p>{p.tagline}</p>}
    <div className="daily-pick-meta">{p.level&&<span>{p.level}</span>}{p.minutes>0&&<span>约 {p.minutes} 分钟</span>}<span>{p.lab?'探索 · 检测 · 表达':p.interactive?'互动探索':'主题阅读'}</span>{p.status!=='未开始'&&<span className={'daily-pick-status '+(p.status==='已完成'?'done':'')}>{p.status==='已完成'?'已完成':p.activities?`已完成 ${p.activities} 项互动`:'学习中'}</span>}</div>
    <span className="daily-pick-cta">{p.status==='未开始'?'开始探索':p.status==='学习中'?'继续探索':'再看一遍'}<ArrowRight size={18}/></span>
   </div>
  </a>
  <p className="daily-pick-foot">已探索 {data.explored} / {data.total} 个主题 · <a href="/?view=knowledge">查看全部主题 →</a></p>
 </section>;
}
