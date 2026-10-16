import {z} from 'zod';

// 语法选择题库：类别、题目结构与 Markdown 导入（兼容“**1. 题干**/【答案】”与“### 第 1 题/答案：”两种格式）。
export const grammarTopics=['代词','名词、冠词与数词','介词','情态动词与祈使句','特殊疑问词','形容词与副词','连词与状语从句','动词时态','被动语态','非谓语动词','宾语从句','定语从句','主谓一致与特殊句式'] as const;
export type GrammarTopic=typeof grammarTopics[number];
export type GrammarLevel='基础'|'提升'|'易错'|'';
export type GrammarQuestion={id:string;topic:GrammarTopic;point:string;level:GrammarLevel;prompt:string;options:string[];answer:number;explanation:string;source:string;enabled:boolean;note?:string};

// 关键词按优先级排列：被动语态先于时态，状语从句先于连词，关系代词先于代词。
const keywords:[GrammarTopic,RegExp][]=[
 ['被动语态',/被动/],
 ['定语从句',/定语从句|关系代词|关系副词/],
 ['宾语从句',/宾语从句/],
 ['非谓语动词',/非谓语|不定式|动名词|分词|stop to do|too\.\.\.to/i],
 ['情态动词与祈使句',/情态|祈使|must 提问/],
 ['特殊疑问词',/疑问词/],
 ['连词与状语从句',/连词|状语从句/],
 ['主谓一致与特殊句式',/主谓一致|就近一致|特殊句式|感叹句|there be/i],
 ['动词时态',/时态|现在时|过去时|将来时|进行时|完成时|be going to/],
 ['形容词与副词',/形容词|副词|比较级|最高级|原级|enough/],
 ['介词',/介词|交通方式/],
 ['名词、冠词与数词',/名词|冠词|数词/],
 ['代词',/代词|限定词/],
];
const matches=(text:string)=>[...new Set(keywords.filter(([,re])=>re.test(text)).map(([t])=>t))];
// 先按所在章节判断；章节同时涵盖多个类别（如“宾语从句与定语从句”）时，再用考点细分。
export function topicFor(section:string,point:string):GrammarTopic|null{
 const bySection=matches(section);
 if(bySection.length===1)return bySection[0];
 const byPoint=matches(point);
 return (bySection.length?byPoint.find(t=>bySection.includes(t)):byPoint[0])||bySection[0]||null;
}

const clean=(s:string)=>s.replace(/\*\*/g,'').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g,'$1$2').replace(/_{3,}/g,'____').replace(/[ \t]+$/gm,'').trim();

