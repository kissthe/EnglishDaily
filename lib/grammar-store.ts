import {randomUUID} from 'node:crypto';
import {openDatabase} from './runtime.mjs';
import seed from '../data-content/grammar-bank.json';
import {today,offsetDate} from './course';
import {ApiError} from './storage';
import {grammarMastered,grammarQuestionSchema,grammarTopics,planGrammar,scheduleGrammar,type GrammarFeedback,type GrammarItem,type GrammarMistake,type GrammarProgress,type GrammarQuestion,type GrammarState,type GrammarTopic,type GrammarTopicStat} from './grammar-bank';
const database=()=>openDatabase() as any;
function atomic<T>(fn:(d:any)=>T):T{const d=database();d.exec('BEGIN IMMEDIATE');try{const result=fn(d);d.exec('COMMIT');return result}catch(e){d.exec('ROLLBACK');throw e}}

// 首次使用时导入随应用打包的题库，并默认开放全部语法类别；之后老师的修改保存在数据库中。
export function ensureGrammar(){atomic(d=>{
 d.prepare('INSERT OR IGNORE INTO grammar_settings(id) VALUES(1)').run();
 if(d.prepare('SELECT seed_version FROM grammar_settings WHERE id=1').get().seed_version>=1)return;
 const insert=d.prepare('INSERT OR IGNORE INTO grammar_questions(id,data,topic,position,enabled,updated) VALUES(?,?,?,?,?,?)'),now=new Date().toISOString();
 for(const [i,value] of (seed as unknown[]).entries()){const q=grammarQuestionSchema.parse(value);insert.run(q.id,JSON.stringify(q),q.topic,i,q.enabled?1:0,now)}
 d.prepare('UPDATE grammar_settings SET seed_version=1,topics=? WHERE id=1').run(JSON.stringify(grammarTopics));
})}

const settings=(d:any)=>{const s=d.prepare('SELECT daily_count,topics FROM grammar_settings WHERE id=1').get();return {dailyCount:s.daily_count as number,topics:(JSON.parse(s.topics) as GrammarTopic[]).filter(t=>grammarTopics.includes(t))}};
const questions=(d:any)=>d.prepare('SELECT data FROM grammar_questions ORDER BY position').all().map((r:any)=>JSON.parse(r.data) as GrammarQuestion);
const progressMap=(d:any,student:string)=>new Map<string,GrammarProgress&{attempts:number}>(d.prepare('SELECT * FROM grammar_progress WHERE student=?').all(student).map((p:any)=>[p.question,{nextDue:p.next_due,streak:p.streak,wrong:p.wrong,lastDay:p.last_day,attempts:p.attempts}]));
// 题干与选项在作答前下发；答案、考点与解析只在作答后通过 result 返回。
const snapshot=(q:GrammarQuestion)=>({topic:q.topic,point:q.point,prompt:q.prompt,options:q.options,answer:q.answer,explanation:q.explanation});

