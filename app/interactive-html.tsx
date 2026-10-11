'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useTheme} from 'next-themes';
import {SafeHtml} from './safe-html';
import {BRIDGE_CHANNEL,bilibiliPlayerUrl,buildInteractiveDocument,parseBilibili,type MediaAsset} from '@/lib/interactive-html';

type Embed={id:number;url:string;x:number;y:number;w:number;h:number;visible:boolean};
import type {Material} from '@/lib/course';

// 不加 allow-same-origin：页面脚本运行在独立的空源中，读不到登录 Cookie，也无法调用 /api。
export function InteractiveHtml({html,assets=[],onDone}:{html:string;assets?:MediaAsset[];onDone?:(name:string)=>void}){
 const {resolvedTheme}=useTheme(),theme:'light'|'dark'=resolvedTheme==='dark'?'dark':'light';
 const ref=useRef<HTMLIFrameElement>(null),themeRef=useRef(theme),assetsRef=useRef(assets),doneRef=useRef(onDone),blobs=useRef(new Map<string,Promise<Blob>>()),growth=useRef({count:0,at:0}),heightRef=useRef(600);
 const [height,setHeight]=useState(600),[initialTheme]=useState(theme),[embeds,setEmbeds]=useState<Embed[]>([]),embedRefs=useRef(new Map<number,HTMLIFrameElement>());
 useEffect(()=>{themeRef.current=theme;assetsRef.current=assets;doneRef.current=onDone});
 // 只在页面内容变化时重建文档；切换主题通过消息通知（页面就绪时也会同步），不打断学生正在进行的互动。
 const srcDoc=useMemo(()=>buildInteractiveDocument(html,initialTheme),[html,initialTheme]);
 const post=(message:Record<string,unknown>)=>ref.current?.contentWindow?.postMessage({...message,channel:BRIDGE_CHANNEL},'*');
 useEffect(()=>{post({type:'theme',theme})},[theme]);
 useEffect(()=>{
  function media(id:unknown,name:unknown){
   const asset=assetsRef.current.find(a=>a.name===name);
   if(!asset){post({type:'media',id,ok:false,error:'找不到页面媒体'});return}
   let blob=blobs.current.get(asset.url);
   if(!blob){blob=fetch(asset.url,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('媒体加载失败');return r.blob()});blob.catch(()=>blobs.current.delete(asset.url));blobs.current.set(asset.url,blob)}
   blob.then(b=>post({type:'media',id,ok:true,blob:b}),e=>post({type:'media',id,ok:false,error:(e as Error).message}));
  }
  // 页面若按视口高度布局，高度会与 iframe 互相推高；短时间内连续增长时停止跟随。
  function resize(next:number){const g=growth.current,now=Date.now();if(next>heightRef.current){g.count=now-g.at<1500?g.count+1:1;g.at=now;if(g.count>8)return}else g.count=0;heightRef.current=next;setHeight(next)}
  function receive(e:MessageEvent){
   const m=e.data;if(!ref.current||e.source!==ref.current.contentWindow||!m||m.channel!==BRIDGE_CHANNEL)return;
   if(m.type==='ready')post({type:'theme',theme:themeRef.current});
   else if(m.type==='resize'&&Number.isFinite(m.height))resize(Math.min(60000,Math.max(200,Math.ceil(m.height))));
   else if(m.type==='media')media(m.id,m.name);
   else if(m.type==='done'&&typeof m.name==='string'&&m.name.trim())doneRef.current?.(m.name.trim().slice(0,60));
   else if(m.type==='embeds'&&Array.isArray(m.items))setEmbeds(m.items.slice(0,20).flatMap((item:Record<string,unknown>)=>{const video=parseBilibili(String(item?.value||''),String(item?.p||''),String(item?.t||''));const n=(v:unknown)=>Number.isFinite(v)?Number(v):0;return video&&Number.isInteger(item.id)?[{id:Number(item.id),url:bilibiliPlayerUrl(video),x:n(item.x),y:n(item.y),w:Math.max(0,n(item.w)),h:Math.max(0,n(item.h)),visible:!!item.visible}]:[]}));
  }
  // 跨域播放器内的点击无法直接监听；焦点移入播放器时通知页面（可用于 EnglishDaily.done）。
  function blur(){setTimeout(()=>{for(const [id,frame] of embedRefs.current)if(document.activeElement===frame)post({type:'embed',id,event:'play'})})}
  window.addEventListener('message',receive);window.addEventListener('blur',blur);return ()=>{window.removeEventListener('message',receive);window.removeEventListener('blur',blur)};
 },[]);
 // B 站官方播放器放在沙箱外层、盖在页面占位处：它运行在 player.bilibili.com 自己的源中，不能导航本站或打开弹窗。
 return <div className="interactive-html-wrap" style={{height}}><iframe ref={ref} title="知识拓展互动页面" className="lesson-html interactive-html" sandbox="allow-scripts" allow="fullscreen; autoplay" referrerPolicy="no-referrer" srcDoc={srcDoc} style={{height}}/>{embeds.map(e=><iframe key={e.id+e.url} ref={el=>{if(el)embedRefs.current.set(e.id,el);else embedRefs.current.delete(e.id)}} title="B 站视频" className="bilibili-embed" src={e.url} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" style={{left:e.x,top:e.y,width:e.w,height:e.h,visibility:e.visible?'visible':'hidden'}}/>)}</div>;
}

// 互动页面在沙箱中运行；静态页面沿用清洗后的展示方式，并保留划线批注。
export function LessonHtml({material,annotatable=false,onDone}:{material:Pick<Material,'body'|'interactive'|'assets'>;annotatable?:boolean;onDone?:(name:string)=>void}){
 return material.interactive?<InteractiveHtml html={material.body} assets={material.assets} onDone={onDone}/>:<SafeHtml html={material.body} annotatable={annotatable}/>;
}
