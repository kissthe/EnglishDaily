// 互动 HTML：在无本站身份的沙箱 iframe 中运行教师页面脚本，只通过 postMessage 与平台通信。
export const BRIDGE_CHANNEL='english-daily';
export const INTERACTIVE_HTML_LIMIT=1_000_000;
export type MediaAsset={name:string;url:string;type:'image'|'audio'|'video';caption?:string};
export const assetNamePattern=/^[a-z0-9][a-z0-9-]{0,39}$/;

// 页面中所有请求都被 CSP 禁止；图片可用 https 外链（兼容旧页面），媒体只经平台以 Blob 交给页面。
export const INTERACTIVE_CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'";

function bridge(theme:'light'|'dark'){return `(function(){
var C=${JSON.stringify(BRIDGE_CHANNEL)},P=window.parent,seq=0,waiting={},finished={},urls={};
function send(m){m.channel=C;P.postMessage(m,'*')}
['localStorage','sessionStorage'].forEach(function(k){try{window[k].getItem('x')}catch(e){var d={},s={getItem:function(x){return Object.prototype.hasOwnProperty.call(d,x)?d[x]:null},setItem:function(x,v){d[x]=String(v)},removeItem:function(x){delete d[x]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null}};Object.defineProperty(s,'length',{get:function(){return Object.keys(d).length}});try{Object.defineProperty(window,k,{value:s,configurable:true})}catch(_){}}});
function setTheme(t){var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.classList.toggle('light',t!=='dark');r.setAttribute('data-theme',t);api.theme=t;document.dispatchEvent(new CustomEvent('englishdaily:theme',{detail:t}))}
var api={theme:${JSON.stringify(theme)},
 media:function(name){var id=++seq;return new Promise(function(res,rej){waiting[id]={res:res,rej:rej};send({type:'media',id:id,name:String(name)})})},
 done:function(name){name=String(name||'').trim().slice(0,60);if(!name||finished[name])return;finished[name]=1;send({type:'done',name:name})},
 onTheme:function(cb){document.addEventListener('englishdaily:theme',function(e){cb(e.detail)})}};
window.EnglishDaily=api;
function load(el){var n=el.getAttribute('data-media');if(!n||el.__edMedia===n)return;el.__edMedia=n;(urls[n]||(urls[n]=api.media(n))).then(function(u){el.src=u;el.removeAttribute('data-media-error');if(el.tagName==='SOURCE'&&el.parentElement&&el.parentElement.load)el.parentElement.load()}).catch(function(){el.setAttribute('data-media-error','')})}
function scan(node){if(node.nodeType!==1)return;if(node.hasAttribute('data-media'))load(node);node.querySelectorAll('[data-media]').forEach(load)}
// B 站视频占位：只上报位置，平台在 iframe 外层把官方播放器盖在占位处。
var slots=[],lastSlots='';
// 折叠的 <details> 内容在部分浏览器中仍有尺寸，需要单独判断。
function shown(el,r){if(!(r.width>0&&r.height>0))return false;var d=el.closest('details:not([open])'),s=el.closest('summary');if(d&&!(s&&s.parentElement===d))return false;if(el.checkVisibility)return el.checkVisibility({visibilityProperty:true});return getComputedStyle(el).visibility!=='hidden'}
function report(){document.querySelectorAll('[data-bilibili]').forEach(function(el){if(!el.__edSlot)el.__edSlot=slots.push(el)});if(!slots.length&&lastSlots==='[]')return;var items=slots.filter(function(el){return el.isConnected}).map(function(el){var r=el.getBoundingClientRect();return {id:el.__edSlot,value:el.getAttribute('data-bilibili')||'',p:el.getAttribute('data-p')||'',t:el.getAttribute('data-t')||'',x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),visible:shown(el,r)}}),s=JSON.stringify(items);if(s!==lastSlots){lastSlots=s;send({type:'embeds',items:items})}}
window.addEventListener('message',function(e){var m=e.data;if(e.source!==P||!m||m.channel!==C)return;if(m.type==='theme')setTheme(m.theme==='dark'?'dark':'light');if(m.type==='embed'){var el=slots[m.id-1];if(el)el.dispatchEvent(new CustomEvent('englishdaily:video',{detail:{event:m.event},bubbles:true}))}if(m.type==='media'&&waiting[m.id]){var w=waiting[m.id];delete waiting[m.id];if(m.ok)w.res(URL.createObjectURL(m.blob));else w.rej(new Error(m.error||'媒体加载失败'))}});
var last=0;function size(){var b=document.body;if(!b)return;var s=getComputedStyle(b),h=Math.ceil(Math.max(b.scrollHeight,b.getBoundingClientRect().height)+parseFloat(s.marginTop||0)+parseFloat(s.marginBottom||0));if(h!==last){last=h;send({type:'resize',height:h})}report()}
setTheme(api.theme);
document.addEventListener('DOMContentLoaded',function(){scan(document.documentElement);new MutationObserver(function(list){list.forEach(function(r){if(r.type==='attributes')load(r.target);else r.addedNodes.forEach(scan)})}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-media']});if(window.ResizeObserver)new ResizeObserver(size).observe(document.body);size();send({type:'ready'})});
window.addEventListener('load',size);window.addEventListener('scroll',report,{passive:true});setInterval(report,400);
})();`}