export function grammarState(student:string,teacher:boolean,day=today()):GrammarState{
 const d=database(),{dailyCount,topics}=settings(d),bank=questions(d),byId=new Map<string,GrammarQuestion>(bank.map((q:GrammarQuestion)=>[q.id,q])),progress=progressMap(d,student);
 const attempts=d.prepare('SELECT * FROM grammar_attempts WHERE student=? AND day=? ORDER BY position').all(student,day);
 const items:GrammarItem[]=attempts.filter((a:any)=>a.result||byId.get(a.question)?.enabled).map((a:any)=>{const s=JSON.parse(a.snapshot),result=a.result?JSON.parse(a.result) as GrammarFeedback:undefined;return {id:a.id,position:a.position,kind:a.kind,prompt:s.prompt,options:s.options,...(result?{topic:s.topic,result}:{})}});
 const answered=d.prepare('SELECT a.correct,a.day,q.topic FROM grammar_attempts a JOIN grammar_questions q ON q.id=a.question WHERE a.student=? AND a.result IS NOT NULL').all(student);
 const recentFrom=offsetDate(day,-30),planned=new Set(attempts.map((a:any)=>a.question)),usable=bank.filter((q:GrammarQuestion)=>q.enabled&&topics.includes(q.topic));
 const stats:GrammarTopicStat[]=grammarTopics.map(topic=>{const rows=answered.filter((a:any)=>a.topic===topic),recent=rows.filter((a:any)=>a.day>=recentFrom),ids=bank.filter((q:GrammarQuestion)=>q.topic===topic).map((q:GrammarQuestion)=>q.id);return {topic,questions:bank.filter((q:GrammarQuestion)=>q.topic===topic&&q.enabled).length,practiced:ids.filter((id:string)=>progress.has(id)).length,total:rows.length,correct:rows.filter((a:any)=>a.correct).length,recentTotal:recent.length,recentCorrect:recent.filter((a:any)=>a.correct).length,pending:ids.filter((id:string)=>progress.get(id)?.nextDue).length,enabled:topics.includes(topic)}});
 const mistakes:GrammarMistake[]=[...progress].filter(([id,p])=>byId.has(id)&&(p.wrong>0||p.nextDue)).map(([id,p])=>{const q=byId.get(id)!;return {id,topic:q.topic,point:q.point,prompt:q.prompt,options:q.options,answer:q.answer,explanation:q.explanation,wrong:p.wrong,attempts:p.attempts,streak:p.streak,nextDue:p.nextDue,mastered:grammarMastered(p),lastDay:p.lastDay}}).sort((a,b)=>Number(a.mastered)-Number(b.mastered)||(a.nextDue||'9999').localeCompare(b.nextDue||'9999')||b.wrong-a.wrong);
 const days=new Set(d.prepare('SELECT DISTINCT day FROM grammar_attempts WHERE student=? AND result IS NOT NULL').all(student).map((r:any)=>r.day));
 let streakDays=0;for(let x=days.has(day)?day:offsetDate(day,-1);days.has(x);x=offsetDate(x,-1))streakDays++;
 return {role:teacher?'teacher':'student',day,dailyCount,topics,items:teacher?[]:items,done:items.filter(i=>i.result).length,correct:items.filter(i=>i.result?.correct).length,
  due:usable.filter((q:GrammarQuestion)=>{const n=progress.get(q.id)?.nextDue;return n&&n<=day&&!planned.has(q.id)}).length,available:usable.length,stats,mistakes,streakDays,
  ...(teacher?{items:attempts.map((a:any)=>{const s=JSON.parse(a.snapshot);return {id:a.id,position:a.position,kind:a.kind,prompt:s.prompt,options:s.options,topic:s.topic,...(a.result?{result:JSON.parse(a.result)}:{})}}),done:attempts.filter((a:any)=>a.result).length,correct:attempts.filter((a:any)=>a.correct).length,questions:bank,
   recent:Array.from({length:7},(_,i)=>{const x=offsetDate(day,i-6),rows=answered.filter((a:any)=>a.day===x);return {day:x,total:rows.length,correct:rows.filter((a:any)=>a.correct).length}})}:{})};
}

// extra=false：生成当天的计划（已生成则不变）；extra=true：完成后加练 5 题，不含到期错题。
export function startGrammar(student:string,extra=false,day=today(),random?:(n:number)=>number){
 atomic(d=>{
  const existing=d.prepare('SELECT question,position,result FROM grammar_attempts WHERE student=? AND day=?').all(student,day);
  if(!extra&&existing.length)return;
  if(extra&&existing.some((a:any)=>!a.result))throw new ApiError('请先完成今天的题目，再加练',409);
  const {dailyCount,topics}=settings(d),bank=questions(d).filter((q:GrammarQuestion)=>q.enabled&&topics.includes(q.topic)),byId=new Map<string,GrammarQuestion>(bank.map((q:GrammarQuestion)=>[q.id,q]));
  const history=d.prepare('SELECT a.correct,q.topic FROM grammar_attempts a JOIN grammar_questions q ON q.id=a.question WHERE a.student=? AND a.result IS NOT NULL AND a.day>=?').all(student,offsetDate(day,-30)).map((r:any)=>({topic:r.topic,correct:!!r.correct}));
  const plan=planGrammar({day,count:extra?5:dailyCount,questions:bank,progress:progressMap(d,student),history,exclude:new Set(existing.map((a:any)=>a.question)),includeReviews:!extra,random});
  if(!plan.length)throw new ApiError(bank.length?'今天已经没有新的题目可以加练了':'老师还没有开放语法题目',409);
  const insert=d.prepare('INSERT INTO grammar_attempts(id,student,question,day,kind,position,snapshot) VALUES(?,?,?,?,?,?,?)'),base=existing.reduce((m:number,a:any)=>Math.max(m,a.position+1),0);
  plan.forEach((p,i)=>insert.run(randomUUID(),student,p.id,day,p.kind,base+i,JSON.stringify(snapshot(byId.get(p.id)!))));
 });
 return grammarState(student,false,day);
}

