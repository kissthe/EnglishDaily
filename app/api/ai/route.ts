import {z} from 'zod';
import {context,db,ApiError,failure,sameOrigin} from '@/lib/server';
import {aiJson} from '@/lib/ai-client';
import {aiScenarios,type AiScenario} from '@/lib/ai-config';
import {parseQuestions} from '@/lib/material-import';
import type {Material} from '@/lib/course';
export const dynamic='force-dynamic';

export async function POST(req:Request){try{
 sameOrigin(req);const c=await context();if(c.role!=='teacher')throw new ApiError('此操作仅限老师',403);
 const p=z.object({op:z.enum(['test','questions','writing']),scenario:z.enum(Object.keys(aiScenarios) as [AiScenario,...AiScenario[]]).optional(),body:z.string().max(120000).optional(),title:z.string().max(150).optional(),submission:z.string().max(100).optional()}).parse(await req.json());
 if(p.op==='test'){
  const result=await aiJson(c.settings,p.scenario||'retell1',{task:'接口连通性测试，无学生数据'},'只返回 {"ok":true}');
  if(result.ok!==true)throw new ApiError('连接成功，但模型未按要求输出 JSON');
  return Response.json({ok:true,message:'连接成功，模型可返回 JSON。'});
 }
 if(p.op==='questions'){
  if(!p.body?.trim())throw new ApiError('请先填写阅读正文');
  const result=await aiJson(c.settings,'questions',{title:p.title,article:p.body},'返回 {"questions":[{"id":"q1","type":"choice","prompt":"英文题干","options":["四个英文选项"],"answer":"完整正确选项文本","explanation":"中文解析，包含原文依据","tag":"考查点"}]}，最多30题，题号唯一。');
  const questions=parseQuestions(JSON.stringify(result));if(questions.some(q=>!q.answer.trim()||!q.explanation.trim()))throw new ApiError('AI 题目缺少答案或解析，请重试');
  return Response.json({questions});
 }
 const row=await db().prepare('SELECT s.*,t.material FROM submissions s JOIN tasks t ON t.id=s.task WHERE s.id=?').bind(p.submission||'').first();
 if(!row||row.state==='draft')throw new ApiError('没有可批改的提交');
 const material=JSON.parse(row.material) as Material;if(material.kind!=='写作')throw new ApiError('写作辅助批改仅用于写作作业');
 const questions=material.questions.filter(q=>q.type==='writing');
 const result=z.object({feedback:z.string().min(1).max(5000),grades:z.record(z.number().int().min(0).max(100)),requestRevision:z.boolean()}).parse(await aiJson(c.settings,'writing',{title:material.title,questions,answers:{...JSON.parse(row.answers),...JSON.parse(row.corrections)}},'返回 {"feedback":"给学生的具体中文反馈","grades":{"题号":本题建议整数分},"requestRevision":true或false}。每题分数必须在0与该题maxScore之间（未设置时满分1）。'));
 if(questions.some(q=>result.grades[q.id]===undefined||result.grades[q.id]>(q.maxScore||1)))throw new ApiError('AI 建议分数超出题目范围，请重试');
 return Response.json(result);
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'AI 输入或结果格式不正确，请检查后重试'},{status:400});if(e instanceof ApiError)return failure(e);return Response.json({error:e instanceof Error?e.message:'AI 服务暂时不可用'},{status:502})}}
