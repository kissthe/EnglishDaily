'use client';
import {useEffect,useState} from 'react';
import {Flame,ClipboardCheck,Trophy,ListChecks,BookMarked,NotebookTabs} from 'lucide-react';
import type {StudentOverview} from '@/lib/overview';

const weekday=(d:string)=>['日','一','二','三','四','五','六'][new Date(d+'T12:00:00Z').getUTCDay()];
const rows=[['task','作业'],['grammar','语法'],['vocabulary','词汇'],['checkin','打卡']] as const;

export function useOverview(refreshKey=0){
 const [data,setData]=useState<StudentOverview|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch('/api/overview',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'学习数据暂时无法加载');if(active){setData(d);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[refreshKey]);
 return {data,error};
}

// 首页学习数据：关键数字 + 近 14 天学习记录 + 最近成绩。
export function StudentOverviewPanel({data,error,teacher=false}:{data:StudentOverview|null;error:string;teacher?:boolean}){
 if(error)return <p className="helper" role="alert">{error}</p>;
 if(!data)return <section className="overview-panel loading" aria-busy="true"><p className="helper">正在汇总学习数据…</p></section>;
 const g=data.grammar,accuracy=g.answered?Math.round(g.correct/g.answered*100):null;
 const tiles=[
  {icon:Flame,label:'连续打卡',value:data.checkin.streak,unit:'天',hint:`本月 ${data.checkin.monthDays} 天 · ${data.checkin.todayDone?'今天已打卡':'今天还没打卡'}`,warn:!data.checkin.todayDone},
  {icon:ClipboardCheck,label:'本周作业',value:`${data.tasks.weekDone}/${data.tasks.week}`,unit:'',hint:data.tasks.pending||data.tasks.corrections?`待完成 ${data.tasks.pending} · 待订正 ${data.tasks.corrections}`:'全部完成'},
  {icon:Trophy,label:'最近平均分',value:data.average??'—',unit:data.average===null?'':'分',hint:data.scores.length?`近 ${data.scores.length} 次已批改作业`:'作业批改后显示'},
  {icon:ListChecks,label:'语法正确率',value:accuracy??'—',unit:accuracy===null?'':'%',hint:g.answered?`近 30 天 ${g.answered} 题 · 今天 ${g.todayDone} 题`:'近 30 天还没有练习'},
  {icon:BookMarked,label:'已学单词',value:data.vocabulary.learned,unit:'个',hint:`今天练了 ${data.vocabulary.todayDone} 个`},
  {icon:NotebookTabs,label:'单词本',value:data.wordbook.words+data.wordbook.sentences,unit:'条',hint:`单词 ${data.wordbook.words} · 句子 ${data.wordbook.sentences}`}
 ];
 return <section className="overview-panel" aria-label={teacher?'学生学习数据':'我的学习数据'}>
  <div className="overview-tiles">{tiles.map(t=><div className={'overview-tile'+(t.warn?' warn':'')} key={t.label}><span className="overview-label"><t.icon size={16} aria-hidden/>{t.label}</span><strong>{t.value}<small>{t.unit}</small></strong><span className="overview-hint">{t.hint}</span></div>)}</div>
  <div className="overview-charts">
   <figure className="overview-activity"><figcaption>近 14 天学习记录</figcaption>
    <div className="activity-grid" role="table" aria-label="近 14 天每天完成的学习项目">
     <div role="row" className="activity-row head"><span role="columnheader"/>{data.activity.map(a=><span role="columnheader" key={a.day} className={a.day===data.today?'today':''} title={a.day}>{a.day===data.today?'今':weekday(a.day)}</span>)}</div>
     {rows.map(([k,label])=><div role="row" className="activity-row" key={k}><span role="rowheader">{label}</span>{data.activity.map(a=><span role="cell" key={a.day} className={'activity-cell'+(a[k]?' on':'')} title={`${a.day} ${label}${a[k]?'：已完成':'：没有记录'}`} aria-label={`${a.day} ${label}${a[k]?'已完成':'没有记录'}`}/>)}</div>)}
    </div></figure>
   <figure className="overview-scores"><figcaption>最近作业成绩（百分制）</figcaption>
    {data.scores.length?<><div className="score-bars" role="list">{data.scores.map((s,i)=><div role="listitem" className="score-bar" key={i} tabIndex={0} aria-label={`${s.day} ${s.title}：${s.percent} 分`}><span className="score-fill" style={{height:Math.max(4,s.percent)+'%'}}/><span className="score-tip" role="tooltip"><b>{s.percent} 分</b>{s.title}<br/>{s.kind} · {s.day.slice(5)}</span></div>)}</div>
     <div className="score-axis"><span>{data.scores[0].day.slice(5)}</span><span>最近一次 {data.scores.at(-1)!.percent} 分</span></div>
     <details className="score-table"><summary>查看成绩明细</summary><table><thead><tr><th>日期</th><th>作业</th><th>类型</th><th>得分</th></tr></thead><tbody>{[...data.scores].reverse().map((s,i)=><tr key={i}><td>{s.day.slice(5)}</td><td>{s.title}</td><td>{s.kind}</td><td>{s.percent}</td></tr>)}</tbody></table></details></>
     :<p className="helper">作业批改后，这里会显示成绩变化。</p>}
   </figure>
  </div>
 </section>;
}
