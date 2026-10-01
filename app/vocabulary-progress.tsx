'use client';
import {useState} from 'react';
import type {VocabularyState} from '@/lib/vocabulary';

export function VocabularyProgress({data}:{data:VocabularyState}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('全部'),[category,setCategory]=useState('全部'),[page,setPage]=useState(0);
 const total=data.totalCount,percent=(n:number)=>total?Math.round(n/total*1000)/10:0;
 const categories=[...new Set(data.progress.flatMap(p=>p.categories))];
 const rows=data.progress.filter(p=>p.word.toLowerCase().includes(query.trim().toLowerCase())&&(status==='全部'||p.status===status)&&(category==='全部'||p.categories.includes(category)));
 const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
 const available=data.progress.filter(p=>p.enabled),availableLearned=available.filter(p=>p.reviews>0).length;
 return <section className="panel vocab-library-progress" aria-label="词库学习进度">
  <div className="section-heading"><h2>{data.role==='teacher'?'学生词库进度':'我的词库进度'}</h2><span>{total} 词</span></div>
  <div className="vocab-progress-summary">
   <div><b>学习覆盖 {percent(data.learned)}%</b><progress aria-label="整库学习覆盖率" max={Math.max(1,total)} value={data.learned}/><p>已学习 {data.learned} / {total} 词 · 未学习 {total-data.learned} 词</p></div>
   <div><b>长期巩固 {percent(data.stable)}%</b><progress aria-label="整库长期巩固率" max={Math.max(1,total)} value={data.stable}/><p>连续四轮认对 {data.stable} / {total} 词</p></div>
  </div>
  <p className="helper">当前可练 {data.enabledCount} 词，已学习其中 {availableLearned} 词；{total-data.enabledCount} 词待老师核对或已暂停。完成一次练习计入已学习，连续四轮认对进入长期巩固，答错或不确定会回到学习中。</p>
  <p role="status" className="vocab-encouragement">{total>0&&data.stable===total?'整库已进入长期巩固，继续按时复习，保持熟悉！':data.learned===0?'完成第一个词，就能点亮你的进度。':`你已经学习了 ${data.learned} 个词，每一次复习都在积累。`}</p>
  <details><summary>按话题查看完成情况</summary><div className="vocab-category-progress">{categories.map(name=>{const group=data.progress.filter(p=>p.categories.includes(name));return <div key={name}><b>{name}</b><span>已学习 {group.filter(p=>p.reviews>0).length}/{group.length} · 长期巩固 {group.filter(p=>p.streak>=4).length}/{group.length}</span></div>})}</div><p className="helper">同一个词可能属于多个话题，整库统计只计算一次。</p></details>
  <details className="vocab-progress-details"><summary>查看每个词的进度</summary>
   <div className="knowledge-filters">
    <label>搜索单词<input type="search" value={query} placeholder="输入单词" onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label>
    <label>学习状态<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}>{['全部','未学习','学习中','长期巩固'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>话题<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}>{['全部',...categories].map(s=><option key={s}>{s}</option>)}</select></label>
   </div>
   <p className="helper">共 {rows.length} 词；认对进度为当前连续次数 / 4 次。</p>
   <div className="vocab-progress-table"><table><caption className="sr-only">各个词汇的学习进度与复习安排</caption><thead><tr><th>单词 / 状态</th><th>认对进度</th><th>学习记录</th><th>复习安排</th></tr></thead><tbody>{rows.slice(currentPage*20,(currentPage+1)*20).map(p=><tr key={p.id}><td><b lang="en">{p.word}</b><small>{p.status}{!p.enabled?' · 暂不可练':''}</small></td><td><progress aria-label={`${p.word} 连续认对进度`} max={4} value={Math.min(p.streak,4)}/><small>连续认对 {p.streak} 次</small></td><td>学习 {p.reviews} 次<small>需再练 {p.lapses} 次</small></td><td>{p.nextDue||'尚未开始'}<small>{p.nextDue&&p.enabled&&p.nextDue<=data.day?'已到期 · ':''}{p.lastDay?`最近学习 ${p.lastDay}`:'等待第一次学习'}</small></td></tr>)}</tbody></table></div>
   {!rows.length&&<p>没有符合筛选条件的词。</p>}
   <div className="vocab-actions"><button className="btn secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>上一页</button><span>{currentPage+1} / {Math.max(1,Math.ceil(rows.length/20))}</span><button className="btn secondary" disabled={(currentPage+1)*20>=rows.length} onClick={()=>setPage(currentPage+1)}>下一页</button></div>
  </details>
 </section>;
}
