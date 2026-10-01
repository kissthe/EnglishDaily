import {z} from 'zod';
import {context,db,sameOrigin,ApiError,failure} from '@/lib/server';
import {today,normalizeMaterial} from '@/lib/course';
import {aiJson} from '@/lib/ai-client';
export const dynamic='force-dynamic';
const selection=z.object({task:z.string().min(1).max(100),section:z.string().max(100),start:z.number().int().min(0).max(120000),end:z.number().int().min(1).max(120000),text:z.string().trim().min(1).max(3000)});
export async function POST(req:Request){try{
 sameOrigin(req);const c=await context();
 if(c.role!=='student')throw new ApiError('请在学生已提交的阅读作业中使用翻译',403);
 const p=selection.parse(await req.json());
 const row=await db().prepare('SELECT t.material,s.state FROM tasks t JOIN submissions s ON s.task=t.id AND s.student=? WHERE t.id=? AND t.date<=?').bind(c.id,p.task,today()).first();
 if(!row||row.state==='draft')throw new ApiError('提交阅读作业后才能使用 AI 翻译',403);
 const m=normalizeMaterial(JSON.parse(row.material));
 if(m.kind!=='阅读')throw new ApiError('翻译仅用于阅读作业',400);
 let original:string|undefined;
 if(p.section==='body')original=m.body;
 else for(const q of m.questions){if(p.section==='question:'+q.id)original=q.prompt;for(const [i,option] of q.options.entries())if(p.section===`option:${q.id}:${i}`)original=option}
 if(original===undefined||p.end<=p.start||original.slice(p.start,p.end)!==p.text)throw new ApiError('选区与原文不一致，请重新选择',400);
 const result=z.object({translation:z.string().trim().min(1).max(4000),notes:z.string().max(2000).default('')}).parse(await aiJson(c.settings,'translation',{selectedText:p.text,context:original.slice(Math.max(0,p.start-800),Math.min(original.length,p.end+800))},'返回 {"translation":"选中文字的自然中文翻译","notes":"必要时简要解释语境词义或句子结构，否则为空字符串"}。只翻译 selectedText，context 仅用于消除歧义；不要回答阅读题目或提供选项答案。'));
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'选区或翻译结果格式不正确，请重试'},{status:400});if(e instanceof ApiError)return failure(e);return Response.json({error:e instanceof Error?e.message:'AI 翻译暂时不可用'},{status:502})}}
