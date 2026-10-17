'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SendHorizontal} from 'lucide-react';
type Message={id:number;author:'teacher'|'student';body:string;created:string;read_at:string|null};
type Page={messages:Message[];hasOlder:boolean;unread:number};
async function request(body?:unknown,before?:number){const r=await fetch('/api/messages'+(before?'?before='+before:''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'消息加载失败');return data as Page}
const zone={timeZone:'Asia/Shanghai'} as const;
const dayKey=(iso:string)=>new Intl.DateTimeFormat('sv-SE',zone).format(new Date(iso));
const time=(iso:string)=>new Intl.DateTimeFormat('zh-CN',{...zone,hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
function dayLabel(iso:string){const d=dayKey(iso),today=dayKey(new Date().toISOString()),yesterday=dayKey(new Date(Date.now()-86400000).toISOString());return d===today?'今天':d===yesterday?'昨天':new Intl.DateTimeFormat('zh-CN',{...zone,month:'long',day:'numeric',weekday:'short'}).format(new Date(iso))}

// 师生聊天：气泡式对话，最新消息在底部；聊天窗口可见时自动标记对方消息为已读。
export function MessageBoard({role}:{role:'teacher'|'student'}){
 const [messages,setMessages]=useState<Message[]>([]),[hasOlder,setHasOlder]=useState(false),[unread,setUnread]=useState(0),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const list=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null),input=useRef<HTMLTextAreaElement>(null),initial=useRef(false),stick=useRef(true),keep=useRef<number|null>(null),visible=useRef(false);
 const load=useCallback(async(before?:number)=>{const page=await request(undefined,before);setMessages(old=>[...new Map([...old,...page.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id));setUnread(page.unread);if(before||!initial.current)setHasOlder(page.hasOlder);initial.current=true;setLoaded(true);setError('')},[]);
 useEffect(()=>{let active=true;const refresh=()=>{if(active&&document.visibilityState==='visible')load().catch(e=>{if(active)setError(e.message)})};refresh();const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}},[load]);
 // 新消息到达时，如果原本停在底部就滚到最新；加载更早消息时保持当前位置。
 useLayoutEffect(()=>{const el=list.current;if(!el)return;if(keep.current!==null){el.scrollTop=el.scrollHeight-keep.current;keep.current=null}else if(stick.current)el.scrollTop=el.scrollHeight},[messages]);
 const markRead=useCallback(()=>{const last=messages.at(-1);if(!unread||!last||!visible.current||document.visibilityState!=='visible')return;request({op:'read',through:last.id}).then(()=>load()).catch(()=>{})},[messages,unread,load]);
 useEffect(()=>{const el=panel.current;if(!el)return;const io=new IntersectionObserver(([e])=>{visible.current=e.isIntersecting;markRead()},{threshold:0.3});io.observe(el);return ()=>io.disconnect()},[markRead]);
 useEffect(markRead,[markRead]);
 async function send(){const body=draft.trim();if(busy||!body)return;setBusy(true);setError('');try{await request({op:'send',body});setDraft('');stick.current=true;await load();input.current?.focus()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function older(){const el=list.current;keep.current=el?el.scrollHeight-el.scrollTop:null;setBusy(true);try{await load(messages[0]?.id)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const other=role==='teacher'?'学生':'老师',lastMine=[...messages].reverse().find(m=>m.author===role);
 return <section ref={panel} className="panel chat-board" aria-label={`和${other}聊天`}>
  <header className="chat-header"><span className="chat-avatar" aria-hidden>{other.slice(0,1)}</span><div><h2>{other}</h2><small>{role==='student'?'有问题、今天完成不了任务，都可以直接告诉老师':'学生的问题和情况说明会出现在这里'}</small></div>{unread>0&&<span className="chat-unread">{unread} 条新消息</span>}</header>
  <div ref={list} className="chat-messages" role="log" aria-live="polite" aria-label="聊天记录" tabIndex={0} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<60}}>
   {hasOlder&&<button className="chat-older" disabled={busy} onClick={older}>查看更早的消息</button>}
   {!loaded?<p className="chat-empty">正在加载…</p>:!messages.length?<p className="chat-empty">还没有消息，打个招呼吧 👋</p>:messages.map((m,i)=>{const mine=m.author===role,prev=messages[i-1],newDay=!prev||dayKey(prev.created)!==dayKey(m.created),grouped=!newDay&&prev.author===m.author&&new Date(m.created).getTime()-new Date(prev.created).getTime()<300000;return <div key={m.id} className="chat-row-wrap">
    {newDay&&<div className="chat-day"><span>{dayLabel(m.created)}</span></div>}
    <div className={'chat-row '+(mine?'mine':'theirs')+(grouped?' grouped':'')}>
     {!mine&&<span className="chat-avatar small" aria-hidden>{grouped?'':other.slice(0,1)}</span>}
     <div className="chat-bubble"><p>{m.body}</p><span className="chat-meta"><time dateTime={m.created}>{time(m.created)}</time>{mine&&m.id===lastMine?.id&&<span>{m.read_at?' · 已读':' · 未读'}</span>}</span></div>
    </div>
   </div>})}
  </div>
  <form className="chat-composer" onSubmit={e=>{e.preventDefault();void send()}}>
   <label htmlFor={'chat-'+role} className="sr-only">{role==='student'?'给老师发消息':'给学生发消息'}</label>
   <textarea ref={input} id={'chat-'+role} value={draft} rows={1} maxLength={2000} disabled={busy} placeholder={role==='student'?'给老师发消息…':'给学生发消息…'} onChange={e=>{setDraft(e.target.value);const t=e.target;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,140)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/>
   <button className="chat-send" type="submit" disabled={busy||!draft.trim()} aria-label="发送"><SendHorizontal size={20}/></button>
  </form>
  <p className="chat-hint">Enter 发送 · Shift + Enter 换行{draft.length>1800?` · ${draft.length}/2000`:''}</p>
  {error&&<p role="alert" className="error-text">{error}</p>}
 </section>;
}