export function answerGrammar(student:string,id:string,choice:number|null,unsure:boolean,day=today()):GrammarFeedback{
 return atomic(d=>{
  const row=d.prepare('SELECT * FROM grammar_attempts WHERE id=? AND student=?').get(id,student);
  if(!row)throw new ApiError('题目不存在，请重新加载',404);
  if(row.result)return JSON.parse(row.result);
  if(row.day!==day)throw new ApiError('已跨天，请重新开始今天的练习',409);
  if(!d.prepare('SELECT enabled FROM grammar_questions WHERE id=?').get(row.question)?.enabled)throw new ApiError('老师已暂停这道题，请刷新',409);
  const s=JSON.parse(row.snapshot),p=d.prepare('SELECT * FROM grammar_progress WHERE student=? AND question=?').get(student,row.question);
  const correct=choice===s.answer,next=scheduleGrammar(day,p?{nextDue:p.next_due,streak:p.streak}:null,correct&&!unsure),wrong=(p?.wrong||0)+(correct?0:1);
  const result:GrammarFeedback={correct,unsure,chosen:choice,answer:s.answer,explanation:s.explanation,point:s.point,topic:s.topic,nextDue:next.nextDue,streak:next.streak,mastered:grammarMastered({streak:next.streak,wrong}),wrong};
  d.prepare('INSERT INTO grammar_progress(student,question,next_due,streak,attempts,wrong,last_day) VALUES(?,?,?,?,1,?,?) ON CONFLICT(student,question) DO UPDATE SET next_due=excluded.next_due,streak=excluded.streak,attempts=attempts+1,wrong=excluded.wrong,last_day=excluded.last_day').run(student,row.question,next.nextDue,next.streak,wrong,day);
  d.prepare('UPDATE grammar_attempts SET choice=?,correct=?,unsure=?,result=?,answered=? WHERE id=?').run(choice,correct?1:0,unsure?1:0,JSON.stringify(result),new Date().toISOString(),id);
  return result;
 });
}

export function setGrammarSettings(dailyCount:number,topics:GrammarTopic[]){
 if(!topics.length)throw new ApiError('请至少开放一个语法类别');
 database().prepare('UPDATE grammar_settings SET daily_count=?,topics=? WHERE id=1').run(dailyCount,JSON.stringify(grammarTopics.filter(t=>topics.includes(t))));
}
export function saveGrammarQuestion(q:GrammarQuestion){
 const d=database();
 if(!d.prepare('SELECT id FROM grammar_questions WHERE id=?').get(q.id))throw new ApiError('题目不存在',404);
 d.prepare('UPDATE grammar_questions SET data=?,topic=?,enabled=?,updated=? WHERE id=?').run(JSON.stringify(q),q.topic,q.enabled?1:0,new Date().toISOString(),q.id);
}
// 导入的新题排在题库末尾，编号为 t + 时间戳 + 序号，避免与内置题目冲突。
export function addGrammarQuestions(list:Omit<GrammarQuestion,'id'>[]){
 return atomic(d=>{
  const start=(d.prepare('SELECT MAX(position) AS n FROM grammar_questions').get().n??-1)+1,stamp=Date.now().toString(36),now=new Date().toISOString();
  const insert=d.prepare('INSERT INTO grammar_questions(id,data,topic,position,enabled,updated) VALUES(?,?,?,?,?,?)');
  return list.map((value,i)=>{const q=grammarQuestionSchema.parse({...value,id:`t${stamp}-${i+1}`});insert.run(q.id,JSON.stringify(q),q.topic,start+i,q.enabled?1:0,now);return q.id});
 });
}
