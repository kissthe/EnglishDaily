import {aiJson} from './ai-client';
import {resolveAiConfig,type AiScenario} from './ai-config';
import {z} from 'zod';
import type {AiAssessment,Material,RetellConfig,Settings} from './course';
import {notesText,parseMindMap,readNotes,slotLabels} from './retell';

// 模型输出常有小偏差（字段略长、数字写成字符串、状态写成中文）：截断、换算后接受，而不是让整次评测失败。
const str=(max:number,fallback='')=>z.preprocess(v=>v==null?fallback:typeof v==='string'?v:String(v),z.string()).transform(s=>s.trim().slice(0,max));
const list=<T extends z.ZodTypeAny>(item:T,max:number)=>z.preprocess(v=>Array.isArray(v)?v:v==null?[]:[v],z.array(item)).transform(a=>a.slice(0,max));
const num=(min:number,max:number,int=false)=>z.preprocess(v=>typeof v==='string'?Number(v.replace(/[^\d.\-]/g,'')):v,z.number().finite()).transform(n=>{const c=Math.min(max,Math.max(min,n));return int?Math.round(c):Math.round(c*2)/2});
const bool=z.preprocess(v=>typeof v==='string'?/^(true|yes|ok|是|对|√|✓)/i.test(v.trim()):!!v,z.boolean());
const status=z.preprocess(v=>{const t=String(v??'').toLowerCase();return /correct|right|ok|正确|已表达|准确/.test(t)?'correct':/miss|遗漏|缺|没有|未/.test(t)?'missing':'incorrect'},z.enum(['correct','missing','incorrect']));
const dim=num(0,100,true).catch(0);
const assessment=z.object({
 points:list(z.object({label:str(200),status,studentEvidence:str(1000),sourceEvidence:str(1000),advice:str(300)}),100).optional(),
 checks:list(z.object({item:str(60),ok:bool,note:str(300)}),8).optional(),
 exam:z.object({content:num(0,6),language:num(0,4)}).optional(),
 score:num(0,100,true).catch(0),
 summary:str(1200,'已完成评测。').transform(s=>s||'已完成评测。'),
 strengths:list(str(300),6).transform(a=>a.filter(Boolean)),
 improvements:list(str(300),6).transform(a=>a.filter(Boolean)),
 missingPoints:list(str(300),12).transform(a=>a.filter(Boolean)),
 dimensions:z.object({information:dim,organization:dim,language:dim,coherence:dim}).catch({information:0,organization:0,language:0,coherence:0})
});

export const retellCheckItems=['使用给定开头','人称转换','时态一致','完整句表达','连接与顺序'];
// 正式转述使用的 AI 场景；转述训练第一步的笔记核对固定使用 retell1。
export function retellScenario(cfg:RetellConfig):AiScenario{return cfg.mode==='exam'?'retellExam':cfg.mode==='guided'?'retell2':`retell${cfg.stage}`}

const baseRules='输出格式：{"score":0到100整数,"summary":"总体评价","strengths":["优点"],"improvements":["具体建议"],"missingPoints":["遗漏或错误的信息点"],"dimensions":{"information":0到100整数,"organization":0到100整数,"language":0到100整数,"coherence":0到100整数},"points":[{"label":"信息项名称","status":"correct 或 missing 或 incorrect","studentEvidence":"学生原句，没有则为空","sourceEvidence":"材料依据","advice":"修改动作"}]';
const checkRules=`,"checks":[{"item":"检查项","ok":true或false,"note":"一句话说明，引用学生原句"}]}。checks 必须依次包含：${retellCheckItems.join('、')}。`;

function payload(material:Material,cfg:RetellConfig,answer:string,notes:string){
 const v2=cfg.version===2;
 if(cfg.mode&&notes.trim().startsWith('['))notes=notesText(slotLabels(cfg.slots),readNotes(notes));
 return {title:material.title,mode:cfg.mode,stage:v2?undefined:cfg.stage,mindMap:v2?parseMindMap(cfg.slots).map(g=>({branch:g.title,items:g.items.map(i=>({label:i.label,standard:i.answer}))})):undefined,pointLabels:v2?slotLabels(cfg.slots):undefined,slots:v2?undefined:cfg.slots,opening:cfg.opening,guidedKeywords:!v2&&cfg.stage===2?cfg.guidedKeywords:undefined,transcript:material.body,reference:cfg.referenceRetell,answer,notes};
}

export async function assessRetell(settings:Settings,material:Material,answer:string,notes=''):Promise<AiAssessment>{
 const cfg=material.retellConfig;if(!cfg)throw Error('缺少转述训练配置');
 const exam=cfg.mode==='exam',v2=cfg.version===2||!!cfg.mode;
 const rules=baseRules+(exam?`,"exam":{"content":0到6的数（可含 .5）,"language":0到4的数（可含 .5）}`:'')+(v2?checkRules:'}。')+'points 必须逐一对应要点：如果有 pointLabels，points 的条数必须等于 pointLabels 的条数，按相同顺序，label 依次原样取 pointLabels 中的名称（不要用一级提纲 branch，也不要附加答案）；不能编造证据。'+(exam?'score 由服务器按 exam 换算，可填 0。':'')+(!v2&&cfg.stage===1?'阶段一 score 等于 information，不以语言与连贯性扣分；':'')+'不能用笔记内容代替正式转述。';
 const result=assessment.parse(await aiJson(settings,retellScenario(cfg),payload(material,cfg,answer,notes),rules));
 if(!v2&&cfg.stage===1)result.score=result.dimensions.information;
 if(exam){if(!result.exam)throw Error('AI 未返回考试评分');result.score=Math.round((result.exam.content+result.exam.language)*10)}
 result.improvements=result.improvements.slice(0,resolveAiConfig(settings.aiConfig).maxSuggestions);return result;
}

// 转述训练第一步：只核对思维导图笔记。
export async function assessNotes(settings:Settings,material:Material,notes:string):Promise<AiAssessment>{
 const cfg=material.retellConfig;if(!cfg)throw Error('缺少转述训练配置');
 const rules=baseRules+'}。这是听力笔记核对：score 等于 information，不以语言与连贯性扣分；organization、language、coherence 填 0。points 必须逐一对应要点：条数等于 pointLabels 的条数，按相同顺序，label 依次原样取 pointLabels 中的名称；不能编造证据；advice 说明再听时应注意什么。';
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
