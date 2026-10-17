import {context,db,ApiError,failure} from '@/lib/server';
import {normalizeMaterial,studentKnowledge,today,type Material} from '@/lib/course';
import {pickDaily} from '@/lib/daily-pick';
export const dynamic='force-dynamic';

// 单个知识拓展主题。课程列表不再给学生下发页面正文，打开主题时才加载。
export async function GET(req:Request){try{const c=await context(),params=new URL(req.url).searchParams,id=params.get('id')||'';
 if(params.get('daily')==='1'){const rows=(await db().prepare('SELECT data FROM materials').all()).results.map((r:any)=>normalizeMaterial(JSON.parse(r.data)) as Material).filter((m:Material)=>m.kind==='知识拓展'&&m.reviewed);const progress=new Map<string,{status:string;activities?:string[]}>(c.role==='student'?(await db().prepare('SELECT material,data FROM culture_progress WHERE student=?').bind(c.id).all()).results.map((r:any)=>[r.material,JSON.parse(r.data)]):[]);return Response.json({day:today(),total:rows.length,explored:rows.filter((m:Material)=>progress.has(m.id)).length,pick:pickDaily(rows,progress,today())},{headers:{'Cache-Control':'no-store'}})}
 const row=await db().prepare('SELECT data FROM materials WHERE id=?').bind(id).first();const m=row?normalizeMaterial(JSON.parse(row.data)) as Material:null;if(!m||m.kind!=='知识拓展'||c.role!=='teacher'&&!m.reviewed)throw new ApiError('主题尚未发布或不存在。',404);return Response.json({role:c.role,material:c.role==='teacher'?m:studentKnowledge(m)},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
