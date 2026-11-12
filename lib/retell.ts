import type {Material,Question,RetellConfig,RetellStage} from './course';

export const retellTitles:Record<RetellStage,string>={1:'听懂并记要点',2:'看要点组织表达',3:'听后独立转述'};
export const retellModeTitles={guided:'转述训练 · 听记要点 + 组织表达',exam:'全真模拟 · 听后转述'} as const;
export function retellTaskLabel(cfg:RetellConfig){return cfg.mode?retellModeTitles[cfg.mode]:retellTitles[cfg.stage]}
export type RetellNote={text:string;status:'noted'|'unsure'|'missed'};
export type MindMapGroup={title:string;items:{label:string;answer:string;index:number}[]};

const isHeading=(line:string)=>/^\s*#/.test(line);
// slots 每行“信息名称: 标准信息”；以 # 开头的行是思维导图一级提纲（不计入信息项）。
export function slotLabels(slots:string){return slots.split('\n').filter(line=>!isHeading(line)).map(line=>line.split(/[:：]/)[0].trim()).filter(Boolean)}
export function parseMindMap(slots:string):MindMapGroup[]{
 const groups:MindMapGroup[]=[];let index=0;
 for(const raw of slots.split('\n')){
  const line=raw.trim();if(!line)continue;
  if(isHeading(line)){groups.push({title:line.replace(/^#+\s*/,''),items:[]});continue}
  const label=line.split(/[:：]/)[0].trim();if(!label)continue;
  const answer=line.slice(line.search(/[:：]/)+1).trim();
  if(!groups.length)groups.push({title:'',items:[]});
  groups[groups.length-1].items.push({label,answer:line.search(/[:：]/)<0?'':answer,index:index++});
 }
 return groups;
}
// 学生在提交前看到的导图：保留提纲和信息名称，去掉标准信息。
export function publicSlots(slots:string){return slots.split('\n').map(line=>isHeading(line)?line.trim():line.split(/[:：]/)[0].trim()).filter(Boolean).join('\n')}
export function answerText(answer:string){return answer.split('|')[0].trim()}
export function readNotes(raw?:string):RetellNote[]{try{const value=JSON.parse(raw||'[]');return Array.isArray(value)?value.map(v=>({text:typeof v?.text==='string'?v.text:'',status:v?.status==='unsure'?'unsure':v?.status==='missed'?'missed':'noted'})):[]}catch{return []}}
export function notesText(labels:string[],notes:RetellNote[]){return labels.map((label,i)=>`${label}: ${notes[i]?.text||''}${notes[i]?.status==='missed'?' [没听到]':notes[i]?.status==='unsure'?' [不确定]':''}`).join('\n')}
export function cleanRetellAnswers(m:Material,a:Record<string,string>){
 const result=Object.fromEntries(m.questions.map(q=>[q.id,a[q.id]||'']));
 if(m.retellConfig&&a.retellNotes){const notes=readNotes(a.retellNotes).slice(0,slotLabels(m.retellConfig.slots).length);result.retellNotes=JSON.stringify(notes);if(m.retellConfig.stage===1&&!m.retellConfig.mode)result.retell=notesText(slotLabels(m.retellConfig.slots),notes)}
 if(m.retellConfig?.mode&&a.examLog)result.examLog=a.examLog.slice(0,500);
 return result;
}

export function retellQuestion(c:RetellConfig):Question{return {id:'retell',type:'writing',prompt:c.version===2?`请以给定开头完成英文转述：${c.opening||''}`:c.stage===1?'请按要听出的信息填写关键词。可以使用缩写，不要求完整句。':c.stage===2?`请根据下面的关键词，用完整、简单、连贯的英语完成转述。\n\n${c.guidedKeywords}`:'请先整理听到的关键词，再用完整、简单、连贯的英语完成转述。',options:[],answer:c.referenceRetell,explanation:c.version===2?'AI 将核对思维导图要点、开头句、人称时态与连贯性，并给出修改建议。':c.stage===1?'本阶段只评价信息获取，不要求完整句。':'AI 将核对信息，并从顺序、语言和连贯性给出具体修改建议。',tag:'听力转述',maxScore:100}}
