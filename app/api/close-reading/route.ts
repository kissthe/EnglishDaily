import {z} from 'zod';
import {context,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {aiJson} from '@/lib/ai-client';
import {crPracticeSchema,crSentenceSchema,crWordSchema,practiceKey} from '@/lib/close-reading';
import {closeReadingTask,generateCard,readProgress,writeProgress} from '@/lib/study-cards-server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};

// 精读进度：当前段落、仿写答案、老师点评。老师查看的是学生的记录。
export async function GET(req:Request){try{
 const c=await context(),task=new URL(req.url).searchParams.get('task')||'',student=c.role==='teacher'?c.settings.studentId:c.id;
 if(!student)return Response.json({progress:null},{headers:noStore});
 return Response.json({progress:await readProgress(student,task)},{headers:noStore});
}catch(e){return failure(e)}}

const payload=z.discriminatedUnion('op',[
 z.object({op:z.literal('save'),task:z.string().min(1).max(100),paragraph:z.number().int().min(0).max(29),answers:z.record(z.string().regex(/^\d{1,2}-\d$/),z.string().max(2000)).default({})}),
 z.object({op:z.literal('finish'),task:z.string().min(1).max(100)}),
 z.object({op:z.literal('comment'),task:z.string().min(1).max(100),key:z.string().regex(/^\d{1,2}-\d$/),text:z.string().trim().max(1000)}),
 z.object({op:z.literal('draft'),paragraphs:z.array(z.string().trim().min(1).max(4000)).min(1).max(30)}),
]);
const draftSchema=z.object({paragraphs:z.array(z.object({words:z.array(crWordSchema).max(8).default([]),sentences:z.array(crSentenceSchema).max(3).default([]),practice:z.array(crPracticeSchema).max(3).default([])}))});

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context(),p=payload.parse(await req.json()),now=new Date().toISOString();
 if(p.op==='draft'){
  if(c.role!=='teacher')throw new ApiError('此操作仅限老师',403);
  const result=draftSchema.parse(await aiJson(c.settings,'closeReading',{paragraphs:p.paragraphs.map((text,i)=>({paragraph:i+1,text}))},`返回 {"paragraphs":[{"words":[{"word":"","phonetic":"","meaning":"","usage":""}],"sentences":[{"text":"","grammar":"","translation":""}],"practice":[{"type":"word","target":"","prompt":"","example":""}]}]}。paragraphs 数组长度必须为 ${p.paragraphs.length}，与输入段落一一对应。sentences.text 必须逐字复制原文中的完整句子。practice.type 只能是 "word"（用重点词造句）或 "sentence"（仿写句型），target 写目标单词或句型名称。`));
  if(result.paragraphs.length!==p.paragraphs.length)throw new ApiError('AI 返回的段落数与文章不一致，请重试',502);
  return Response.json(result);
 }
 if(p.op==='comment'){
  if(c.role!=='teacher')throw new ApiError('此操作仅限老师',403);
  const student=c.settings.studentId;if(!student)throw new ApiError('请先设置学生账号',409);
  await closeReadingTask(p.task);const progress=await readProgress(student,p.task);
  if(p.text)progress.comments[p.key]=p.text;else delete progress.comments[p.key];
  await writeProgress(student,p.task,progress,now).run();return Response.json({progress:await readProgress(student,p.task)});
 }
 if(c.role!=='student')throw new ApiError('老师预览不会保存学生的精读记录',403);
 const m=await closeReadingTask(p.task),progress=await readProgress(c.id,p.task),cr=m.closeReading!;
 if(p.op==='save'){
  const valid=new Set(cr.paragraphs.flatMap((q,i)=>q.practice.map((_,j)=>practiceKey(i,j))));
  for(const [k,v] of Object.entries(p.answers)){if(!valid.has(k))throw new ApiError('仿写题不存在，请刷新');if(v.trim())progress.answers[k]=v;else delete progress.answers[k]}
  progress.paragraph=Math.min(p.paragraph,cr.paragraphs.length-1);
  await writeProgress(c.id,p.task,progress,now).run();
  return Response.json({progress:await readProgress(c.id,p.task)});
 }
 // 完成精读：记为作业已完成，并生成学习卡片（已有卡片时保留学生的修改）。
 progress.finished=progress.finished||now;
 await db().batch([writeProgress(c.id,p.task,progress,now),db().prepare("INSERT INTO submissions(id,task,student,answers,state,score,total,feedback,grades,corrections,submitted,updated) VALUES(?,?,?,'{}','reviewed',0,0,'','{}','{}',?,?) ON CONFLICT(task,student) DO UPDATE SET state='reviewed',submitted=coalesce(submissions.submitted,excluded.submitted),updated=excluded.updated WHERE submissions.state='draft'").bind(crypto.randomUUID(),p.task,c.id,now,now)]);
 return Response.json({progress:await readProgress(c.id,p.task),card:await generateCard(c.id,p.task)});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查内容：'+e.issues.map(i=>i.message).join('；')},{status:400});if(e instanceof ApiError)return failure(e);if(e instanceof Error&&/AI|接口|模型/.test(e.message))return Response.json({error:e.message},{status:502});return failure(e)}}
