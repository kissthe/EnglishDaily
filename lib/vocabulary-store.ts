import {randomInt,randomUUID} from 'node:crypto';
import {openDatabase} from './runtime.mjs';
import seed from '../data-content/beijing-cd-vocabulary.json';
import {today} from './course';
import {ApiError} from './storage';
import {scheduleReview,wordSchema,type VocabularyWord,type WordCard,type WordFeedback} from './vocabulary';
const database=()=>openDatabase() as any;
function atomic<T>(fn:(d:any)=>T):T{const d=database();d.exec('BEGIN IMMEDIATE');try{const result=fn(d);d.exec('COMMIT');return result}catch(e){d.exec('ROLLBACK');throw e}}
export function ensureVocabulary(){atomic(d=>{
 d.prepare('INSERT OR IGNORE INTO vocabulary_settings(id) VALUES(1)').run();
 if(d.prepare('SELECT seed_version FROM vocabulary_settings WHERE id=1').get().seed_version>=2)return;
 const insert=d.prepare('INSERT OR IGNORE INTO vocabulary_words(id,data,position,enabled,updated) VALUES(?,?,?,?,?)');
 const find=d.prepare('SELECT data FROM vocabulary_words WHERE id=?');
 const update=d.prepare('UPDATE vocabulary_words SET data=?,updated=? WHERE id=?');
 for(const [i,value] of seed.entries()){
  const w=wordSchema.parse(value),existing=find.get(w.id);
  if(!existing)insert.run(w.id,JSON.stringify(w),i,w.enabled?1:0,new Date().toISOString());
  else{const current=JSON.parse(existing.data);if(!current.contextSentences&&w.contextSentences)update.run(JSON.stringify({...current,contextSentences:w.contextSentences}),new Date().toISOString(),w.id)}
 }
 d.prepare('UPDATE vocabulary_settings SET seed_version=2 WHERE id=1').run();
})}
function card(row:any):WordCard{const s=JSON.parse(row.snapshot);return {id:row.id,word:s.word,category:s.category,sentence:s.sentence.text,target:s.sentence.target,options:s.options,isNew:!!row.is_new,round:s.round}}
export function vocabularyState(student:string,teacher:boolean,day=today()){
 const d=database(),dailyNew=d.prepare('SELECT daily_new FROM vocabulary_settings WHERE id=1').get().daily_new;
 const rows=d.prepare('SELECT * FROM vocabulary_words ORDER BY position').all();const words=rows.map((r:any)=>JSON.parse(r.data) as VocabularyWord);
 const attempts=d.prepare('SELECT * FROM vocabulary_attempts WHERE student=? AND day=? ORDER BY created,id').all(student,day);
 const progress=d.prepare('SELECT * FROM vocabulary_progress WHERE student=?').all(student);const enabled=new Set(words.filter((w:VocabularyWord)=>w.enabled).map((w:VocabularyWord)=>w.id));const pending=attempts.filter((a:any)=>!a.result&&enabled.has(a.word));
 const byWord=new Map<string,any>(progress.map((p:any)=>[p.word,p]));
 const wordProgress=words.map((w:VocabularyWord)=>{const p=byWord.get(w.id);return {id:w.id,word:w.word,categories:w.categories,enabled:w.enabled,status:!p?'未学习' as const:p.streak>=4?'长期巩固' as const:'学习中' as const,reviews:p?.reviews||0,streak:p?.streak||0,lapses:p?.lapses||0,lastDay:p?.last_day||null,nextDue:p?.next_due||null}});
 const seen=new Set(progress.map((p:any)=>p.word));const planned=new Set(attempts.map((a:any)=>a.word));const newSlots=Math.max(0,dailyNew-attempts.filter((a:any)=>a.is_new).length);
 return {role:teacher?'teacher' as const:'student' as const,day,dailyNew,cards:teacher?[]:pending.map(card),done:attempts.filter((a:any)=>a.result).length,due:progress.filter((p:any)=>enabled.has(p.word)&&p.next_due<=day&&!planned.has(p.word)).length,newAvailable:Math.min(newSlots,words.filter((w:VocabularyWord)=>w.enabled&&!seen.has(w.id)&&!planned.has(w.id)).length),progress:wordProgress,learned:wordProgress.filter((p:any)=>p.reviews>0).length,stable:wordProgress.filter((p:any)=>p.streak>=4).length,tomorrow:progress.filter((p:any)=>enabled.has(p.word)&&p.next_due<=scheduleReview(day,0,false).nextDue).length,enabledCount:enabled.size,totalCount:words.length,...(teacher?{words,recent:progress.map((p:any)=>({word:words.find((w:VocabularyWord)=>w.id===p.word)?.word||p.word,nextDue:p.next_due,streak:p.streak,lapses:p.lapses})).sort((a:any,b:any)=>a.nextDue.localeCompare(b.nextDue))}:{})};
}
export function startVocabulary(student:string,day=today()){atomic(d=>{
 const daily=d.prepare('SELECT daily_new FROM vocabulary_settings WHERE id=1').get().daily_new;
 const existing=d.prepare('SELECT word,is_new FROM vocabulary_attempts WHERE student=? AND day=?').all(student,day),planned=new Set(existing.map((a:any)=>a.word));
 const progress=d.prepare('SELECT * FROM vocabulary_progress WHERE student=?').all(student);const seen=new Map<string,any>(progress.map((p:any)=>[p.word,p]));
 const words=d.prepare('SELECT * FROM vocabulary_words WHERE enabled=1 ORDER BY position').all().map((r:any)=>JSON.parse(r.data) as VocabularyWord);
 const reviews=words.filter((w:VocabularyWord)=>seen.has(w.id)&&seen.get(w.id).next_due<=day&&!planned.has(w.id)).sort((a:VocabularyWord,b:VocabularyWord)=>seen.get(a.id).next_due.localeCompare(seen.get(b.id).next_due));
 const fresh=words.filter((w:VocabularyWord)=>!seen.has(w.id)&&!planned.has(w.id)).slice(0,Math.max(0,daily-existing.filter((a:any)=>a.is_new).length));
 const insert=d.prepare('INSERT OR IGNORE INTO vocabulary_attempts(id,student,word,day,is_new,snapshot,created) VALUES(?,?,?,?,?,?,?)');
 for(const [i,w] of [...reviews,...fresh].entries()){const p=seen.get(w.id);const sentence=w.sentences[(p?.reviews||0)%w.sentences.length];if(!sentence)continue;const options=[sentence.meaning,...sentence.distractors];for(let j=options.length-1;j>0;j--){const k=randomInt(j+1);[options[j],options[k]]=[options[k],options[j]]}insert.run(randomUUID(),student,w.id,day,p?0:1,JSON.stringify({word:w.word,category:w.categories.join(' · '),meaning:w.meaning,phonetic:w.phonetic,sentence,options,round:(p?.reviews||0)+1}),new Date(Date.now()+i).toISOString())}
 });return vocabularyState(student,false,day)}
