import {z} from 'zod';
import mammoth from 'mammoth';
import {context,bucket,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {DOCX_TYPE,LIBRARY_FILE_LIMIT,type LibraryItem} from '@/lib/library';
export const dynamic='force-dynamic';

type Stored=LibraryItem&{fileKey:string;htmlKey:string};
const meta=z.object({title:z.string().trim().min(1,'请填写标题').max(150),description:z.string().trim().max(1000).default(''),category:z.string().trim().min(1).max(30).default('教案'),published:z.boolean().default(false),allowDownload:z.boolean().default(true),foldAnswers:z.boolean().default(true)});
const noStore={'Cache-Control':'no-store'};
function publicItem({fileKey,htmlKey,...item}:Stored):LibraryItem{return item}
async function load(id:string):Promise<Stored>{const row=await db().prepare('SELECT data FROM library_items WHERE id=?').bind(id).first();if(!row)throw new ApiError('资料不存在',404);return JSON.parse(row.data)}
async function remove(key?:string){try{if(key)await bucket().delete?.(key)}catch{/* 文件已不存在 */}}

async function convert(file:File){
 if(file.size>LIBRARY_FILE_LIMIT)throw new ApiError('文件不能超过 20MB');
 const bytes=Buffer.from(await file.arrayBuffer());
 if(!/\.docx$/i.test(file.name)||bytes[0]!==0x50||bytes[1]!==0x4b)throw new ApiError(/\.doc$/i.test(file.name)?'暂不支持旧版 .doc，请在 Word 中“另存为 .docx”后再上传':'请上传 Word 文档（.docx）');
 let html:string;try{html=(await mammoth.convertToHtml({buffer:bytes})).value}catch{throw new ApiError('无法读取这个 Word 文件，请检查文件是否损坏')}
 if(!html.trim())throw new ApiError('文档内容为空');
 const fileKey=crypto.randomUUID(),htmlKey=crypto.randomUUID();
 await bucket().put(fileKey,bytes,{httpMetadata:{contentType:DOCX_TYPE}});
 await bucket().put(htmlKey,new TextEncoder().encode(html),{httpMetadata:{contentType:'text/html; charset=utf-8'}});
 return {fileKey,htmlKey,fileName:file.name.slice(0,200),size:file.size};
}

export async function GET(req:Request){try{
 const c=await context(),url=new URL(req.url),id=url.searchParams.get('id');
 if(!id){const rows:Stored[]=(await db().prepare('SELECT data FROM library_items ORDER BY position DESC,created DESC').all()).results.map((r:{data:string})=>JSON.parse(r.data));return Response.json({items:rows.filter(r=>c.role==='teacher'||r.published).map(publicItem)},{headers:noStore})}
 const item=await load(id);if(c.role!=='teacher'&&!item.published)throw new ApiError('资料不存在',404);
 if(url.searchParams.get('download')){
  if(c.role!=='teacher'&&!item.allowDownload)throw new ApiError('老师未开放下载',403);
  const object=await bucket().get(item.fileKey);if(!object)throw new ApiError('原文件不存在',404);
  return new Response(object.body,{headers:{'Content-Type':DOCX_TYPE,'Content-Disposition':`attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(item.fileName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const object=await bucket().get(item.htmlKey);if(!object)throw new ApiError('资料内容不存在',404);
 return Response.json({item:publicItem(item),html:await new Response(object.body).text()},{headers:noStore});
}catch(e){return failure(e)}}

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context();if(c.role!=='teacher')throw new ApiError('仅老师可以管理资料库',403);
 const now=new Date().toISOString();
 if((req.headers.get('content-type')||'').startsWith('multipart/form-data')){
  if(Number(req.headers.get('content-length')||0)>LIBRARY_FILE_LIMIT+1024*1024)throw new ApiError('文件不能超过 20MB');
  const form=await req.formData(),file=form.get('file'),id=String(form.get('id')||'');
  if(!(file instanceof File)||!file.size)throw new ApiError('请选择 Word 文档');
  const converted=await convert(file);
  if(id){const old=await load(id);const item={...old,...converted,updated:now};await db().prepare('UPDATE library_items SET data=?,updated=? WHERE id=?').bind(JSON.stringify(item),now,id).run();await remove(old.fileKey);await remove(old.htmlKey);return Response.json({item:publicItem(item)})}
  const fields=meta.parse({title:String(form.get('title')||'').trim()||file.name.replace(/\.docx$/i,''),description:String(form.get('description')||''),category:String(form.get('category')||'教案')});
  const position=Number((await db().prepare('SELECT COALESCE(MAX(position),0)+1 AS n FROM library_items').first())?.n||1);
  const item:Stored={id:crypto.randomUUID(),...fields,published:false,...converted,created:now,updated:now};
  await db().prepare('INSERT INTO library_items(id,data,position,created,updated) VALUES(?,?,?,?,?)').bind(item.id,JSON.stringify(item),position,now,now).run();
  return Response.json({item:publicItem(item)});
 }
 const p=z.object({op:z.enum(['update','delete']),id:z.string().min(1).max(100)}).passthrough().parse(await req.json());
 const old=await load(p.id);
 if(p.op==='delete'){await db().prepare('DELETE FROM library_items WHERE id=?').bind(p.id).run();await remove(old.fileKey);await remove(old.htmlKey);return Response.json({ok:true})}
 const item={...old,...meta.parse({...old,...(p as {item?:object}).item}),updated:now};
 await db().prepare('UPDATE library_items SET data=?,updated=? WHERE id=?').bind(JSON.stringify(item),now,p.id).run();
 return Response.json({item:publicItem(item)});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.issues.map(i=>i.message).join('；')},{status:400});return failure(e)}}
