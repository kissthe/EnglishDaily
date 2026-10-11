'use client';
import {useMemo,useState} from 'react';
import {toast} from 'sonner';
import {Choice} from './daily-app';
import {LessonHtml} from './interactive-html';
import {INTERACTIVE_HTML_LIMIT,assetNamePattern,inspectInteractiveHtml,type MediaAsset} from '@/lib/interactive-html';
import {cultureCategories,type CultureCategory,type Material} from '@/lib/course';

const STATIC_LIMIT=120000;
const kindOf=(type:string):MediaAsset['type']|null=>type.startsWith('image/')?'image':type.startsWith('audio/')?'audio':type.startsWith('video/')?'video':null;
const slug=(name:string)=>name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'media';
const snippet=(a:MediaAsset)=>a.type==='image'?`<img data-media="${a.name}" alt="${a.caption||a.name}">`:a.type==='audio'?`<audio data-media="${a.name}" controls></audio>`:`<video data-media="${a.name}" controls playsinline></video>`;

// 知识拓展 HTML：静态页面（清洗后展示，可划线）或互动页面（沙箱运行脚本，可引用页面媒体）。
export function KnowledgeHtmlFields({m,patch,uploading,onUploading}:{m:Material;patch:(p:Partial<Material>)=>void;uploading:boolean;onUploading:(v:boolean)=>void}){
 const assets=useMemo(()=>m.assets||[],[m.assets]),limit=m.interactive?INTERACTIVE_HTML_LIMIT:STATIC_LIMIT,[name,setName]=useState(''),[error,setError]=useState('');
 const notes=useMemo(()=>m.interactive?inspectInteractiveHtml(m.body,assets):[],[m.interactive,m.body,assets]);
 async function readHtml(f:File){const text=await f.text(),interactive=m.interactive||/<script\b/i.test(text);if(text.length>(interactive?INTERACTIVE_HTML_LIMIT:STATIC_LIMIT)){toast.error(interactive?'互动页面不能超过 1MB':'静态页面不能超过 120KB，含脚本的页面请切换为互动页面');return}if(interactive&&!m.interactive)toast.info('页面包含脚本，已切换为互动页面');patch({body:text,contentFormat:'html',interactive})}
 async function upload(f:File){setError('');const type=kindOf(f.type),assetName=(name.trim()||slug(f.name)).toLowerCase();try{
  if(!type)throw Error('请选择图片、音频或视频文件');
  if(!assetNamePattern.test(assetName))throw Error('名称只能使用小写字母、数字和连字符，最多 40 个字符');
  if(assets.some(a=>a.name===assetName))throw Error(`名称“${assetName}”已存在`);
  if(assets.length>=40)throw Error('每个主题最多 40 个媒体文件');
  onUploading(true);const form=new FormData();form.append('file',f);
  const r=await fetch('/api/media',{method:'POST',body:form}),d=await r.json();if(!r.ok)throw Error(d.error||'上传失败');
  patch({assets:[...assets,{name:assetName,url:d.url,type,caption:''}]});setName('');toast.success(`已上传，页面中写 data-media="${assetName}" 引用`);
 }catch(e){setError((e as Error).message)}finally{onUploading(false)}}
 async function copy(a:MediaAsset){try{await navigator.clipboard.writeText(snippet(a));toast.success('已复制引用代码')}catch{toast.error('复制失败，请手动选择代码')}}
 return <div className="form-stack knowledge-html-fields">
  <fieldset className="knowledge-mode"><legend>页面类型</legend>
   <label><input type="radio" name="knowledge-mode" checked={!m.interactive} onChange={()=>patch({interactive:false})}/><span><b>静态页面</b>排版、图片、折叠内容；脚本会被移除，作为作业时支持划线批注。上限 120KB。</span></label>
   <label><input type="radio" name="knowledge-mode" checked={!!m.interactive} onChange={()=>patch({interactive:true})}/><span><b>互动页面</b>运行页面脚本（地图点选、翻卡、小游戏），在隔离沙箱中运行，不能联网、不能访问账号；可引用下方页面媒体。上限 1MB。</span></label>
  </fieldset>
  {!m.cultureConfig&&<label>主题系列<Choice label="主题系列" value={m.category||'主题阅读'} items={['主题阅读',...cultureCategories]} onChange={v=>patch({category:v==='主题阅读'?undefined:v as CultureCategory})}/></label>}
  <label>上传 HTML 文件（{m.interactive?'1MB':'120KB'} 以内）<input type="file" accept=".html,.htm,text/html" onChange={async e=>{const f=e.target.files?.[0];if(f)await readHtml(f);e.target.value=''}}/></label>
  <label>HTML 源码<textarea required rows={12} maxLength={limit} value={m.body} onChange={e=>patch({body:e.target.value,contentFormat:'html'})}/></label>
  {m.interactive?<section className="knowledge-assets"><h3>页面媒体</h3><p className="helper">图片 8MB、音频 20MB、视频 80MB 以内。上传后在 HTML 中用 <code>{'data-media="名称"'}</code> 引用；学生登录后才能加载。歌曲、电影请使用有授权的片段，并在“来源与版权”中注明。</p>
   <div className="knowledge-asset-upload"><label>媒体名称（可选）<input value={name} maxLength={40} placeholder="例如 la-skyline，留空则按文件名生成" onChange={e=>setName(e.target.value.toLowerCase())}/></label><label>选择文件<input type="file" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,video/mp4,video/webm" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/></label></div>
   {error&&<p role="alert" className="error-text">{error}</p>}
   {assets.map((a,i)=><div className="knowledge-asset" key={a.url}><div className="knowledge-asset-preview">{a.type==='image'?<img src={a.url} alt={a.caption||a.name}/>:a.type==='audio'?<audio controls preload="none" src={a.url}/>:<video controls preload="metadata" src={a.url}/>}</div><div><b>{a.name}</b><small>{({image:'图片',audio:'音频',video:'视频'})[a.type]}</small><code>{snippet(a)}</code><label>说明（可选）<input maxLength={300} value={a.caption||''} onChange={e=>patch({assets:assets.map((x,j)=>i===j?{...x,caption:e.target.value}:x)})}/></label><div className="knowledge-asset-actions"><button type="button" className="text-link" onClick={()=>copy(a)}>复制引用代码</button><button type="button" className="text-link" onClick={()=>patch({assets:assets.filter((_,j)=>j!==i)})}>移除</button></div></div></div>)}
  </section>:<p className="helper">脚本、表单和危险链接会被自动移除；发布后学生可从“知识拓展”直接查看。</p>}
  {notes.length>0&&<section className="knowledge-checks" aria-label="发布前检查"><h3>发布前检查</h3><ul>{notes.map(n=><li key={n}>{n}</li>)}</ul></section>}
  {m.body&&<details open><summary>页面预览{m.interactive&&' · 页面调用 EnglishDaily.done() 时会提示'}</summary><div className="html-preview-frame"><LessonHtml material={m} onDone={n=>toast.info('页面记录了互动：'+n)}/></div></details>}
 </div>;
}
