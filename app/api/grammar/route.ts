import {z} from 'zod';
import {context,sameOrigin,failure,ApiError} from '@/lib/server';
import {today} from '@/lib/course';
import {grammarQuestionSchema,grammarTopics,parseGrammarMarkdown} from '@/lib/grammar-bank';
import {addGrammarQuestions,answerGrammar,ensureGrammar,grammarState,saveGrammarQuestion,setGrammarSettings,startGrammar} from '@/lib/grammar-store';
export const dynamic='force-dynamic';

export async function GET(req:Request){try{
 const c=await context();ensureGrammar();
 const s=grammarState(c.role==='teacher'?c.settings.studentId||'':c.id,c.role==='teacher');
 if(new URL(req.url).searchParams.get('summary')==='1')return Response.json({day:s.day,dailyCount:s.dailyCount,started:s.items.length>0,total:s.items.length,done:s.done,correct:s.correct,due:s.due,available:s.available},{headers:{'Cache-Control':'no-store'}});
 return Response.json(s,{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

const payload=z.discriminatedUnion('op',[
 z.object({op:z.literal('start')}),
 z.object({op:z.literal('more')}),
 z.object({op:z.literal('answer'),id:z.string().max(100),choice:z.number().int().min(0).max(3).nullable(),unsure:z.boolean().default(false)}),
 z.object({op:z.literal('settings'),dailyCount:z.number().int().min(1).max(50),topics:z.array(z.enum(grammarTopics)).max(grammarTopics.length)}),
 z.object({op:z.literal('save'),question:grammarQuestionSchema}),
 z.object({op:z.literal('import'),markdown:z.string().min(1).max(500000),preview:z.boolean().default(true)}),
]);

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context(),p=payload.parse(await req.json());ensureGrammar();
 if(['start','more','answer'].includes(p.op)){
  if(c.role!=='student')throw new ApiError('老师预览不会记录练习，请使用学生账号练习',403);
  if(p.op==='answer')return Response.json({feedback:answerGrammar(c.id,p.id,p.choice,p.unsure)});
  return Response.json(startGrammar(c.id,p.op==='more'));
 }
 if(c.role!=='teacher')throw new ApiError('此操作仅限老师',403);
 if(p.op==='settings')setGrammarSettings(p.dailyCount,p.topics);
 if(p.op==='save')saveGrammarQuestion(p.question);
 if(p.op==='import'){
  const {questions,errors}=parseGrammarMarkdown(p.markdown);
  if(p.preview||errors.length||!questions.length)return Response.json({questions,errors});
  const ids=addGrammarQuestions(questions.map(q=>({...q,source:`老师导入 ${today()}`,enabled:true})));
  return Response.json({added:ids.length,errors:[]});
 }
 return Response.json(grammarState(c.settings.studentId||'',true));
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'请检查填写内容：'+e.issues.map(i=>i.message).join('；')},{status:400});return failure(e)}}
