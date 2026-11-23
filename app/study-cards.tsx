'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {ArrowDown,ArrowLeft,ArrowUp,Download,FileText,Layers,Pencil,Plus,Printer,RotateCcw,Trash2} from 'lucide-react';
import {cardThemes,cardTypeLabels,type CardData,type CardItem,type StudyCard} from '@/lib/close-reading';

async function request(body?:unknown){const r=await fetch('/api/cards',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'学习卡片暂时无法加载');return d}
const themeNames:Record<CardData['theme'],string>={violet:'紫罗兰',ocean:'海洋',forest:'森林',sunset:'日落',rose:'玫瑰',slate:'石墨'};
const types=['word','sentence','practice','note'] as const;
const count=(d:CardData,t:CardItem['type'])=>d.items.filter(i=>i.type===t).length;
const newId=()=>Math.random().toString(36).slice(2,10);

function CardSheet({data}:{data:CardData}){
 return <article className={'study-card theme-'+data.theme}>
  <header><span>精读学习卡片</span><h2>{data.title}</h2>{data.subtitle&&<p>{data.subtitle}</p>}</header>
  {types.map(t=>{const items=data.items.filter(i=>i.type===t);if(!items.length)return null;return <section key={t}><h3>{cardTypeLabels[t]}<small>{items.length}</small></h3>
   {t==='word'?<div className="study-card-words">{items.map(i=><div key={i.id}><b lang="en">{i.text}</b>{i.meaning&&<span>{i.meaning}</span>}{i.note&&<em lang="en">{i.note}</em>}</div>)}</div>
   :items.map(i=><div key={i.id} className={'study-card-item '+t}><p className="en" lang="en">{i.text}</p>{i.meaning&&<p className="zh">{i.meaning}</p>}{i.note&&<p className="note">{i.note}</p>}</div>)}
  </section>})}
  {!data.items.length&&<p className="helper study-card-empty">卡片是空的，点“编辑”添加内容。</p>}
 </article>;
}

function CardEditor({value,onChange}:{value:CardData;onChange:(d:CardData)=>void}){
 const set=(p:Partial<CardData>)=>onChange({...value,...p});
 const item=(id:string,p:Partial<CardItem>)=>set({items:value.items.map(i=>i.id===id?{...i,...p}:i)});
 const move=(id:string,dir:number)=>{const list=value.items.filter(i=>i.type===value.items.find(x=>x.id===id)!.type),k=list.findIndex(i=>i.id===id),other=list[k+dir];if(!other)return;const items=[...value.items],a=items.findIndex(i=>i.id===id),b=items.findIndex(i=>i.id===other.id);[items[a],items[b]]=[items[b],items[a]];set({items})};
 const labels:Record<CardItem['type'],[string,string,string]>={word:['单词 / 短语','释义','搭配 / 例句'],sentence:['句子','翻译','语法 / 笔记'],practice:['我的句子','要求','老师点评 / 笔记'],note:['标题或要点','内容','补充']};
 return <div className="study-card-editor">
  <div className="study-card-editor-head"><label>卡片标题<input value={value.title} maxLength={120} onChange={e=>set({title:e.target.value})}/></label><label>副标题<input value={value.subtitle} maxLength={200} placeholder="来源、日期或一句话总结" onChange={e=>set({subtitle:e.target.value})}/></label>
   <fieldset className="study-card-themes"><legend>配色</legend>{cardThemes.map(t=><button key={t} type="button" className={'theme-'+t+(value.theme===t?' active':'')} aria-pressed={value.theme===t} title={themeNames[t]} onClick={()=>set({theme:t})}><span/>{themeNames[t]}</button>)}</fieldset></div>
  {types.map(t=>{const items=value.items.filter(i=>i.type===t);return <section key={t} className="study-card-edit-group"><h3>{cardTypeLabels[t]}<small>{items.length}</small></h3>
   {items.map((i,k)=><div key={i.id} className="study-card-edit-item"><div className="cr-edit-grid three"><label>{labels[t][0]}<textarea rows={t==='word'?1:2} value={i.text} maxLength={1500} onChange={e=>item(i.id,{text:e.target.value})}/></label><label>{labels[t][1]}<textarea rows={t==='word'?1:2} value={i.meaning} maxLength={1500} onChange={e=>item(i.id,{meaning:e.target.value})}/></label><label>{labels[t][2]}<textarea rows={t==='word'?1:2} value={i.note} maxLength={2000} onChange={e=>item(i.id,{note:e.target.value})}/></label></div>
    <div className="study-card-item-actions"><button type="button" aria-label="上移" disabled={k===0} onClick={()=>move(i.id,-1)}><ArrowUp size={15}/></button><button type="button" aria-label="下移" disabled={k===items.length-1} onClick={()=>move(i.id,1)}><ArrowDown size={15}/></button><button type="button" aria-label="删除" onClick={()=>set({items:value.items.filter(x=>x.id!==i.id)})}><Trash2 size={15}/></button></div></div>)}
   <button type="button" className="text-link" disabled={value.items.length>=120} onClick={()=>set({items:[...value.items,{id:newId(),type:t,text:'',meaning:'',note:''}]})}><Plus size={14}/>添加{cardTypeLabels[t]}</button>
  </section>})}
 </div>;
}

