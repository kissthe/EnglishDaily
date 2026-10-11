import {context,db,ApiError,failure} from '@/lib/server';
import {normalizeMaterial,studentKnowledge,type Material} from '@/lib/course';
export const dynamic='force-dynamic';

// 单个知识拓展主题。课程列表不再给学生下发页面正文，打开主题时才加载。
export async function GET(req:Request){try{const c=await context(),id=new URL(req.url).searchParams.get('id')||'';const row=await db().prepare('SELECT data FROM materials WHERE id=?').bind(id).first();const m=row?normalizeMaterial(JSON.parse(row.data)) as Material:null;if(!m||m.kind!=='知识拓展'||c.role!=='teacher'&&!m.reviewed)throw new ApiError('主题尚未发布或不存在。',404);return Response.json({role:c.role,material:c.role==='teacher'?m:studentKnowledge(m)},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
