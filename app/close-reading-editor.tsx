'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {ChevronDown,ChevronUp,Plus,Sparkles,Trash2} from 'lucide-react';
import {articleText,closeReadingIssues,findSentence,findWord,splitParagraphs,type CRParagraph,type CRPractice,type CRSentence,type CRWord,type CloseReading} from '@/lib/close-reading';
import type {Material} from '@/lib/course';
import {sampleCloseReading} from '@/lib/close-reading-sample';

const blankWord=():CRWord=>({word:'',phonetic:'',meaning:'',usage:''});
const blankSentence=():CRSentence=>({text:'',grammar:'',translation:''});
const blankPractice=(type:CRPractice['type']='word'):CRPractice=>({type,target:'',prompt:'',example:''});

// 精读编辑：粘贴文章 → 拆分段落 → 每段填写重点词、重点句和仿写（可先用 AI 生成草稿再修改）。
export function CloseReadingEditor({m,patch}:{m:Material;patch:(p:Partial<Material>)=>void}){
 const cr=m.closeReading,[raw,setRaw]=useState(cr?articleText(cr):m.body||''),[open,setOpen]=useState(0),[busy,setBusy]=useState(false);
 const set=(next:CloseReading)=>patch({closeReading:next,body:articleText(next)});
 const setPara=(i:number,p:Partial<CRParagraph>)=>cr&&set({paragraphs:cr.paragraphs.map((x,j)=>j===i?{...x,...p}:x)});
 // 重新拆分时，原文没有改动的段落保留已经写好的讲解。
 function split(){const texts=splitParagraphs(raw);if(!texts.length){toast.error('请先粘贴文章');return}const old=cr?.paragraphs||[];set({paragraphs:texts.map((text,i)=>old.find(p=>p.text===text)||{text,words:[],sentences:[],practice:[]})});setOpen(0);toast.success(`已拆分为 ${texts.length} 段`)}
 async function draft(){if(!cr)return;if(cr.paragraphs.some(p=>p.words.length||p.sentences.length||p.practice.length)&&!window.confirm('AI 草稿会替换现有的重点词、重点句和仿写，继续吗？'))return;setBusy(true);try{const r=await fetch('/api/close-reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'draft',paragraphs:cr.paragraphs.map(p=>p.text)})}),d=await r.json();if(!r.ok)throw Error(d.error||'AI 生成失败');set({paragraphs:cr.paragraphs.map((p,i)=>({...p,...d.paragraphs[i]}))});toast.success('已生成草稿，请逐段核对后再发布')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 const issues=cr?closeReadingIssues(cr):[];
 return <div className="form-stack cr-editor">
  <section className="review-checklist"><h3>精读文章</h3><p className="helper">粘贴整篇文章，段落之间空一行，然后点“拆分段落”。上课时和学生逐段阅读：每段可以设置重点单词、重点句子（有语法学习价值）和仿写练习。学生读完后会生成学习卡片。</p>
   <label>文章原文<textarea rows={10} maxLength={60000} value={raw} lang="en" onChange={e=>setRaw(e.target.value)} placeholder={'Almost everyone has experienced the feeling of discomfort...\n\nThis disagreement can lead to serious results...'}/></label>
   <div className="dialog-actions cr-editor-actions"><button type="button" className="btn secondary" onClick={split}>{cr?'重新拆分段落':'拆分段落'}</button>{!cr&&<button type="button" className="text-link" onClick={()=>{const s=sampleCloseReading;setRaw(articleText(s.closeReading));patch({closeReading:s.closeReading,body:articleText(s.closeReading),title:m.title||s.title,subtitle:m.subtitle||s.subtitle,source:m.source||s.source,level:m.level||s.level,minutes:m.minutes||s.minutes});toast.success('已载入示例：2024 中考阅读 D 篇')}}>载入示例文章（2024 中考 D 篇）</button>}{cr&&<button type="button" className="btn secondary" disabled={busy} onClick={draft}><Sparkles size={16}/>{busy?'AI 正在准备讲解…':'AI 生成讲解草稿'}</button>}</div>
   {cr&&raw.trim()&&splitParagraphs(raw).join('\n\n')!==articleText(cr)&&<p className="error-text">原文已修改，请点“重新拆分段落”后再保存。</p>}
  </section>
  {issues.length>0&&<section className="knowledge-checks"><h3>发布前检查</h3><ul>{issues.map(x=><li key={x}>{x}</li>)}</ul></section>}
  {cr?.paragraphs.map((p,i)=><section key={i} className={'cr-edit-para'+(open===i?' open':'')}>
   <button type="button" className="cr-edit-head" onClick={()=>setOpen(open===i?-1:i)} aria-expanded={open===i}><b>第 {i+1} 段</b><span lang="en">{p.text.slice(0,90)}{p.text.length>90?'…':''}</span><small>词 {p.words.length} · 句 {p.sentences.length} · 仿写 {p.practice.length}</small>{open===i?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
   {open===i&&<div className="cr-edit-body">
    <p className="cr-edit-text" lang="en">{p.text}</p>
    <h4>重点单词</h4>
    {p.words.map((w,j)=><div key={j} className="cr-edit-row"><div className="cr-edit-grid four"><label>单词 / 短语<input lang="en" value={w.word} maxLength={80} onChange={e=>setPara(i,{words:p.words.map((x,k)=>k===j?{...x,word:e.target.value}:x)})}/></label><label>音标<input value={w.phonetic} maxLength={80} onChange={e=>setPara(i,{words:p.words.map((x,k)=>k===j?{...x,phonetic:e.target.value}:x)})}/></label><label>本文释义<input value={w.meaning} maxLength={300} onChange={e=>setPara(i,{words:p.words.map((x,k)=>k===j?{...x,meaning:e.target.value}:x)})}/></label><label>搭配 / 例句<input lang="en" value={w.usage} maxLength={600} onChange={e=>setPara(i,{words:p.words.map((x,k)=>k===j?{...x,usage:e.target.value}:x)})}/></label></div>{w.word&&!findWord(p.text,w.word)&&<small className="error-text">本段找不到这个词</small>}<button type="button" className="cr-remove" aria-label="删除单词" onClick={()=>setPara(i,{words:p.words.filter((_,k)=>k!==j)})}><Trash2 size={15}/></button></div>)}
    <button type="button" className="text-link" disabled={p.words.length>=20} onClick={()=>setPara(i,{words:[...p.words,blankWord()]})}><Plus size={14}/>添加单词</button>
    <h4>重点句子</h4>
    {p.sentences.map((s,j)=><div key={j} className="cr-edit-row"><label>原文句子（从上面复制）<textarea lang="en" rows={2} value={s.text} maxLength={1000} onChange={e=>setPara(i,{sentences:p.sentences.map((x,k)=>k===j?{...x,text:e.target.value}:x)})}/></label>{s.text&&!findSentence(p.text,s.text)&&<small className="error-text">与本段原文不一致</small>}<div className="cr-edit-grid two"><label>语法分析<textarea rows={3} value={s.grammar} maxLength={1500} placeholder="主干：…；语法点：…" onChange={e=>setPara(i,{sentences:p.sentences.map((x,k)=>k===j?{...x,grammar:e.target.value}:x)})}/></label><label>翻译<textarea rows={3} value={s.translation} maxLength={1000} onChange={e=>setPara(i,{sentences:p.sentences.map((x,k)=>k===j?{...x,translation:e.target.value}:x)})}/></label></div><button type="button" className="cr-remove" aria-label="删除句子" onClick={()=>setPara(i,{sentences:p.sentences.filter((_,k)=>k!==j)})}><Trash2 size={15}/></button></div>)}
    <button type="button" className="text-link" disabled={p.sentences.length>=8} onClick={()=>setPara(i,{sentences:[...p.sentences,blankSentence()]})}><Plus size={14}/>添加句子</button>
    <h4>仿写</h4>
    {p.practice.map((q,j)=><div key={j} className="cr-edit-row"><div className="cr-edit-grid three"><label>类型<select value={q.type} onChange={e=>setPara(i,{practice:p.practice.map((x,k)=>k===j?{...x,type:e.target.value as CRPractice['type']}:x)})}><option value="word">用词造句</option><option value="sentence">仿写句型</option></select></label><label>目标词 / 句型<input lang="en" value={q.target} maxLength={120} placeholder="value / so that…" onChange={e=>setPara(i,{practice:p.practice.map((x,k)=>k===j?{...x,target:e.target.value}:x)})}/></label><label>参考仿写<input lang="en" value={q.example} maxLength={600} onChange={e=>setPara(i,{practice:p.practice.map((x,k)=>k===j?{...x,example:e.target.value}:x)})}/></label></div><label>要求<input value={q.prompt} maxLength={600} placeholder="例如：用 value 写一句话，说说你最看重什么。" onChange={e=>setPara(i,{practice:p.practice.map((x,k)=>k===j?{...x,prompt:e.target.value}:x)})}/></label><button type="button" className="cr-remove" aria-label="删除仿写" onClick={()=>setPara(i,{practice:p.practice.filter((_,k)=>k!==j)})}><Trash2 size={15}/></button></div>)}
    <div className="cr-edit-add"><button type="button" className="text-link" disabled={p.practice.length>=6} onClick={()=>setPara(i,{practice:[...p.practice,blankPractice('word')]})}><Plus size={14}/>用词造句</button><button type="button" className="text-link" disabled={p.practice.length>=6} onClick={()=>setPara(i,{practice:[...p.practice,blankPractice('sentence')]})}><Plus size={14}/>仿写句型</button></div>
   </div>}
  </section>)}
 </div>;
}
