import {context,bucket,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {today} from '@/lib/course';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 sameOrigin(req);const c=await context();if(c.role!=='teacher')throw new ApiError('仅老师可以上传图片或视频',403);
 if(Number(req.headers.get('content-length'))>81*1024*1024)throw new ApiError('文件过大');
 const form=await req.formData(),f=form.get('file');if(!(f instanceof File)||!f.size)throw new ApiError('请选择文件');
 const image=['image/png','image/jpeg','image/webp'].includes(f.type);
 if(image){
  if(f.size>8*1024*1024)throw new ApiError('图片不能超过 8MB');
  const bytes=new Uint8Array(await f.slice(0,12).arrayBuffer());
  const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
  if(!(f.type==='image/png'&&png||f.type==='image/jpeg'&&jpeg||f.type==='image/webp'&&webp))throw new ApiError('图片格式与文件内容不符，请使用 PNG、JPEG 或 WebP');
 }else if(f.size>80*1024*1024||!['video/mp4','video/webm'].includes(f.type))throw new ApiError('请选择 8MB 以内的 PNG/JPEG/WebP 图片，或 80MB 以内的 MP4/WebM 视频');
 const key=crypto.randomUUID();await bucket().put(key,f.stream(),{httpMetadata:{contentType:f.type}});return Response.json({url:'/api/media?key='+key});
}catch(e){return failure(e)}}
export async function GET(req:Request){try{const c=await context(),key=new URL(req.url).searchParams.get('key');if(!key||!/^[-a-f0-9]{36}$/.test(key))throw new ApiError('图片或视频不存在',404);if(c.role==='student'){const rows=await db().prepare('SELECT material FROM tasks WHERE date <= ?').bind(today()).all();if(!rows.results.some((r:any)=>(()=>{const m=JSON.parse(r.material),url='/api/media?key='+key;return m.video===url||m.images?.some((image:{url:string})=>image.url===url)})()))throw new ApiError('无权访问此文件',403)}const head=await bucket().head(key);if(!head)throw new ApiError('视频不存在',404);let range:undefined|{offset:number;length:number};const requested=req.headers.get('range');if(requested){const match=/^bytes=(\d*)-(\d*)$/.exec(requested);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});let start=match[1]?Number(match[1]):Math.max(0,head.size-Number(match[2]));let end=match[1]?(match[2]?Math.min(Number(match[2]),head.size-1):head.size-1):head.size-1;if(start>=head.size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});range={offset:start,length:end-start+1}}const object=await bucket().get(key,range?{range}:undefined);if(!object)throw new ApiError('视频不存在',404);const headers:Record<string,string>={'Content-Type':head.httpMetadata?.contentType||'video/mp4','Accept-Ranges':'bytes','Content-Length':String(range?.length??head.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};if(range)headers['Content-Range']=`bytes ${range.offset}-${range.offset+range.length-1}/${head.size}`;return new Response(object.body,{status:range?206:200,headers})}catch(e){return failure(e)}}
