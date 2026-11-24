import {z} from 'zod';
import mammoth from 'mammoth';
import {context,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {aiJson} from '@/lib/ai-client';
import {today,type Material,type Settings} from '@/lib/course';
import {articleText,closeReadingSchema,crDraftSchema,findSentence,findWord,practiceKey,splitParagraphs,type CloseReading} from '@/lib/close-reading';
import {closeReadingTask,generateCard,listArticles,readProgress,writeProgress} from '@/lib/study-cards-server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};

// 列表：老师看到全部文章和学生进度；学生看到待精读、在读和读过的文章。?id= 返回单篇文章与进度。
export async function GET(req:Request){try{
 const c=await context(),id=new URL(req.url).searchParams.get('id'),teacher=c.role==='teacher',student=teacher?c.settings.studentId:c.id;
 if(!id)return Response.json({role:c.role,articles:await listArticles(student,teacher)},{headers:noStore});
 const m=await closeReadingTask(id);
 return Response.json({role:c.role,article:{id,title:m.title,subtitle:m.subtitle||'',source:m.source||'',closeReading:m.closeReading,archived:!!m.archived},progress:student?await readProgress(student,id):null},{headers:noStore});
}catch(e){return failure(e)}}

// AI 讲解：每段的重点词、重点句、仿写，以及标题和中文副标题。找不到原文的词句直接丢弃，避免标注错位。
async function aiNotes(settings:Settings,paragraphs:string[]){
 const draft=crDraftSchema.parse(await aiJson(settings,'closeReading',{paragraphs:paragraphs.map((text,i)=>({paragraph:i+1,text}))},`返回 {"title":"英文标题（文章没有标题时根据内容拟一个）","subtitle":"一句话中文概括","paragraphs":[{"words":[{"word":"","phonetic":"","meaning":"","usage":""}],"sentences":[{"text":"","grammar":"","translation":""}],"practice":[{"type":"word","target":"","prompt":"","example":""}]}]}。paragraphs 数组长度必须为 ${paragraphs.length}，与输入段落一一对应。words.word 必须是原文中出现的单词或短语，sentences.text 必须逐字复制原文中的完整句子。practice.type 只能是 "word"（用重点词造句）或 "sentence"（仿写句型）。`));
 if(draft.paragraphs.length!==paragraphs.length)throw new ApiError('AI 返回的段落数与文章不一致，请重试',502);
 const cr:CloseReading={paragraphs:paragraphs.map((text,i)=>{const p=draft.paragraphs[i];return {text,words:p.words.filter(w=>findWord(text,w.word)),sentences:p.sentences.filter(s=>findSentence(text,s.text)),practice:p.practice}})};
 return {title:draft.title,subtitle:draft.subtitle,closeReading:cr};
}
const material=(id:string,title:string,subtitle:string,source:string,cr:CloseReading):Material=>({id,title,subtitle,kind:'精读',level:'',minutes:0,body:articleText(cr),source,sourceUrl:'',rights:'课堂精读',audio:'',reviewed:true,questions:[],completionOnly:true,contentFormat:'text',closeReading:cr});
async function updateMaterial(id:string,m:Material){await db().prepare('UPDATE tasks SET material=? WHERE id=?').bind(JSON.stringify(m),id).run()}

const key=z.string().regex(/^\d{1,2}-\d$/);
const payload=z.discriminatedUnion('op',[
 z.object({op:z.literal('create'),title:z.string().trim().max(150).default(''),source:z.string().trim().max(300).default(''),text:z.string().trim().min(1,'请粘贴或上传文章').max(60000),ai:z.boolean().default(true)}),
 z.object({op:z.literal('extract'),name:z.string().max(200),data:z.string().max(14_000_000)}),
 z.object({op:z.literal('update'),id:z.string().min(1).max(100),title:z.string().trim().min(1).max(150),subtitle:z.string().trim().max(200).default(''),source:z.string().trim().max(300).default(''),closeReading:closeReadingSchema}),
 z.object({op:z.literal('regenerate'),id:z.string().min(1).max(100)}),
 z.object({op:z.literal('remove'),id:z.string().min(1).max(100)}),
 z.object({op:z.literal('draft'),paragraphs:z.array(z.string().trim().min(1).max(4000)).min(1).max(30)}),
 z.object({op:z.literal('save'),task:z.string().min(1).max(100),paragraph:z.number().int().min(0).max(29).default(0),answers:z.record(key,z.string().max(2000)).default({})}),
 z.object({op:z.literal('finish'),task:z.string().min(1).max(100)}),
 z.object({op:z.literal('comment'),task:z.string().min(1).max(100),key,text:z.string().trim().max(1000)}),
]);

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context(),p=payload.parse(await req.json()),now=new Date().toISOString();
 if(['create','extract','update','regenerate','remove','draft','comment'].includes(p.op)&&c.role!=='teacher')throw new ApiError('此操作仅限老师',403);
 if(p.op==='extract'){
  const bytes=Buffer.from(p.data,'base64');
  if(/\.txt$/i.test(p.name))return Response.json({text:bytes.toString('utf8')});
  if(!/\.docx$/i.test(p.name))throw new ApiError('请上传 .docx 或 .txt 文件');
  try{return Response.json({text:(await mammoth.extractRawText({buffer:bytes})).value.replace(/\n{3,}/g,'\n\n').trim()})}catch{throw new ApiError('无法读取这个 Word 文件，请检查文件是否损坏')}
 }
 if(p.op==='create'){
  const paragraphs=splitParagraphs(p.text);
  if(paragraphs.length>30)throw new ApiError('文章最多 30 段，请合并较短的段落');
  if(paragraphs.some(x=>x.length>4000))throw new ApiError('有段落超过 4000 字符，请检查段落之间是否空行');
  const notes=p.ai?await aiNotes(c.settings,paragraphs):{title:'',subtitle:'',closeReading:{paragraphs:paragraphs.map(text=>({text,words:[],sentences:[],practice:[]}))}};
  const title=p.title||notes.title||paragraphs[0].split(/\s+/).slice(0,6).join(' ')+'…';
  const id=crypto.randomUUID();
  await db().prepare('INSERT INTO tasks(id,date,material,note,created) VALUES(?,?,?,?,?)').bind(id,today(),JSON.stringify(material(id,title,notes.subtitle,p.source,notes.closeReading)),'精读',now).run();
  return Response.json({id});
 }
 if(p.op==='draft'){const d=await aiNotes(c.settings,p.paragraphs);return Response.json({paragraphs:d.closeReading.paragraphs})}
 if(p.op==='update'||p.op==='regenerate'||p.op==='remove'){
  const m=await closeReadingTask(p.id);
  if(p.op==='update'){const cr=closeReadingSchema.parse({paragraphs:p.closeReading.paragraphs.map(x=>({...x,words:x.words.filter(w=>findWord(x.text,w.word)),sentences:x.sentences.filter(s=>findSentence(x.text,s.text))}))});await updateMaterial(p.id,{...m,title:p.title,subtitle:p.subtitle,source:p.source,closeReading:cr,body:articleText(cr)})}
  else if(p.op==='regenerate'){const d=await aiNotes(c.settings,m.closeReading!.paragraphs.map(x=>x.text));await updateMaterial(p.id,{...m,subtitle:m.subtitle||d.subtitle,closeReading:d.closeReading})}
  else{
   // 学生已经读过、收藏或生成卡片时只从列表中移除，保留学生的记录；否则直接删除。
   const used=await db().prepare('SELECT (SELECT count(*) FROM close_reading WHERE task=?)+(SELECT count(*) FROM study_cards WHERE task=?)+(SELECT count(*) FROM annotations WHERE task=?)+(SELECT count(*) FROM submissions WHERE task=?) AS n').bind(p.id,p.id,p.id,p.id).first();
   if(used.n)await updateMaterial(p.id,{...m,archived:true});else await db().prepare('DELETE FROM tasks WHERE id=?').bind(p.id).run();
  }
  return Response.json({ok:true});
 }
 if(p.op==='comment'){
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
 // 完成精读：记为已读，并生成学习卡片（已有卡片时保留学生的修改）。
 progress.finished=progress.finished||now;
 await db().batch([writeProgress(c.id,p.task,progress,now),db().prepare("INSERT INTO submissions(id,task,student,answers,state,score,total,feedback,grades,corrections,submitted,updated) VALUES(?,?,?,'{}','reviewed',0,0,'','{}','{}',?,?) ON CONFLICT(task,student) DO UPDATE SET state='reviewed',submitted=coalesce(submissions.submitted,excluded.submitted),updated=excluded.updated WHERE submissions.state='draft'").bind(crypto.randomUUID(),p.task,c.id,now,now)]);
 return Response.json({progress:await readProgress(c.id,p.task),card:await generateCard(c.id,p.task)});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查内容：'+e.issues.map(i=>i.message).join('；')},{status:400});if(e instanceof ApiError)return failure(e);if(e instanceof Error&&/AI|接口|模型/.test(e.message))return Response.json({error:e.message},{status:502});return failure(e)}}
