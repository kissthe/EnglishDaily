import {z} from 'zod';
import {context,db,ApiError,failure,sameOrigin} from '@/lib/server';
export const dynamic='force-dynamic';
const payload=z.discriminatedUnion('op',[
 z.object({op:z.literal('send'),body:z.string().trim().min(1,'请输入留言').max(2000,'留言最多 2000 字')}),
 z.object({op:z.literal('read'),through:z.number().int().positive()})
]);
async function conversation(){const c=await context();const student=c.role==='student'?c.id:c.settings.studentId;if(!student)throw new ApiError('请先在教学设置中设置学生账号。',409);return {...c,student};}
export async function GET(req:Request){try{
 const c=await conversation(),raw=new URL(req.url).searchParams.get('before');
 const before=raw===null?Number.MAX_SAFE_INTEGER:z.coerce.number().int().positive().safe().parse(raw);
 const rows=(await db().prepare('SELECT id,author,body,created,read_at FROM messages WHERE student=? AND id<? ORDER BY id DESC LIMIT 51').bind(c.student,before).all()).results;
 const unread=await db().prepare('SELECT COUNT(*) AS count FROM messages WHERE student=? AND author<>? AND read_at IS NULL').bind(c.student,c.role).first();
 return Response.json({messages:rows.slice(0,50).reverse(),hasOlder:rows.length>50,unread:unread.count},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return e instanceof z.ZodError?Response.json({error:'分页参数不正确'},{status:400}):failure(e)}}
export async function POST(req:Request){try{
 sameOrigin(req);const c=await conversation(),p=payload.parse(await req.json()),now=new Date().toISOString();
 if(p.op==='send')await db().prepare('INSERT INTO messages(student,author,body,created) VALUES(?,?,?,?)').bind(c.student,c.role,p.body,now).run();
 else await db().prepare('UPDATE messages SET read_at=? WHERE student=? AND author<>? AND id<=? AND read_at IS NULL').bind(now,c.student,c.role,p.through).run();
 return Response.json({ok:true});
 }catch(e){return e instanceof z.ZodError?Response.json({error:e.issues.map(i=>i.message).join('；')},{status:400}):failure(e)}}
