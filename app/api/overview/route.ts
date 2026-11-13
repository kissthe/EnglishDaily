import {context,db,failure} from '@/lib/server';
import {today,offsetDate,normalizeMaterial} from '@/lib/course';
import {checkinStreak} from '@/lib/checkin';
import type {StudentOverview} from '@/lib/overview';
export const dynamic='force-dynamic';

// 学生首页的学习数据：作业、成绩、语法、词汇、单词本和背单词打卡，按“北京时间”的日期统计。
const day=(iso:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(iso));
export async function GET(){try{
 const c=await context(),student=c.role==='teacher'?c.settings?.studentId:c.id,now=today(),weekFrom=offsetDate(now,-6),from14=offsetDate(now,-13),from30=offsetDate(now,-29);
 const empty:StudentOverview={today:now,tasks:{week:0,weekDone:0,pending:0,corrections:0,total:0},scores:[],average:null,grammar:{answered:0,correct:0,todayDone:0},vocabulary:{learned:0,todayDone:0},wordbook:{words:0,sentences:0},checkin:{streak:0,todayDone:false,monthDays:0,total:0},activity:[]};
 if(!student)return Response.json(empty,{headers:{'Cache-Control':'no-store'}});
 const all=async(sql:string,...args:unknown[])=>(await db().prepare(sql).bind(...args).all()).results as any[];

 const tasks=(await all('SELECT id,date,material FROM tasks WHERE date<=?',now)).map(t=>({...t,material:normalizeMaterial(JSON.parse(t.material))}));
 const subs=await all('SELECT task,state,score,total,submitted,correction_status FROM submissions WHERE student=?',student);
 const subOf=new Map(subs.map(s=>[s.task,s]));
 const done=(id:string)=>{const s=subOf.get(id);return !!s&&s.state!=='draft'};
 const week=tasks.filter(t=>t.date>=weekFrom);
 // 成绩：已批改且有总分的作业，按百分制换算；只记录完成的材料不计入。
 const scores=tasks.filter(t=>{const s=subOf.get(t.id);return s&&s.state==='reviewed'&&s.total>0&&!t.material.completionOnly}).map(t=>{const s=subOf.get(t.id);return {title:t.material.title,kind:t.material.retellConfig?'听后转述':t.material.kind,percent:Math.round(s.score/s.total*100),day:s.submitted?day(s.submitted):t.date}}).sort((a,b)=>a.day.localeCompare(b.day)).slice(-10);

 const grammar=await all('SELECT day,correct FROM grammar_attempts WHERE student=? AND day>=? AND result IS NOT NULL',student,from30);
 const vocab=await all('SELECT day FROM vocabulary_attempts WHERE student=? AND day>=? AND result IS NOT NULL',student,from30);
 const learned=(await all('SELECT count(*) AS n FROM vocabulary_progress WHERE student=?',student))[0]?.n||0;
 const book=await all('SELECT kind,count(*) AS n FROM wordbook WHERE student=? GROUP BY kind',student);
 const checks=await all('SELECT day FROM checkins WHERE student=? ORDER BY day DESC',student);
 const checkDays=checks.map(r=>r.day as string);

 const activity=Array.from({length:14},(_,i)=>{const d=offsetDate(from14,i);return {day:d,task:subs.some(s=>s.state!=='draft'&&s.submitted&&day(s.submitted)===d),grammar:grammar.some(g=>g.day===d),vocabulary:vocab.some(v=>v.day===d),checkin:checkDays.includes(d)}});
 const result:StudentOverview={today:now,
  tasks:{week:week.length,weekDone:week.filter(t=>done(t.id)).length,pending:tasks.filter(t=>!done(t.id)).length,corrections:subs.filter(s=>s.correction_status==='required').length,total:tasks.filter(t=>done(t.id)).length},
  scores,average:scores.length?Math.round(scores.reduce((n,s)=>n+s.percent,0)/scores.length):null,
  grammar:{answered:grammar.length,correct:grammar.filter(g=>g.correct).length,todayDone:grammar.filter(g=>g.day===now).length},
  vocabulary:{learned,todayDone:vocab.filter(v=>v.day===now).length},
  wordbook:{words:book.find(b=>b.kind==='word')?.n||0,sentences:book.find(b=>b.kind==='sentence')?.n||0},
  checkin:{streak:checkinStreak(checkDays,now),todayDone:checkDays.includes(now),monthDays:checkDays.filter(d=>d.slice(0,7)===now.slice(0,7)).length,total:checkDays.length},
  activity};
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
