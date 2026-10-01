import {aiJson} from './ai-client';
import {resolveAiConfig} from './ai-config';
import {z} from 'zod';
import type {AiAssessment,Material,Settings} from './course';

const assessment=z.object({
 points:z.array(z.object({label:z.string().max(200),status:z.enum(['correct','missing','incorrect']),studentEvidence:z.string().max(1000),sourceEvidence:z.string().max(1000),advice:z.string().max(300)})).max(100).optional(),
 score:z.number().int().min(0).max(100),
 summary:z.string().min(1).max(1200),
 strengths:z.array(z.string().min(1).max(300)).max(6),
 improvements:z.array(z.string().min(1).max(300)).max(6),
 missingPoints:z.array(z.string().min(1).max(300)).max(12),
 dimensions:z.object({information:z.number().int().min(0).max(100),organization:z.number().int().min(0).max(100),language:z.number().int().min(0).max(100),coherence:z.number().int().min(0).max(100)})
});

export async function assessRetell(settings:Settings,material:Material,answer:string,notes=''):Promise<AiAssessment>{
 const cfg=material.retellConfig;if(!cfg)throw Error('缺少转述训练配置');
 const rules=`输出格式：{"score":0到100整数,"summary":"总体评价","strengths":["优点"],"improvements":["具体建议"],"missingPoints":["遗漏或错误的信息点"],"dimensions":{"information":0到100整数,"organization":0到100整数,"language":0到100整数,"coherence":0到100整数},"points":[{"label":"信息项名称","status":"correct 或 missing 或 incorrect","studentEvidence":"学生原句，没有则为空","sourceEvidence":"材料依据","advice":"修改动作"}]}。points 必须逐一对应信息项，不能编造证据。阶段一 score 等于 information，不以语言与连贯性扣分；其余阶段不能用笔记内容代替正式转述。`;
 const result=assessment.parse(await aiJson(settings,`retell${cfg.stage}`,{title:material.title,stage:cfg.stage,slots:cfg.slots,guidedKeywords:cfg.stage===2?cfg.guidedKeywords:undefined,transcript:material.body,reference:cfg.referenceRetell,answer,notes},rules));
 if(cfg.stage===1)result.score=result.dimensions.information;result.improvements=result.improvements.slice(0,resolveAiConfig(settings.aiConfig).maxSuggestions);return result;
}

export function assessmentFeedback(a:AiAssessment,stage=3){
 const parts=[`AI评测：${a.score}/100\n信息 ${a.dimensions.information}${stage===1?'':` · 顺序 ${a.dimensions.organization} · 语言 ${a.dimensions.language} · 连贯 ${a.dimensions.coherence}`}`,a.summary];
 if(a.strengths.length)parts.push('做得好的地方：\n'+a.strengths.map(x=>'• '+x).join('\n'));
 if(a.missingPoints.length)parts.push('遗漏或需修正：\n'+a.missingPoints.map(x=>'• '+x).join('\n'));
 if(a.improvements.length)parts.push('下一步建议：\n'+a.improvements.map(x=>'• '+x).join('\n'));
 return parts.join('\n\n');
}
