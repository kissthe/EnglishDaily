import {z} from 'zod';
import {context,bucket,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {today,offsetDate} from '@/lib/course';
import {CHECKIN_IMAGE_LIMIT,CHECKIN_MAX_IMAGES,type Checkin} from '@/lib/checkin';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
type Row={id:string;student:string;day:string;app:string;words:number;minutes:number;note:string;images:string;comment:string;seen:number;created:string;updated:string};
const toCheckin=(r:Row):Checkin=>({id:r.id,day:r.day,app:r.app,words:r.words,minutes:r.minutes,note:r.note,images:JSON.parse(r.images),comment:r.comment,seen:!!r.seen,created:r.created,updated:r.updated});
function owner(c:Awaited<ReturnType<typeof context>>){return c.role==='teacher'?c.settings?.studentId:c.id}

function imageType(bytes:Uint8Array){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return '';
}

export async function GET(req:Request){try{
 const c=await context(),student=owner(c),url=new URL(req.url),image=url.searchParams.get('image');
 if(image){
  // 截图只能由本人和老师查看。
  if(!/^[-a-f0-9]{36}$/.test(image)||!student)throw new ApiError('图片不存在',404);
  const row=await db().prepare('SELECT id FROM checkins WHERE student=? AND instr(images,?)>0').bind(student,image).first();if(!row)throw new ApiError('图片不存在',404);
  const object=await bucket().get(image);if(!object)throw new ApiError('图片不存在',404);
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
 }
 const since=offsetDate(today(),-120);
 const rows=student?((await db().prepare('SELECT * FROM checkins WHERE student=? AND day>=? ORDER BY day DESC').bind(student,since).all()).results as Row[]):[];
 return Response.json({today:today(),checkins:rows.map(toCheckin)},{headers:noStore});
}catch(e){return failure(e)}}

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context(),now=new Date().toISOString();
 if((req.headers.get('content-type')||'').startsWith('multipart/form-data')){
  if(c.role!=='student')throw new ApiError('请在学生账号中打卡',403);
  if(Number(req.headers.get('content-length')||0)>CHECKIN_MAX_IMAGES*CHECKIN_IMAGE_LIMIT+1024*1024)throw new ApiError('图片太大，请少选几张或重新截图');
  const form=await req.formData(),day=today();
  const fields=z.object({app:z.string().trim().max(40).default(''),words:z.coerce.number().int().min(0).max(2000).default(0),minutes:z.coerce.number().int().min(0).max(600).default(0),note:z.string().trim().max(500).default(''),keep:z.string().max(1000).default('[]')}).parse({app:form.get('app')??undefined,words:form.get('words')||undefined,minutes:form.get('minutes')||undefined,note:form.get('note')??undefined,keep:form.get('keep')??undefined});
  const old=await db().prepare('SELECT * FROM checkins WHERE student=? AND day=?').bind(c.id,day).first() as Row|null;
  const oldImages:string[]=old?JSON.parse(old.images):[];
  let keep:string[];try{keep=z.array(z.string()).max(CHECKIN_MAX_IMAGES).parse(JSON.parse(fields.keep)).filter(k=>oldImages.includes(k))}catch{throw new ApiError('图片信息无效，请刷新后重试')}
  const files=form.getAll('images').filter((f):f is File=>f instanceof File&&f.size>0);
  if(keep.length+files.length>CHECKIN_MAX_IMAGES)throw new ApiError(`最多上传 ${CHECKIN_MAX_IMAGES} 张截图`);
  if(!keep.length&&!files.length)throw new ApiError('请上传背单词 App 的截图');
  const added:string[]=[];
  for(const f of files){
   if(f.size>CHECKIN_IMAGE_LIMIT)throw new ApiError('每张截图不能超过 8MB');
   const bytes=new Uint8Array(await f.arrayBuffer()),type=imageType(bytes);if(!type)throw new ApiError('请上传 PNG、JPG 或 WebP 格式的截图');
   const key=crypto.randomUUID();await bucket().put(key,bytes,{httpMetadata:{contentType:type}});added.push(key);
  }
  const images=[...keep,...added];
  await db().prepare(`INSERT INTO checkins(id,student,day,app,words,minutes,note,images,comment,seen,created,updated) VALUES(?,?,?,?,?,?,?,?,'',0,?,?)
   ON CONFLICT(student,day) DO UPDATE SET app=excluded.app,words=excluded.words,minutes=excluded.minutes,note=excluded.note,images=excluded.images,seen=0,updated=excluded.updated`)
   .bind(crypto.randomUUID(),c.id,day,fields.app,fields.words,fields.minutes,fields.note,JSON.stringify(images),now,now).run();
  for(const k of oldImages.filter(k=>!images.includes(k)))try{await bucket().delete?.(k)}catch{/* 已删除 */}
  return Response.json({ok:true});
 }
 const p=z.object({op:z.literal('comment'),id:z.string().min(1).max(100),comment:z.string().trim().max(500)}).parse(await req.json());
 if(c.role!=='teacher')throw new ApiError('仅老师可以点评打卡',403);
 const r=await db().prepare('UPDATE checkins SET comment=?,seen=1 WHERE id=? AND student=?').bind(p.comment,p.id,c.settings?.studentId||'').run();
 if(!r.meta?.changes)throw new ApiError('打卡记录不存在',404);
 return Response.json({ok:true});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查打卡内容：'+e.issues.map(i=>i.message).join('；')},{status:400});return failure(e)}}