// 把平台头部（CSP、基础样式、桥接脚本）放在教师页面的 <head> 最前面，CSP 才会作用于其后的全部内容。
export function buildInteractiveDocument(html:string,theme:'light'|'dark'='light'){
 const head=`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${INTERACTIVE_CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light}html.dark{color-scheme:dark}img,video{max-width:100%}[data-bilibili]{display:block;width:100%;aspect-ratio:16/9;background:#0b0f19;border-radius:12px}</style><script>${bridge(theme)}</script>`;
 const headTag=/<head(\s[^>]*)?>/i.exec(html);
 if(headTag)return '<!doctype html>'+html.slice(0,headTag.index+headTag[0].length).replace(/^\s*<!doctype[^>]*>/i,'')+head+html.slice(headTag.index+headTag[0].length);
 const htmlTag=/<html(\s[^>]*)?>/i.exec(html);
 if(htmlTag)return '<!doctype html>'+html.slice(0,htmlTag.index+htmlTag[0].length).replace(/^\s*<!doctype[^>]*>/i,'')+'<head>'+head+'</head>'+html.slice(htmlTag.index+htmlTag[0].length);
 return '<!doctype html><html><head>'+head+'</head><body>'+html.replace(/^\s*<!doctype[^>]*>/i,'')+'</body></html>';
}

// B 站视频：data-bilibili 可写 BV 号或视频页完整地址；data-p 为分 P，data-t 为开始秒数。
export type BilibiliVideo={bvid:string;p:number;t:number};
export function parseBilibili(value:string,p='',t=''):BilibiliVideo|null{
 const v=value.trim(),bvid=/(?:^|\/video\/|[?&]bvid=)(BV[0-9A-Za-z]{10})(?![0-9A-Za-z])/.exec(v)?.[1];if(!bvid)return null;
 let page=Number(p)||0,start=Number(t)||0;try{const u=new URL(v);page||=Number(u.searchParams.get('p'))||0;start||=Number(u.searchParams.get('t'))||0}catch{}
 return {bvid,p:Math.min(999,Math.max(1,Math.floor(page)||1)),t:Math.min(86400,Math.max(0,Math.floor(start)))};
}
export function bilibiliPlayerUrl(v:BilibiliVideo){const q=new URLSearchParams({bvid:v.bvid,p:String(v.p),page:String(v.p),autoplay:'0',danmaku:'0',high_quality:'1'});if(v.t)q.set('t',String(v.t));return 'https://player.bilibili.com/player.html?'+q}
export function bilibiliValues(html:string){return [...html.matchAll(/data-bilibili\s*=\s*["']([^"']*)["']/gi)].map(m=>m[1])}

export function mediaNames(html:string){return [...new Set([...html.matchAll(/data-media\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1].trim()))]}

// 上传与编辑时的提示，帮助教师在发布前发现会被沙箱阻止的写法；不是安全边界。
export function inspectInteractiveHtml(html:string,assets:MediaAsset[]=[]){
 const notes:string[]=[];
 if(html.length>INTERACTIVE_HTML_LIMIT)notes.push('页面超过 1MB，请压缩内嵌图片，或把图片改为上传到“页面媒体”。');
 if(/<script\b[^>]*\bsrc\s*=/i.test(html))notes.push('检测到外部脚本（<script src>），会被阻止。请把需要的代码直接写进页面。');
 if(/<link\b[^>]*rel\s*=\s*["']?(stylesheet|preload)/i.test(html)||/@import\s+url\(\s*["']?https?:/i.test(html))notes.push('检测到外部样式或字体（如 Google Fonts），会被阻止。请使用系统字体或内联 CSS。');
 if(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/.test(html))notes.push('页面尝试联网（fetch / XMLHttpRequest 等），沙箱会阻止所有网络请求。');
 if(/<iframe\b|<embed\b|<object\b/i.test(html))notes.push('页面包含 iframe / embed，外站内容无法加载。B 站视频请改用 <div data-bilibili="BV号"></div>；自己的音视频请上传到“页面媒体”后用 data-media 引用。');
 for(const v of bilibiliValues(html))if(!parseBilibili(v))notes.push(/b23\.tv/i.test(v)?`B 站短链接“${v}”无法识别，请在浏览器打开后复制地址栏中的完整地址（含 BV 号）。`:`无法识别的 B 站视频“${v}”，请填写 BV 号或视频页地址。`);
 if(/<(img|video|audio|source)\b[^>]*\bsrc\s*=\s*["']http:\/\//i.test(html))notes.push('检测到 http:// 图片或媒体，只允许 https 外链或页面媒体。');
 if(/<(video|audio|source)\b[^>]*\bsrc\s*=\s*["']https?:\/\//i.test(html))notes.push('音视频不能使用外链，请上传到“页面媒体”后写 data-media="名称"。');
 if(/<form\b/i.test(html))notes.push('表单无法提交到任何地方；交互请用按钮和脚本处理。');
 if(/\b100d?vh\b/i.test(html))notes.push('页面使用了 100vh，可能导致高度不断增大；平台会自动适配高度，建议去掉。');
 if(!/\.dark\b|data-theme|prefers-color-scheme/.test(html))notes.push('页面没有夜间样式。建议为 html.dark 定义配色（模板中已有示例）。');
 const names=new Set(assets.map(a=>a.name));
 for(const name of mediaNames(html))if(!names.has(name))notes.push(`找不到页面媒体“${name}”，请先上传并使用相同名称。`);
 return notes;
}
