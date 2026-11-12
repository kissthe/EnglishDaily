import {aiJson} from './ai-client';
import {resolveAiConfig,type AiScenario} from './ai-config';
import {z} from 'zod';
import type {AiAssessment,Material,RetellConfig,Settings} from './course';
import {notesText,parseMindMap,readNotes,slotLabels} from './retell';

const assessment=z.object({
 points:z.array(z.object({label:z.string().max(200),status:z.enum(['correct','missing','incorrect']),studentEvidence:z.string().max(1000),sourceEvidence:z.string().max(1000),advice:z.string().max(300)})).max(100).optional(),
 checks:z.array(z.object({item:z.string().max(60),ok:z.boolean(),note:z.string().max(300)})).max(8).optional(),
 exam:z.object({content:z.number().min(0).max(6),language:z.number().min(0).max(4)}).optional(),
 score:z.number().int().min(0).max(100),
 summary:z.string().min(1).max(1200),
 strengths:z.array(z.string().min(1).max(300)).max(6),
 improvements:z.array(z.string().min(1).max(300)).max(6),
 missingPoints:z.array(z.string().min(1).max(300)).max(12),
 dimensions:z.object({information:z.number().int().min(0).max(100),organization:z.number().int().min(0).max(100),language:z.number().int().min(0).max(100),coherence:z.number().int().min(0).max(100)})
});

export const retellCheckItems=['使用给定开头','人称转换','时态一致','完整句表达','连接与顺序'];
// 正式转述使用的 AI 场景；转述训练第一步的笔记核对固定使用 retell1。
export function retellScenario(cfg:RetellConfig):AiScenario{return cfg.mode==='exam'?'retellExam':cfg.mode==='guided'?'retell2':`retell${cfg.stage}`}

const baseRules='输出格式：{"score":0到100整数,"summary":"总体评价","strengths":["优点"],"improvements":["具体建议"],"missingPoints":["遗漏或错误的信息点"],"dimensions":{"information":0到100整数,"organization":0到100整数,"language":0到100整数,"coherence":0到100整数},"points":[{"label":"信息项名称","status":"correct 或 missing 或 incorrect","studentEvidence":"学生原句，没有则为空","sourceEvidence":"材料依据","advice":"修改动作"}]';
const checkRules=`,"checks":[{"item":"检查项","ok":true或false,"note":"一句话说明，引用学生原句"}]}。checks 必须依次包含：${retellCheckItems.join('、')}。`;

function payload(material:Material,cfg:RetellConfig,answer:string,notes:string){
 const v2=cfg.version===2;
 if(cfg.mode&&notes.trim().startsWith('['))notes=notesText(slotLabels(cfg.slots),readNotes(notes));
 return {title:material.title,mode:cfg.mode,stage:v2?undefined:cfg.stage,mindMap:v2?parseMindMap(cfg.slots).map(g=>({branch:g.title,points:g.items.map(i=>`${i.label}: ${i.answer}`)})):undefined,slots:v2?undefined:cfg.slots,opening:cfg.opening,guidedKeywords:!v2&&cfg.stage===2?cfg.guidedKeywords:undefined,transcript:material.body,reference:cfg.referenceRetell,answer,notes};
}

export async function assessRetell(settings:Settings,material:Material,answer:string,notes=''):Promise<AiAssessment>{
 const cfg=material.retellConfig;if(!cfg)throw Error('缺少转述训练配置');
 const exam=cfg.mode==='exam',v2=cfg.version===2||!!cfg.mode;
 const rules=baseRules+(exam?`,"exam":{"content":0到6的数（可含 .5）,"language":0到4的数（可含 .5）}`:'')+(v2?checkRules:'}。')+'points 必须逐一对应信息项，不能编造证据。'+(exam?'score 由服务器按 exam 换算，可填 0。':'')+(!v2&&cfg.stage===1?'阶段一 score 等于 information，不以语言与连贯性扣分；':'')+'不能用笔记内容代替正式转述。';
 const result=assessment.parse(await aiJson(settings,retellScenario(cfg),payload(material,cfg,answer,notes),rules));
 if(!v2&&cfg.stage===1)result.score=result.dimensions.information;
 if(exam){if(!result.exam)throw Error('AI 未返回考试评分');result.score=Math.round((result.exam.content+result.exam.language)*10)}
 result.improvements=result.improvements.slice(0,resolveAiConfig(settings.aiConfig).maxSuggestions);return result;
}

// 转述训练第一步：只核对思维导图笔记。
export async function assessNotes(settings:Settings,material:Material,notes:string):Promise<AiAssessment>{
 const cfg=material.retellConfig;if(!cfg)throw Error('缺少转述训练配置');
 const rules=baseRules+'}。这是听力笔记核对：score 等于 information，不以语言与连贯性扣分；organization、language、coherence 填 0。points 必须逐一对应信息项，不能编造证据；advice 说明再听时应注意什么。';
 const result=assessment.parse(await aiJson(settings,'retell1',{...payload(material,cfg,'',notes),reference:undefined},rules));
 result.score=result.dimensions.information;result.checks=undefined;result.exam=undefined;
 result.improvements=result.improvements.slice(0,resolveAiConfig(settings.aiConfig).maxSuggestions);return result;
}

export function examScore(a:AiAssessment){return a.exam?Math.round((a.exam.content+a.exam.language)*10)/10:undefined}

export function assessmentFeedback(a:AiAssessment,stage=3){
 const total=examScore(a);
 const parts=[total!==undefined?`全真模拟：${total} / 10（内容 ${a.exam!.content}/6 · 语言 ${a.exam!.language}/4）`:`AI评测：${a.score}/100\n信息 ${a.dimensions.information}${stage===1?'':` · 顺序 ${a.dimensions.organization} · 语言 ${a.dimensions.language} · 连贯 ${a.dimensions.coherence}`}`,a.summary];
 if(a.checks?.some(c=>!c.ok))parts.push('需要注意：\n'+a.checks.filter(c=>!c.ok).map(c=>`• ${c.item}：${c.note}`).join('\n'));
 if(a.strengths.length)parts.push('做得好的地方：\n'+a.strengths.map(x=>'• '+x).join('\n'));
 if(a.missingPoints.length)parts.push('遗漏或需修正：\n'+a.missingPoints.map(x=>'• '+x).join('\n'));
 if(a.improvements.length)parts.push('下一步建议：\n'+a.improvements.map(x=>'• '+x).join('\n'));
 return parts.join('\n\n');
}