// 学习成果：精读完成后生成的学习卡片，可以修改、打印和导出 Word。
export function StudyCards(){
 const [cards,setCards]=useState<StudyCard[]|null>(null),[role,setRole]=useState<'teacher'|'student'>('student'),[open,setOpen]=useState<string|null>(null),[draft,setDraft]=useState<CardData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('card');request().then(d=>{setCards(d.cards);setRole(d.role);if(id&&d.cards.some((c:StudyCard)=>c.id===id))setOpen(id)}).catch(e=>setError(e.message))},[]);
 const card=cards?.find(c=>c.id===open);
 async function run(work:()=>Promise<void>,done?:string){setBusy(true);try{await work();if(done)toast.success(done)}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 const save=()=>run(async()=>{if(!card||!draft)return;const items=draft.items.filter(i=>i.text.trim());setCards((await request({op:'save',id:card.id,data:{...draft,items}})).cards);setDraft(null)},'卡片已保存');
 const remove=()=>run(async()=>{if(!card||!window.confirm(`删除“${card.data.title}”的学习卡片？删除后可以在精读页面重新生成。`))return;setCards((await request({op:'delete',id:card.id})).cards);setOpen(null)},'已删除');
 const regenerate=()=>run(async()=>{if(!card||!window.confirm('按文章内容和你的收藏、仿写重新生成？卡片上的修改会被替换。'))return;const d=await request({op:'generate',task:card.task,replace:true});setCards(old=>old!.map(c=>c.id===card.id?d.card:c));setDraft(null)},'已重新生成');
 if(error)return <div role="alert" className="vocab-error">{error}</div>;
 if(!cards)return <p role="status">正在读取学习成果…</p>;
 if(card)return <div className="study-card-page">
  <div className="study-card-toolbar"><button className="btn secondary" onClick={()=>{if(draft&&!window.confirm('还有未保存的修改，确定离开吗？'))return;setOpen(null);setDraft(null)}}><ArrowLeft size={16}/>全部卡片</button><span/>
   {draft?<><button className="btn secondary" disabled={busy} onClick={()=>setDraft(null)}>取消</button><button className="btn" disabled={busy} onClick={save}>{busy?'正在保存…':'保存卡片'}</button></>
   :<>{role==='student'&&<button className="btn secondary" onClick={()=>setDraft(structuredClone(card.data))}><Pencil size={16}/>编辑</button>}<a className="btn secondary" href={'/cards/print?id='+encodeURIComponent(card.id)} target="_blank" rel="noreferrer"><Printer size={16}/>打印</a><a className="btn secondary" href={'/api/cards?export=docx&id='+encodeURIComponent(card.id)}><Download size={16}/>Word</a></>}</div>
  {draft?<CardEditor value={draft} onChange={setDraft}/>:<CardSheet data={card.data}/>}
  {!draft&&<div className="study-card-foot"><a className="text-link" href={'/practice/'+encodeURIComponent(card.task)}><FileText size={15}/>回到原文</a>{role==='student'&&<><button className="text-link" disabled={busy} onClick={regenerate}><RotateCcw size={15}/>重新生成</button><button className="text-link danger" disabled={busy} onClick={remove}><Trash2 size={15}/>删除卡片</button></>}</div>}
 </div>;
 return <>
  <div className="page-heading"><div><div className="kicker">MY LEARNING CARDS</div><h1>学习成果</h1><p>{role==='teacher'?'学生每读完一篇精读生成的学习卡片，可以查看、打印和导出。':'每读完一篇精读就会生成一张学习卡片：重点单词、好句、你的仿写都在这里，可以修改、打印和导出 Word。'}</p></div>{cards.length>0&&<div className="study-card-all"><a className="btn secondary" href="/cards/print" target="_blank" rel="noreferrer"><Printer size={16}/>全部打印</a><a className="btn secondary" href="/api/cards?export=docx"><Download size={16}/>全部导出 Word</a></div>}</div>
  {!cards.length?<section className="panel study-card-none"><Layers size={34}/><h2>还没有学习卡片</h2><p>在精读作业里读完最后一段，点“完成精读，生成学习卡片”。</p></section>
  :<div className="study-card-grid">{cards.map(c=><button key={c.id} className={'study-card-tile theme-'+c.data.theme} onClick={()=>setOpen(c.id)}><span className="study-card-tile-band"><small>精读学习卡片</small><b>{c.data.title}</b></span><span className="study-card-tile-body">{c.data.subtitle&&<span>{c.data.subtitle}</span>}<span className="study-card-counts"><em>单词 {count(c.data,'word')}</em><em>句子 {count(c.data,'sentence')}</em><em>仿写 {count(c.data,'practice')}</em>{count(c.data,'note')>0&&<em>笔记 {count(c.data,'note')}</em>}</span><small>更新于 {c.updated.slice(0,10)}</small></span></button>)}</div>}
 </>;
}
