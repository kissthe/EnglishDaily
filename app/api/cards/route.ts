import {z} from 'zod';
import {context,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {cardDataSchema} from '@/lib/close-reading';
import {cardsDocx,generateCard,getCard,keepRecite,listCards,saveCardData} from '@/lib/study-cards-server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const owner=(c:Awaited<ReturnType<typeof context>>)=>c.role==='teacher'?c.settings.studentId:c.id;

// 精读学习卡片：学生整理内容；老师可以查看、标记背诵抄写，并导出。
export async function GET(req:Request){try{
 const c=await context(),student=owner(c),url=new URL(req.url);
 const cards=student?await listCards(student):[];
 if(url.searchParams.get('export')==='docx'){
  const id=url.searchParams.get('id'),rows=id?cards.filter(x=>x.id===id):cards;
  if(id&&!rows.length)throw new ApiError('学习卡片不存在',404);
  const bytes=await cardsDocx(rows,c.settings?.studentName||'');
  const name=rows.length===1?`学习卡片-${rows[0].data.title}.docx`:'学习卡片.docx';
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="study-cards.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 return Response.json({role:c.role,cards},{headers:noStore});
}catch(e){return failure(e)}}

const payload=z.discriminatedUnion('op',[
 z.object({op:z.literal('generate'),task:z.string().min(1).max(100),replace:z.boolean().default(false)}),
 z.object({op:z.literal('save'),id:z.string().min(1).max(100),data:cardDataSchema}),
 z.object({op:z.literal('delete'),id:z.string().min(1).max(100)}),
 z.object({op:z.literal('recite'),id:z.string().min(1).max(100),item:z.string().min(1).max(40),recite:z.boolean()}),
]);
export async function POST(req:Request){try{
 sameOrigin(req);const c=await context(),p=payload.parse(await req.json());
 if(p.op==='recite'){
  if(c.role!=='teacher')throw new ApiError('背诵抄写由老师标记',403);
  const student=c.settings.studentId;if(!student)throw new ApiError('请先设置学生账号',409);
  const card=await getCard(student,p.id);if(!card.data.items.some(i=>i.id===p.item))throw new ApiError('卡片内容已变化，请刷新',409);
  await saveCardData(student,p.id,{...card.data,items:card.data.items.map(i=>i.id===p.item?{...i,recite:p.recite}:i)});
  return Response.json({cards:await listCards(student)});
 }
 if(c.role!=='student')throw new ApiError('学习卡片由学生整理；老师可以查看、标记背诵抄写和导出。',403);
 if(p.op==='generate')return Response.json({card:await getCard(c.id,await generateCard(c.id,p.task,p.replace))});
 const card=await getCard(c.id,p.id);
 if(p.op==='save')await saveCardData(c.id,p.id,keepRecite(card.data,p.data));
 else await db().prepare('DELETE FROM study_cards WHERE id=? AND student=?').bind(p.id,c.id).run();
 return Response.json({cards:await listCards(c.id)});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查卡片：'+e.issues.map(i=>i.message).join('；')},{status:400});return failure(e)}}
