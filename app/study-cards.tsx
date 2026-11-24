'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {ArrowDown,ArrowLeft,ArrowUp,Download,FileText,MoreHorizontal,PenLine,Pencil,Plus,Printer,RotateCcw,Trash2} from 'lucide-react';
import {cardThemes,cardTypeLabels,type CardData,type CardItem,type StudyCard} from '@/lib/close-reading';

async function request(body?:unknown){const r=await fetch('/api/cards',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'学习卡片暂时无法加载');return d}
const themeNames:Record<CardData['theme'],string>={violet:'紫罗兰',ocean:'海洋',forest:'森林',sunset:'日落',rose:'玫瑰',slate:'石墨'};
const types=['word','sentence','practice','note'] as const;
const count=(d:CardData,t:CardItem['type'])=>d.items.filter(i=>i.type===t).length;
const newId=()=>Math.random().toString(36).slice(2,10);

// 卡片正文。老师可以逐项标记“背诵抄写”，标记的内容在卡片顶部汇总。
function CardSheet({data,teacher,onRecite,busy}:{data:CardData;teacher:boolean;onRecite:(i:CardItem)=>void;busy:boolean}){
 const recite=data.items.filter(i=>i.recite);
 const mark=(i:CardItem)=>teacher?<button className={'recite-toggle'+(i.recite?' on':'')} disabled={busy} onClick={()=>onRecite(i)} aria-pressed={i.recite}><PenLine size={13}/>{i.recite?'背诵抄写 ✓':'设为背诵抄写'}</button>:i.recite?<span className="recite-badge"><PenLine size={12}/>背诵抄写</span>:null;
 return <article className={'study-card theme-'+data.theme}>
  <header><span>精读学习卡片</span><h2 lang="en">{data.title}</h2>{data.subtitle&&<p>{data.subtitle}</p>}</header>
  {recite.length>0&&<section className="study-card-recite"><h3><PenLine size={16}/>需要背诵抄写<small>{recite.length}</small></h3><ol>{recite.map(i=><li key={i.id}><span lang="en">{i.text}</span>{i.meaning&&<small>{i.meaning}</small>}</li>)}</ol></section>}
  {types.map(t=>{const items=data.items.filter(i=>i.type===t);if(!items.length)return null;return <section key={t}><h3>{cardTypeLabels[t]}<small>{items.length}</small></h3>
   {t==='word'?<div className="study-card-words">{items.map(i=><div key={i.id} className={i.recite?'recite':''}><b lang="en">{i.text}</b>{i.meaning&&<span>{i.meaning}</span>}{i.note&&<em lang="en">{i.note}</em>}{mark(i)}</div>)}</div>
   :items.map(i=><div key={i.id} className={'study-card-item '+t+(i.recite?' recite':'')}><p className="en" lang="en">{i.text}</p>{i.meaning&&<p className="zh">{i.meaning}</p>}{i.note&&<p className="note">{i.note}</p>}{mark(i)}</div>)}
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
   <fieldset className="study-card-themes"><legend>配色</legend>{cardThemes.map(t=><button key={t} type="button" className={'theme-'+t+(value.theme===t?' active':'')} aria-pressed={value.theme===t} onClick={()=>set({theme:t})}><span/>{themeNames[t]}</button>)}</fieldset></div>
  {types.map(t=>{const items=value.items.filter(i=>i.type===t);return <section key={t} className="study-card-edit-group"><h3>{cardTypeLabels[t]}<small>{items.length}</small></h3>
   {items.map((i,k)=><div key={i.id} className="study-card-edit-item"><div className="cr-edit-grid three"><label>{labels[t][0]}{i.recite&&<span className="recite-badge"><PenLine size={12}/>背诵抄写</span>}<textarea rows={t==='word'?1:2} value={i.text} maxLength={1500} onChange={e=>item(i.id,{text:e.target.value})}/></label><label>{labels[t][1]}<textarea rows={t==='word'?1:2} value={i.meaning} maxLength={1500} onChange={e=>item(i.id,{meaning:e.target.value})}/></label><label>{labels[t][2]}<textarea rows={t==='word'?1:2} value={i.note} maxLength={2000} onChange={e=>item(i.id,{note:e.target.value})}/></label></div>
    <div className="study-card-item-actions"><button type="button" aria-label="上移" disabled={k===0} onClick={()=>move(i.id,-1)}><ArrowUp size={15}/></button><button type="button" aria-label="下移" disabled={k===items.length-1} onClick={()=>move(i.id,1)}><ArrowDown size={15}/></button><button type="button" aria-label="删除" onClick={()=>set({items:value.items.filter(x=>x.id!==i.id)})}><Trash2 size={15}/></button></div></div>)}
   <button type="button" className="text-link" disabled={value.items.length>=120} onClick={()=>set({items:[...value.items,{id:newId(),type:t,text:'',meaning:'',note:'',recite:false}]})}><Plus size={14}/>添加{cardTypeLabels[t]}</button>
  </section>})}
 </div>;
}

export function StudyCards(){
 const [cards,setCards]=useState<StudyCard[]|null>(null),[role,setRole]=useState<'teacher'|'student'>('student'),[open,setOpen]=useState<string|null>(null),[draft,setDraft]=useState<CardData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('card');request().then(d=>{setCards(d.cards);setRole(d.role);if(id&&d.cards.some((c:StudyCard)=>c.id===id))setOpen(id)}).catch(e=>setError(e.message))},[]);
 const card=cards?.find(c=>c.id===open),teacher=role==='teacher';
 async function run(work:()=>Promise<void>,done?:string){setBusy(true);try{await work();if(done)toast.success(done)}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 const save=()=>run(async()=>{if(!card||!draft)return;setCards((await request({op:'save',id:card.id,data:{...draft,items:draft.items.filter(i=>i.text.trim())}})).cards);setDraft(null)},'卡片已保存');
 const remove=()=>run(async()=>{if(!card||!window.confirm(`删除“${card.data.title}”的学习卡片？删除后可以在文章末尾重新生成。`))return;setCards((await request({op:'delete',id:card.id})).cards);setOpen(null)},'已删除');
 const regenerate=()=>run(async()=>{if(!card||!window.confirm('按文章内容和你的收藏、仿写重新生成？你对卡片的修改会被替换，老师标记的背诵抄写会保留。'))return;const d=await request({op:'generate',task:card.task,replace:true});setCards(old=>old!.map(c=>c.id===card.id?d.card:c))},'已重新生成');
 const recite=(i:CardItem)=>run(async()=>{if(!card)return;setCards((await request({op:'recite',id:card.id,item:i.id,recite:!i.recite})).cards)});
 if(error)return <div role="alert" className="vocab-error">{error}</div>;
 if(!cards)return <p role="status">正在读取学习卡片…</p>;
 if(card)return <div className="study-card-page">
  <div className="study-card-toolbar">
   <button className="btn secondary" onClick={()=>{if(draft&&!window.confirm('还有未保存的修改，确定离开吗？'))return;setOpen(null);setDraft(null)}}><ArrowLeft size={16}/>全部卡片</button>
   <div className="study-card-actions">{draft?<><button className="btn secondary" disabled={busy} onClick={()=>setDraft(null)}>取消</button><button className="btn" disabled={busy} onClick={save}>{busy?'正在保存…':'保存卡片'}</button></>
    :<><a className="btn secondary" href={'/close-reading/'+encodeURIComponent(card.task)}><FileText size={16}/>原文</a>{!teacher&&<button className="btn secondary" onClick={()=>setDraft(structuredClone(card.data))}><Pencil size={16}/>编辑</button>}<a className="btn secondary" href={'/cards/print?id='+encodeURIComponent(card.id)} target="_blank" rel="noreferrer"><Printer size={16}/>打印</a><a className="btn secondary" href={'/api/cards?export=docx&id='+encodeURIComponent(card.id)}><Download size={16}/>Word</a>
     {!teacher&&<details className="study-card-more"><summary className="btn secondary" aria-label="更多操作"><MoreHorizontal size={16}/></summary><div><button disabled={busy} onClick={regenerate}><RotateCcw size={15}/>重新生成</button><button className="danger" disabled={busy} onClick={remove}><Trash2 size={15}/>删除卡片</button></div></details>}</>}</div>
  </div>
  {teacher&&!draft&&<p className="helper study-card-tip">点每一项右下角的“设为背诵抄写”，学生的卡片顶部会列出需要背诵抄写的内容，打印和导出时也会单独列出。</p>}
  {draft?<CardEditor value={draft} onChange={setDraft}/>:<CardSheet data={card.data} teacher={teacher} onRecite={recite} busy={busy}/>}
 </div>;
 if(!cards.length)return <p className="cr-empty">{teacher?'学生读完精读文章后，学习卡片会出现在这里。':'读完一篇文章，在文末点“完成精读，生成学习卡片”。'}</p>;
 return <>
  <div className="study-card-all"><a className="btn secondary" href="/cards/print" target="_blank" rel="noreferrer"><Printer size={16}/>全部打印</a><a className="btn secondary" href="/api/cards?export=docx"><Download size={16}/>全部导出 Word</a></div>
  <div className="study-card-grid">{cards.map(c=>{const r=c.data.items.filter(i=>i.recite).length;return <button key={c.id} className={'study-card-tile theme-'+c.data.theme} onClick={()=>setOpen(c.id)}><span className="study-card-tile-band"><small>精读学习卡片</small><b lang="en">{c.data.title}</b></span><span className="study-card-tile-body">{c.data.subtitle&&<span>{c.data.subtitle}</span>}<span className="study-card-counts"><em>单词 {count(c.data,'word')}</em><em>句子 {count(c.data,'sentence')}</em><em>仿写 {count(c.data,'practice')}</em>{r>0&&<em className="recite">背诵抄写 {r}</em>}</span><small>更新于 {c.updated.slice(0,10)}</small></span></button>})}</div>
 </>;
}