export type ParsedGrammar={questions:(Omit<GrammarQuestion,'id'|'source'|'enabled'>&{number:number})[];errors:string[]};
export function parseGrammarMarkdown(text:string):ParsedGrammar{
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),questions:ParsedGrammar['questions']=[],errors:string[]=[];
 let section='',block:{number:number;label:string;level:GrammarLevel;section:string;lines:string[]}|null=null;
 function flush(){
  if(!block)return;const b=block;block=null;
  const body=b.lines.join('\n'),label=b.label;
  const answer=/(?:【答案】|答案[:：])\**\s*([A-D])/.exec(body)?.[1];
  const pointLine=/(?:【考点】|考点[:：])\**\s*(.+)/.exec(body)?.[1]||'';
  const explanation=/(?:【解析】|解析[:：])\**\s*([\s\S]+)$/.exec(body)?.[1]||'';
  const head=body.split(/^\s*(?:\*\s*)?\**(?:【答案】|答案[:：])/m)[0];
  const options:string[]=[],prompt:string[]=[];
  for(const raw of head.split('\n')){
   const line=raw.trim();if(!line)continue;
   if(/^[A-D]\.\s/.test(line)){for(const part of line.split(/\s+(?=[B-D]\.\s)/))options.push(clean(part.replace(/^[A-D]\.\s*/,'')));continue}
   if(options.length)continue;
   prompt.push(clean(line));
  }
  const note=/（注[:：]?([^）]*)）/.exec(pointLine)?.[1]?.trim();
  const point=clean(pointLine.replace(/（注[^）]*）/,'')),topic=topicFor(b.section,point);
  if(!answer||options.length!==4||!prompt.join('').trim()||!explanation.trim()||!topic){errors.push(`${label}：${!topic?'无法判断语法类别，请在二级标题中写明类别（如“## 动词时态”）':!answer?'缺少答案（A–D）':options.length!==4?`需要四个选项，识别到 ${options.length} 个`:!explanation.trim()?'缺少解析':'缺少题干'}`);return}
  questions.push({number:b.number,topic,point,level:b.level,prompt:prompt.join('\n'),options,answer:'ABCD'.indexOf(answer),explanation:clean(explanation.replace(/\n+\s*(?:---|##)[\s\S]*$/,'')),...(note?{note}:{})});
 }
 for(const line of lines){
  const a=/^\*\*(\d+)\.\s*(.*?)\**\s*$/.exec(line),b=/^###\s*第\s*(\d+)\s*题(?:\s*[｜|]\s*(基础|提升|易错))?/.exec(line);
  if(a||b){flush();block={number:Number((a||b)![1]),label:`第 ${(a||b)![1]} 题`,level:(b?.[2]||'') as GrammarLevel,section,lines:a?[a[2]]:[]};continue}
  if(/^##\s/.test(line)&&!/^###/.test(line)){flush();section=line.replace(/^##\s*/,'').replace(/^(模块[一二三四五六七八九十]+[:：]|[一二三四五六七八九十]+、)\s*/,'').replace(/[（(].*?[)）]/g,'').trim();continue}
  if(/^---\s*$/.test(line)){flush();continue}
  block?.lines.push(line);
 }
 flush();
 return {questions,errors};
}

// 与 lib/course 的 offsetDate 相同；这里单独实现，便于导入脚本直接运行本文件。
const offsetDate=(d:string,n:number)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
export const grammarQuestionSchema=z.object({
 id:z.string().regex(/^[a-z0-9-]{1,40}$/),
 topic:z.enum(grammarTopics),
 point:z.string().trim().max(100),
 level:z.enum(['基础','提升','易错','']),
 prompt:z.string().trim().min(1,'请填写题干').max(2000),
 options:z.array(z.string().trim().min(1,'选项不能为空').max(300)).length(4),
 answer:z.number().int().min(0).max(3),
 explanation:z.string().trim().min(1,'请填写解析').max(3000),
 source:z.string().max(100),
 enabled:z.boolean(),
 note:z.string().max(300).optional(),
}).superRefine((q,c)=>{if(new Set(q.options).size!==4)c.addIssue({code:'custom',message:'四个选项不能重复'})});

// 错题间隔：答错或“不确定”次日再练；之后连续答对按 3、7、14 天复习，连续答对两次视为已掌握，四次后不再安排。
export const grammarIntervals=[3,7,14];
export type GrammarProgress={nextDue:string|null;streak:number;wrong:number;lastDay:string};
export function scheduleGrammar(day:string,prev:Pick<GrammarProgress,'nextDue'|'streak'>|null,remembered:boolean){
 if(!remembered)return {nextDue:offsetDate(day,1),streak:0};
 const streak=(prev?.streak||0)+1;
 if(!prev?.nextDue)return {nextDue:null,streak};
 return {nextDue:streak<=grammarIntervals.length?offsetDate(day,grammarIntervals[streak-1]):null,streak};
}
export const grammarMastered=(p:Pick<GrammarProgress,'streak'|'wrong'>)=>p.wrong>0&&p.streak>=2;

export type PlanKind='review'|'weak'|'new'|'repeat';
export type PlanInput={day:string;count:number;questions:{id:string;topic:GrammarTopic}[];progress:Map<string,GrammarProgress>;history:{topic:GrammarTopic;correct:boolean}[];exclude:Set<string>;includeReviews:boolean;random?:(n:number)=>number};
// 每日组题：最多一半到期错题 → 薄弱类别的新题（约占余下三分之二）→ 按“最久没练”轮流覆盖其余类别 → 题库练完后重做较早做对的题。
export function planGrammar(p:PlanInput):{id:string;kind:PlanKind}[]{
 const rnd=p.random||((n:number)=>Math.floor(Math.random()*n)),taken=new Set(p.exclude),picked:{id:string;kind:PlanKind}[]=[];
 const take=(id:string,kind:PlanKind)=>{if(picked.length<p.count&&!taken.has(id)){taken.add(id);picked.push({id,kind})}};
 const shuffle=<T,>(list:T[])=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 const avail=p.questions.filter(q=>!p.exclude.has(q.id));
 if(p.includeReviews)avail.filter(q=>{const d=p.progress.get(q.id)?.nextDue;return d&&d<=p.day}).sort((a,b)=>p.progress.get(a.id)!.nextDue!.localeCompare(p.progress.get(b.id)!.nextDue!)||p.progress.get(b.id)!.wrong-p.progress.get(a.id)!.wrong).slice(0,Math.ceil(p.count/2)).forEach(q=>take(q.id,'review'));
 const fresh=new Map<GrammarTopic,string[]>();
 for(const q of shuffle(avail))if(!p.progress.has(q.id))fresh.set(q.topic,[...(fresh.get(q.topic)||[]),q.id]);
 const next=(t:GrammarTopic)=>{const list=fresh.get(t)||[];while(list.length){const id=list.shift()!;if(!taken.has(id))return id}return null};
 const roundRobin=(topics:GrammarTopic[],kind:PlanKind,limit:number)=>{let added=0,progress=true;while(added<limit&&picked.length<p.count&&progress){progress=false;for(const t of topics){if(added>=limit||picked.length>=p.count)break;const id=next(t);if(id){take(id,kind);added++;progress=true}}}};
 const stats=new Map<GrammarTopic,{n:number;c:number}>();
 for(const h of p.history){const s=stats.get(h.topic)||{n:0,c:0};s.n++;if(h.correct)s.c++;stats.set(h.topic,s)}
 const weak=[...stats].filter(([t,s])=>s.n>=3&&s.c/s.n<0.8&&fresh.get(t)?.length).sort((a,b)=>a[1].c/a[1].n-b[1].c/b[1].n).map(([t])=>t);
 roundRobin(weak,'weak',weak.length?Math.round((p.count-picked.length)*2/3):0);
 const last=new Map<GrammarTopic,string>();
 for(const q of avail){const d=p.progress.get(q.id)?.lastDay;if(d&&d>(last.get(q.topic)||''))last.set(q.topic,d)}
 roundRobin([...fresh.keys()].sort((a,b)=>(last.get(a)||'').localeCompare(last.get(b)||'')),'new',p.count);
 const old=avail.filter(q=>p.progress.has(q.id)&&!taken.has(q.id)&&!p.progress.get(q.id)!.nextDue).sort((a,b)=>p.progress.get(a.id)!.lastDay.localeCompare(p.progress.get(b.id)!.lastDay));
 const cutoff=offsetDate(p.day,-14);
 for(const q of old)if(p.progress.get(q.id)!.lastDay<=cutoff)take(q.id,'repeat');
 for(const q of old)take(q.id,'repeat');
 if(p.includeReviews)for(const q of avail){const d=p.progress.get(q.id)?.nextDue;if(d&&d<=p.day)take(q.id,'review')}
 return shuffle(picked);
}

export type GrammarFeedback={correct:boolean;unsure:boolean;chosen:number|null;answer:number;explanation:string;point:string;topic:GrammarTopic;nextDue:string|null;streak:number;mastered:boolean;wrong:number};
export type GrammarItem={id:string;position:number;kind:PlanKind;prompt:string;options:string[];topic?:GrammarTopic;result?:GrammarFeedback};
export type GrammarTopicStat={topic:GrammarTopic;questions:number;practiced:number;total:number;correct:number;recentTotal:number;recentCorrect:number;pending:number;enabled:boolean};
export type GrammarMistake={id:string;topic:GrammarTopic;point:string;prompt:string;options:string[];answer:number;explanation:string;wrong:number;attempts:number;streak:number;nextDue:string|null;mastered:boolean;lastDay:string};
export type GrammarState={role:'teacher'|'student';day:string;dailyCount:number;topics:GrammarTopic[];items:GrammarItem[];done:number;correct:number;due:number;available:number;stats:GrammarTopicStat[];mistakes:GrammarMistake[];streakDays:number;questions?:GrammarQuestion[];recent?:{day:string;total:number;correct:number}[]};