export function answerVocabulary(student:string,id:string,choice:number|null,unsure:boolean,day=today()):WordFeedback{return atomic(d=>{
 const row=d.prepare('SELECT * FROM vocabulary_attempts WHERE id=? AND student=?').get(id,student);if(!row)throw new ApiError('练习不存在，请重新加载',404);if(row.result)return JSON.parse(row.result);if(row.day!==day)throw new ApiError('已跨天，请重新开始今天的练习',409);
 if(!d.prepare('SELECT enabled FROM vocabulary_words WHERE id=?').get(row.word)?.enabled)throw new ApiError('老师已暂停此词，请刷新练习',409);
 const snap=JSON.parse(row.snapshot),p=d.prepare('SELECT * FROM vocabulary_progress WHERE student=? AND word=?').get(student,row.word);const correct=choice!==null&&snap.options[choice]===snap.sentence.meaning,remembered=correct&&!unsure;const next=scheduleReview(day,p?.streak||0,remembered);
 const result:WordFeedback={correct,remembered,answer:snap.sentence.meaning,translation:snap.sentence.translation,meaning:snap.meaning,phonetic:snap.phonetic,nextDue:next.nextDue,streak:next.streak,chosen:choice,unsure};
 d.prepare('INSERT INTO vocabulary_progress(student,word,next_due,streak,reviews,lapses,last_day) VALUES(?,?,?,?,?,?,?) ON CONFLICT(student,word) DO UPDATE SET next_due=excluded.next_due,streak=excluded.streak,reviews=excluded.reviews,lapses=excluded.lapses,last_day=excluded.last_day').run(student,row.word,next.nextDue,next.streak,(p?.reviews||0)+1,(p?.lapses||0)+(remembered?0:1),day);
 d.prepare('UPDATE vocabulary_attempts SET result=? WHERE id=?').run(JSON.stringify(result),id);return result;
 })}
export function saveVocabularyWord(w:VocabularyWord){const d=database();if(!d.prepare('SELECT id FROM vocabulary_words WHERE id=?').get(w.id))throw new ApiError('词条不存在',404);d.prepare('UPDATE vocabulary_words SET data=?,enabled=?,updated=? WHERE id=?').run(JSON.stringify(w),w.enabled?1:0,new Date().toISOString(),w.id)}
export function setVocabularyDaily(n:number){database().prepare('UPDATE vocabulary_settings SET daily_new=? WHERE id=1').run(n)}
