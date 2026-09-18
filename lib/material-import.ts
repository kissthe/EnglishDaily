import {z} from 'zod';
import type {Question} from './course';
export const questionSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),type:z.enum(['choice','fill','writing']),prompt:z.string().min(1).max(2000),options:z.array(z.string().min(1).max(500)).max(8).default([]),answer:z.string().max(2000).default(''),explanation:z.string().max(3000).default(''),tag:z.string().min(1).max(80).default('综合运用'),strict:z.boolean().optional(),caseSensitive:z.boolean().optional(),punctuationSensitive:z.boolean().optional(),audioStart:z.number().min(0).max(86400).optional(),audioEnd:z.number().positive().max(86400).optional(),maxScore:z.number().int().min(1).max(100).optional()});
function decode(raw:string,tag:string){if(raw.length>200000)throw Error('导入内容过长');let text=raw.trim().replace(/^```(?:json|xml)?\s*/,'').replace(/\s*```$/,'');const match=text.match(new RegExp('^<'+tag+'>\\s*([\\s\\S]*?)\\s*</'+tag+'>$'));if(match)text=match[1];try{return JSON.parse(text)}catch{throw Error(`请粘贴 JSON 数组，或用 <${tag}> 包住 JSON 数组。检查引号、逗号与括号。`)}}
export function parseQuestions(raw:string):Question[]{const data=decode(raw,'questions');const qs=z.array(questionSchema).min(1).max(30).parse(Array.isArray(data)?data:data.questions);if(new Set(qs.map(q=>q.id)).size!==qs.length)throw Error('题目 id 重复，请使用 q1、q2 等唯一编号');for(const q of qs){if(q.type==='choice'){if(q.options.length<2||new Set(q.options).size!==q.options.length)throw Error(`${q.id}：选择题需至少两个不重复选项`);if(/^[A-H]$/.test(q.answer)&&!q.options.includes(q.answer))q.answer=q.options[q.answer.charCodeAt(0)-65]||q.answer;if(q.answer&&!q.options.includes(q.answer))throw Error(`${q.id}：答案不在选项中`)}}return qs}
export function parseSolutions(raw:string,questions:Question[]):Question[]{const data=decode(raw,'solutions');const rows=z.array(z.object({id:z.string(),answer:z.string().max(2000).optional(),explanation:z.string().max(3000).optional()}).refine(x=>x.answer!==undefined||x.explanation!==undefined)).min(1).max(30).parse(Array.isArray(data)?data:data.solutions);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('答案解析中有重复题号');for(const row of rows)if(!questions.some(q=>q.id===row.id))throw Error(`找不到题号 ${row.id}，没有修改任何题目`);const next=questions.map(q=>({...q,...rows.find(r=>r.id===q.id)}));return parseQuestions(JSON.stringify(next))}
export const questionTemplate=`<questions>
[
  {"id":"q1","type":"choice","prompt":"What is the main idea?","options":["Option A","Option B","Option C","Option D"],"tag":"主旨大意"},
  {"id":"q2","type":"choice","prompt":"Which statement is true?","options":["Option A","Option B","Option C","Option D"],"tag":"细节理解"}
]
</questions>`;
export const solutionTemplate=`<solutions>
[
  {"id":"q1","answer":"A","explanation":"请说明原文依据与干扰项为什么错误。"},
  {"id":"q2","answer":"B","explanation":"请说明定位句与推理过程。"}
]
</solutions>`;
export const aiPrompt=`请根据我提供的英语文章，为刚升初三的学生编写两道单项选择题。难度以文章为准，每题四个不重复选项，只有一个明确正确答案。至少一题考查理解，避免仅凭常识答题、歧义和超纲词汇。不得虚构原文信息。输出以下两个独立区块，区块内部必须是合法 JSON，不要添加注释：\n${questionTemplate}\n${solutionTemplate}\n保留 q1、q2 编号。答案可以用 A/B/C/D，解析用中文指出原文依据、解释错误选项。输出前自行核对，但最终由老师审核。\n文章：\n[在此粘贴文章]`;
export function importError(e:unknown){return e instanceof z.ZodError?e.issues.map(i=>`${i.path.join('.')}：${i.message}`).join('；'):e instanceof Error?e.message:'导入失败'}
