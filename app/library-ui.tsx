'use client';
import {useEffect,useMemo,useState} from 'react';
import {Download,Eye,FileText,Plus,Trash2,Upload} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {Button,Choice} from './daily-app';
import {SafeHtml} from './safe-html';
import {WordbookCollector} from './wordbook-collect';
import {libraryCategories,prepareLibraryHtml,LIBRARY_FILE_LIMIT,type LibraryItem} from '@/lib/library';

async function call(init?:RequestInit,query=''){const r=await fetch('/api/library'+query,{cache:'no-store',...init});const d=await r.json();if(!r.ok)throw Error(d.error||'请求未完成，请重试');return d}
const post=(body:unknown)=>call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const sizeText=(n:number)=>n>1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const dateText=(s:string)=>s.slice(0,10);

export function LibraryHub({teacher}:{teacher:boolean}){
 const [items,setItems]=useState<LibraryItem[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState('全部');
 const [reading,setReading]=useState<{item:LibraryItem;html:string}|null>(null),[uploadOpen,setUploadOpen]=useState(false),[editing,setEditing]=useState<LibraryItem|null>(null),[busy,setBusy]=useState('');
 async function load(){try{setItems((await call()).items);setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{load()},[]);
 const categories=useMemo(()=>['全部',...new Set((items||[]).map(i=>i.category))],[items]);
 const visible=(items||[]).filter(i=>(category==='全部'||i.category===category)&&[i.title,i.description,i.fileName].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 async function open(item:LibraryItem){setBusy(item.id);try{const d=await call(undefined,'?id='+encodeURIComponent(item.id));setReading(d);window.scrollTo({top:0})}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 async function update(item:LibraryItem,patch:Partial<LibraryItem>,message:string){setBusy(item.id);try{await post({op:'update',id:item.id,item:{...item,...patch}});toast.success(message);await load()}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}
 async function remove(item:LibraryItem){if(!window.confirm(`确定删除“${item.title}”吗？原文件会一起删除，无法恢复。`))return;setBusy(item.id);try{await post({op:'delete',id:item.id});toast.success('已删除');await load()}catch(e){toast.error((e as Error).message)}finally{setBusy('')}}

 if(reading)return <div className="library-reader"><nav className="library-reader-nav"><Button secondary onClick={()=>setReading(null)}>← 返回资料库</Button>{(teacher||reading.item.allowDownload)&&<a className="btn secondary" href={'/api/library?download=1&id='+encodeURIComponent(reading.item.id)}><Download size={16}/>下载原文件</a>}</nav>
  <header className="library-reader-head"><span className="tag purple">{reading.item.category}</span>{teacher&&!reading.item.published&&<span className="tag neutral">未发布 · 仅老师可见</span>}<h1>{reading.item.title}</h1>{reading.item.description&&<p>{reading.item.description}</p>}<small>{reading.item.fileName} · 更新于 {dateText(reading.item.updated)}{reading.item.foldAnswers?' · 答案已折叠，先做题再点开':''}</small></header>
  <WordbookCollector source={{kind:'library',id:reading.item.id}} enabled={!teacher}><article className="library-document"><SafeHtml html={prepareLibraryHtml(reading.html,reading.item.foldAnswers)}/></article></WordbookCollector></div>;

 return <><div className="page-heading"><div><div className="kicker">RESOURCES</div><h1>资料库</h1><p>{teacher?'上传以前的教案和讲义（Word .docx），发布后学生可以在线阅读。':'老师整理的讲义和教案，可以随时打开复习。'}</p></div>{teacher&&<Button onClick={()=>setUploadOpen(true)}><Upload size={18}/>上传 Word 资料</Button>}</div>
  <div className="knowledge-filters"><label>搜索资料<input type="search" placeholder="搜索标题、说明或文件名" value={query} onChange={e=>setQuery(e.target.value)}/></label><nav aria-label="资料分类">{categories.map(c=><button className={c===category?'active':''} aria-pressed={c===category} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</nav></div>
  {error&&<p className="error-text" role="alert">{error}</p>}
  {!items&&!error&&<p className="helper">正在加载资料…</p>}
  {items&&!visible.length&&<div className="library-empty"><FileText size={28}/><p>{items.length?'没有符合条件的资料。':teacher?'还没有资料。点击右上角“上传 Word 资料”开始。':'老师还没有发布资料。'}</p></div>}
  <div className="material-grid bank-grid library-grid">{visible.map(item=><article className="material-card library-card" key={item.id}>
   <div className="material-top"><span className="kind-icon"><FileText size={20}/></span><span className="tag purple">{item.category}</span>{teacher&&<span className={'tag '+(item.published?'green':'neutral')}>{item.published?'已发布':'未发布'}</span>}</div>
   <h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}<small className="helper">{item.fileName} · {sizeText(item.size)} · {dateText(item.updated)}</small>
   <div className="library-actions"><Button disabled={busy===item.id} onClick={()=>open(item)}><Eye size={16}/>{busy===item.id?'打开中…':teacher?'预览':'阅读'}</Button>
    {teacher&&<><Button secondary disabled={busy===item.id} onClick={()=>update(item,{published:!item.published},item.published?'已撤回，学生暂时看不到':'已发布给学生')}>{item.published?'撤回':'发布'}</Button><Button secondary disabled={busy===item.id} onClick={()=>setEditing(item)}>编辑</Button><button className="library-delete" aria-label={'删除 '+item.title} disabled={busy===item.id} onClick={()=>remove(item)}><Trash2 size={17}/></button></>}</div>
  </article>)}</div>
  {teacher&&<UploadDialog open={uploadOpen} onClose={()=>setUploadOpen(false)} onDone={async()=>{setUploadOpen(false);await load()}}/>}
  {teacher&&editing&&<EditDialog item={editing} onClose={()=>setEditing(null)} onDone={async()=>{setEditing(null);await load()}}/>}
 </>;
}

function checkFile(f?:File|null){if(!f)return '请选择 Word 文档';if(/\.doc$/i.test(f.name))return '暂不支持旧版 .doc，请在 Word 中“另存为 .docx”后再上传';if(!/\.docx$/i.test(f.name))return '请上传 Word 文档（.docx）';if(f.size>LIBRARY_FILE_LIMIT)return '文件不能超过 20MB';return ''}

function UploadDialog({open,onClose,onDone}:{open:boolean;onClose:()=>void;onDone:()=>Promise<void>}){
 const [file,setFile]=useState<File|null>(null),[title,setTitle]=useState(''),[category,setCategory]=useState('教案'),[description,setDescription]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(open){setFile(null);setTitle('');setCategory('教案');setDescription('');setError('')}},[open]);
 async function submit(){const problem=checkFile(file);if(problem){setError(problem);return}setBusy(true);setError('');try{const form=new FormData();form.append('file',file!);form.append('title',title);form.append('category',category);form.append('description',description);await call({method:'POST',body:form});toast.success('已上传，核对后点“发布”学生才能看到');await onDone()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>上传 Word 资料</DialogTitle><DialogDescription>支持 .docx，20MB 以内。上传后会转换成网页，默认不发布，预览无误后再发布给学生。</DialogDescription></DialogHeader>
  <div className="form-stack"><label>Word 文件<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);setError(checkFile(f));if(f&&!title)setTitle(f.name.replace(/\.docx$/i,''))}}/></label>
   <label>标题<input maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="默认使用文件名"/></label>
   <label>分类<Choice label="资料分类" value={category} items={libraryCategories} onChange={setCategory}/></label>
   <label>说明（可选）<textarea rows={3} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="例如：时态专题复习，先做语篇填空再看答案"/></label>
   {error&&<p className="error-text" role="alert">{error}</p>}
   <div className="dialog-actions"><Button secondary disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy||!file} onClick={submit}><Plus size={16}/>{busy?'正在上传并转换…':'上传'}</Button></div></div>
 </DialogContent></Dialog>;
}

function EditDialog({item,onClose,onDone}:{item:LibraryItem;onClose:()=>void;onDone:()=>Promise<void>}){
 const [v,setV]=useState(item),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await post({op:'update',id:item.id,item:v});toast.success('已保存');await onDone()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function replace(f?:File){const problem=checkFile(f);if(problem){setError(problem);return}setBusy(true);setError('');try{const form=new FormData();form.append('file',f!);form.append('id',item.id);const d=await call({method:'POST',body:form});setV({...v,fileName:d.item.fileName,size:d.item.size});toast.success('已替换为新文件')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose()}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>编辑资料</DialogTitle><DialogDescription>{v.fileName} · {sizeText(v.size)}</DialogDescription></DialogHeader>
  <div className="form-stack"><label>标题<input maxLength={150} value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
   <label>分类<Choice label="资料分类" value={v.category} items={[...new Set([...libraryCategories,v.category])]} onChange={c=>setV({...v,category:c})}/></label>
   <label>说明<textarea rows={3} maxLength={1000} value={v.description} onChange={e=>setV({...v,description:e.target.value})}/></label>
   <label className="review-switch"><Switch checked={v.foldAnswers} onCheckedChange={x=>setV({...v,foldAnswers:x})}/>折叠“【答案…】”“【参考答案…】”等段落，学生点开才看到</label>
   <label className="review-switch"><Switch checked={v.allowDownload} onCheckedChange={x=>setV({...v,allowDownload:x})}/>允许学生下载 Word 原文件</label>
   <label className="review-switch"><Switch checked={v.published} onCheckedChange={x=>setV({...v,published:x})}/>发布给学生</label>
   <label>替换文件（保留标题和设置）<input type="file" accept=".docx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)replace(f)}}/></label>
   {error&&<p className="error-text" role="alert">{error}</p>}
   <div className="dialog-actions"><Button secondary disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy} onClick={save}>{busy?'正在保存…':'保存'}</Button></div></div>
 </DialogContent></Dialog>;
}
