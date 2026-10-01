'use client';
import {useState} from 'react';
import type {Material} from '@/lib/course';

export function ListeningImages({material}:{material:Material}){
 if(material.kind!=='听力'||!material.images?.length)return null;
 return <section className="listening-images" aria-label="听力配图">{material.images.map((image,i)=><figure key={image.url}><a href={image.url} target="_blank" rel="noreferrer" aria-label={`查看听力配图 ${i+1} 原图`}><img src={image.url} alt={image.caption||`听力配图 ${i+1}`} loading="lazy"/></a>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}</section>;
}

export function ListeningImageEditor({material,onChange,uploading,onUploading}:{material:Material;onChange:(value:Partial<Material>)=>void;uploading:boolean;onUploading:(value:boolean)=>void}){
 const [error,setError]=useState('');
 const images=material.images||[];
 async function upload(file:File){setError('');onUploading(true);try{
  if(images.length>=6)throw Error('每份听力材料最多上传 6 张图片');
  if(file.size>8*1024*1024)throw Error('图片不能超过 8MB');
  const form=new FormData();form.append('file',file);
  const r=await fetch('/api/media',{method:'POST',body:form}),d=await r.json();
  if(!r.ok)throw Error(d.error||'图片上传失败');
  onChange({images:[...images,{url:d.url,caption:''}]});
 }catch(e){setError((e as Error).message)}finally{onUploading(false)}}
 return <section className="listening-image-editor"><h3>听力配图</h3><p className="helper">支持 PNG、JPEG、WebP，每张不超过 8MB，最多 6 张。学生做题时即可查看，点击图片可打开原图。</p><label>上传图片<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||images.length>=6} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/></label>{error&&<p role="alert" className="error-text">{error}</p>}{images.map((image,i)=><div className="listening-image-edit" key={image.url}><img src={image.url} alt={image.caption||`听力配图 ${i+1}`}/><label>图片说明<input maxLength={300} value={image.caption} disabled={uploading} placeholder="例如：活动时间表或地图" onChange={e=>onChange({images:images.map((item,j)=>i===j?{...item,caption:e.target.value}:item)})}/></label><button type="button" className="text-link" disabled={uploading} onClick={()=>onChange({images:images.filter((_,j)=>i!==j)})}>移除图片</button></div>)}</section>;
}
