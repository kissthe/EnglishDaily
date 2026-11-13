import {z} from 'zod';
import {context,bucket,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {normalizeMaterial} from '@/lib/course';
import {filterWordbook,normalizeEntry} from '@/lib/wordbook';
import {htmlToText,listEntries,upsertStatement,wordbookDocx} from '@/lib/wordbook-server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};

function owner(c:Awaited<ReturnType<typeof context>>){return c.role==='teacher'?c.settings?.studentId:c.id}

export async function GET(req:Request){try{
 const c=await context(),student=owner(c),url=new URL(req.url);
 const entries=student?await listEntries(student):[];
 if(url.searchParams.get('export')==='docx'){
  const o=z.object({kind:z.enum(['all','word','sentence']).default('all'),mode:z.enum(['full','quiz']).default('full'),includeMastered:z.enum(['0','1']).default('1')}).parse(Object.fromEntries(url.searchParams));
  const options={kind:o.kind,mode:o.mode,includeMastered:o.includeMastered==='1'};
  const rows=filterWordbook(entries,{kind:options.kind,includeMastered:options.includeMastered,query:url.searchParams.get('q')||''}).sort((a,b)=>a.created.localeCompare(b.created));
  const bytes=await wordbookDocx(rows,options,c.settings?.studentName||'同学');
  const name=`单词本${options.mode==='quiz'?'-默写版':''}.docx`;
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="wordbook.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 return Response.json({entries},{headers:noStore});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'导出参数无效'},{status:400});return failure(e)}}

// 从知识拓展或资料库页面收藏：核对来源对学生可见，并确认选中的文字确实出现在页面中。
async function sourceText(kind:'knowledge'|'library',id:string){
 if(kind==='knowledge'){const r=await db().prepare('SELECT data FROM materials WHERE id=?').bind(id).first();const m=r&&normalizeMaterial(JSON.parse(r.data));if(!m||m.kind!=='知识拓展'||!m.reviewed)throw new ApiError('来源不存在或尚未发布',404);return {title:m.title,text:htmlToText(m.body)+' '+(m.cultureConfig?[m.cultureConfig.explore,m.cultureConfig.fastFacts,m.cultureConfig.vocabulary,m.cultureConfig.cultureNotes].join(' '):'')}}
 const r=await db().prepare('SELECT data FROM library_items WHERE id=?').bind(id).first();const item=r&&JSON.parse(r.data);if(!item?.published)throw new ApiError('来源不存在或尚未发布',404);
 const object=await bucket().get(item.htmlKey);return {title:item.title,text:object?htmlToText(await new Response(object.body).text()):''};
}

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context();if(c.role!=='student')throw new ApiError('请在学生账号中收藏；老师可以查看和导出学生的单词本。',403);
 const p=z.object({op:z.enum(['add','update','delete'])}).passthrough().parse(await req.json()),now=new Date().toISOString();
 if(p.op==='add'){
  const x=z.object({kind:z.enum(['word','sentence']),text:z.string().trim().min(1).max(1000),note:z.string().max(4000).default(''),context:z.string().max(1000).default(''),sourceKind:z.enum(['knowledge','library']),sourceId:z.string().min(1).max(100)}).parse(p);
  const source=await sourceText(x.sourceKind,x.sourceId),squash=(s:string)=>normalizeEntry(s).replace(/[‘’]/g,"'");
  if(source.text&&!squash(source.text).includes(squash(x.text)))throw new ApiError('选中的文字与页面内容不一致，请重新选择');
  await upsertStatement(c.id,{...x,context:x.context===x.text?'':x.context,sourceTitle:source.title},now).run();
  const row=await db().prepare('SELECT id FROM wordbook WHERE student=? AND kind=? AND norm=?').bind(c.id,x.kind,normalizeEntry(x.text)).first();
  return Response.json({ok:true,id:row?.id});
 }
 const id=z.string().min(1).max(100).parse(p.id);
 const old=await db().prepare('SELECT * FROM wordbook WHERE id=? AND student=?').bind(id,c.id).first();if(!old)throw new ApiError('找不到这条收藏',404);
 if(p.op==='delete'){
  // 来自作业划线的收藏：保留原文中的划线，只从单词本移除。
  await db().batch([db().prepare('DELETE FROM wordbook WHERE id=? AND student=?').bind(id,c.id),...(old.annotation?[db().prepare("UPDATE annotations SET kind='highlight',updated=? WHERE id=? AND student=?").bind(now,old.annotation,c.id)]:[])]);
  return Response.json({ok:true});
 }
 const x=z.object({note:z.string().max(4000).optional(),kind:z.enum(['word','sentence']).optional(),mastered:z.boolean().optional()}).parse(p);
 const kind=x.kind??old.kind,note=x.note??old.note;
 if(kind!==old.kind&&await db().prepare('SELECT id FROM wordbook WHERE student=? AND kind=? AND norm=? AND id!=?').bind(c.id,kind,old.norm,id).first())throw new ApiError('单词本里已经有这一条了');
 await db().batch([db().prepare('UPDATE wordbook SET kind=?,note=?,mastered=?,updated=? WHERE id=? AND student=?').bind(kind,note,x.mastered===undefined?old.mastered:x.mastered?1:0,now,id,c.id),...(old.annotation?[db().prepare('UPDATE annotations SET kind=?,note=?,updated=? WHERE id=? AND student=?').bind(kind,note,now,old.annotation,c.id)]:[])]);
 return Response.json({ok:true});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查内容：'+e.issues.map(i=>i.message).join('；')},{status:400});return failure(e)}}
