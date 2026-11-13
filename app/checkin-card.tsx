'use client';
import {useEffect,useState} from 'react';
import {Camera,CheckCircle2,Flame,ImagePlus,MessageSquareText,X} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {offsetDate} from '@/lib/course';
import {CHECKIN_MAX_IMAGES,checkinImageUrl,checkinStreak,type Checkin} from '@/lib/checkin';

const apps=['百词斩','不背单词','墨墨背单词','扇贝单词','知米背单词','欧路词典'];
async function load(){const r=await fetch('/api/checkin',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'打卡记录暂时无法加载');return d as {today:string;checkins:Checkin[]}}

// 手机截图通常很大：上传前缩到最长边 1600px 的 JPEG，节省流量和存储。
async function compress(file:File):Promise<Blob>{
 try{const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',0.82));return blob&&blob.size<file.size?blob:file}catch{return file}
}

function Calendar({days,today}:{days:Set<string>;today:string}){
 // 最近 5 周，周一开头。
 const offset=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7,start=offsetDate(today,-(28+offset));
 const cells=Array.from({length:35},(_,i)=>offsetDate(start,i));
 return <div className="checkin-calendar" role="grid" aria-label="最近 5 周打卡日历"><div className="cal-head" role="row">{['一','二','三','四','五','六','日'].map(d=><span role="columnheader" key={d}>{d}</span>)}</div><div className="cal-body">{cells.map(d=><span role="gridcell" key={d} className={'cal-day'+(days.has(d)?' done':'')+(d===today?' today':'')+(d>today?' future':'')} title={d+(days.has(d)?' 已打卡':'')} aria-label={d+(days.has(d)?' 已打卡':' 未打卡')}>{Number(d.slice(8))}</span>)}</div></div>;
}

export function CheckinCard({onChange}:{onChange?:()=>void}){
 const [data,setData]=useState<{today:string;checkins:Checkin[]}|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false);
 async function refresh(){try{setData(await load());setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{refresh()},[]);
 if(error)return <section className="checkin-card"><p role="alert" className="error-text">{error}</p></section>;
 if(!data)return <section className="checkin-card" aria-busy="true"><p className="helper">正在加载打卡…</p></section>;
 const today=data.checkins.find(c=>c.day===data.today),days=new Set(data.checkins.map(c=>c.day)),streak=checkinStreak([...days],data.today);
 return <section className={'checkin-card'+(today?' done':'')} aria-label="每日背单词打卡">
  <div className="checkin-main">
   <div className="checkin-title"><span className="checkin-flame"><Flame size={22} aria-hidden/></span><div><h2>每日背单词打卡</h2><p>{streak?`已连续打卡 ${streak} 天`:'今天开始第一天吧'}{today?'':' · 用手机 App 背完后上传截图'}</p></div></div>
   {today?<div className="checkin-today"><p className="checkin-ok"><CheckCircle2 size={18} aria-hidden/>今天已打卡{today.app?` · ${today.app}`:''}{today.words?` · ${today.words} 个单词`:''}{today.minutes?` · ${today.minutes} 分钟`:''}</p>
     <div className="checkin-thumbs">{today.images.map(k=><a key={k} href={checkinImageUrl(k)} target="_blank" rel="noreferrer"><img src={checkinImageUrl(k)} alt="背单词截图"/></a>)}</div>
     {today.note&&<p className="helper">{today.note}</p>}
     {today.comment&&<p className="checkin-comment"><MessageSquareText size={16} aria-hidden/>老师：{today.comment}</p>}
     <button className="btn secondary" onClick={()=>setOpen(true)}>修改今天的打卡</button></div>
   :<button className="btn checkin-cta" onClick={()=>setOpen(true)}><Camera size={18}/>上传截图打卡</button>}
  </div>
  <Calendar days={days} today={data.today}/>
  {open&&<CheckinDialog existing={today} onClose={()=>setOpen(false)} onSaved={async()=>{setOpen(false);await refresh();onChange?.()}}/>}
 </section>;
}

function CheckinDialog({existing,onClose,onSaved}:{existing?:Checkin;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [keep,setKeep]=useState<string[]>(existing?.images||[]),[files,setFiles]=useState<{file:File;url:string}[]>([]);
 const [app,setApp]=useState(existing?.app||''),[words,setWords]=useState(existing?.words?String(existing.words):''),[minutes,setMinutes]=useState(existing?.minutes?String(existing.minutes):''),[note,setNote]=useState(existing?.note||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>files.forEach(f=>URL.revokeObjectURL(f.url)),[files]);
 const total=keep.length+files.length;
 function pick(list:FileList|null){if(!list)return;const chosen=Array.from(list).filter(f=>f.type.startsWith('image/')).slice(0,CHECKIN_MAX_IMAGES-total);if(list.length>chosen.length)setError(`最多 ${CHECKIN_MAX_IMAGES} 张截图`);else setError('');setFiles([...files,...chosen.map(file=>({file,url:URL.createObjectURL(file)}))])}
 async function save(){if(!total){setError('请至少上传一张背单词 App 的截图');return}setBusy(true);setError('');try{const form=new FormData();form.append('app',app);form.append('words',words);form.append('minutes',minutes);form.append('note',note);form.append('keep',JSON.stringify(keep));for(const f of files){const blob=await compress(f.file);form.append('images',blob,f.file.name.replace(/\.\w+$/,'')+(blob.type==='image/jpeg'?'.jpg':''))}
  const r=await fetch('/api/checkin',{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error||'打卡没有成功，请重试');toast.success(existing?'打卡已更新':'打卡成功，继续保持！');await onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>{existing?'修改今天的打卡':'今日背单词打卡'}</DialogTitle><DialogDescription>上传背单词 App 的完成页截图（最多 {CHECKIN_MAX_IMAGES} 张），老师可以看到。</DialogDescription></DialogHeader>
  <div className="checkin-form">
   <div className="checkin-pick">{keep.map(k=><figure key={k}><img src={checkinImageUrl(k)} alt="已上传的截图"/><button aria-label="移除这张截图" onClick={()=>setKeep(keep.filter(x=>x!==k))}><X size={14}/></button></figure>)}{files.map(f=><figure key={f.url}><img src={f.url} alt="待上传的截图"/><button aria-label="移除这张截图" onClick={()=>setFiles(files.filter(x=>x!==f))}><X size={14}/></button></figure>)}
    {total<CHECKIN_MAX_IMAGES&&<label className="checkin-add"><ImagePlus size={24} aria-hidden/><span>添加截图</span><input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{pick(e.target.files);e.target.value=''}}/></label>}</div>
   <label>使用的 App<input list="checkin-apps" maxLength={40} value={app} onChange={e=>setApp(e.target.value)} placeholder="例如：百词斩"/></label><datalist id="checkin-apps">{apps.map(a=><option key={a} value={a}/>)}</datalist>
   <div className="checkin-numbers"><label>今天背了几个单词<input type="number" inputMode="numeric" min={0} max={2000} value={words} onChange={e=>setWords(e.target.value)} placeholder="选填"/></label><label>用了多少分钟<input type="number" inputMode="numeric" min={0} max={600} value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="选填"/></label></div>
   <label>想对老师说（选填）<textarea rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：今天复习了昨天的错词"/></label>
   {error&&<p role="alert" className="error-text">{error}</p>}
   <div className="dialog-actions"><button className="btn secondary" disabled={busy} onClick={onClose}>取消</button><button className="btn" disabled={busy||!total} onClick={save}>{busy?'正在上传…':existing?'保存修改':'完成打卡'}</button></div>
  </div></DialogContent></Dialog>;
}

// 老师端：查看最近的打卡截图并点评。
export function CheckinReview(){
 const [data,setData]=useState<{today:string;checkins:Checkin[]}|null>(null),[error,setError]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({}),[busy,setBusy]=useState('');
 async function refresh(){try{setData(await load());setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{refresh()},[]);
 async function comment(c:Checkin){setBusy(c.id);try{const r=await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'comment',id:c.id,comment:drafts[c.id]??c.comment})});const d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');toast.success('点评已保存');await refresh()}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 if(error)return <p role="alert" className="error-text">{error}</p>;
 if(!data)return <p className="helper">正在加载打卡记录…</p>;
 const days=new Set(data.checkins.map(c=>c.day)),recent=data.checkins.slice(0,10),unseen=data.checkins.filter(c=>!c.seen).length;
 return <section className="checkin-review" aria-label="背单词打卡记录"><div className="section-heading"><h2>背单词打卡 <span className="subtle">连续 {checkinStreak([...days],data.today)} 天{unseen?` · ${unseen} 条未查看`:''}</span></h2></div>
  <div className="checkin-review-layout"><Calendar days={days} today={data.today}/>
   <div className="checkin-review-list">{recent.length?recent.map(c=><article key={c.id} className={'checkin-entry'+(c.seen?'':' unseen')}><header><b>{c.day.slice(5)}</b><span>{[c.app,c.words?c.words+' 个单词':'',c.minutes?c.minutes+' 分钟':''].filter(Boolean).join(' · ')||'未填写数量'}</span>{!c.seen&&<span className="tag orange">未查看</span>}</header>
    <div className="checkin-thumbs">{c.images.map(k=><a key={k} href={checkinImageUrl(k)} target="_blank" rel="noreferrer"><img src={checkinImageUrl(k)} alt={`${c.day} 背单词截图`}/></a>)}</div>{c.note&&<p className="helper">学生：{c.note}</p>}
    <div className="checkin-comment-form"><input aria-label={`${c.day} 的点评`} maxLength={500} placeholder="写一句鼓励或建议（可留空，仅标记已查看）" value={drafts[c.id]??c.comment} onChange={e=>setDrafts({...drafts,[c.id]:e.target.value})}/><button className="btn secondary" disabled={busy===c.id} onClick={()=>comment(c)}>{c.seen?'更新点评':'已查看'}</button></div></article>):<p className="helper">学生还没有打卡记录。</p>}</div></div>
 </section>;
}
