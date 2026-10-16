import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

test('grammar daily practice: bank import, daily plan, instant feedback and spaced mistake review',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/grammar-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',grammar:'app/api/grammar/route.ts',store:'lib/grammar-store.ts',bank:'lib/grammar-bank.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const r={};for(const name of ['auth','grammar','store','bank'])r[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const identify=(cookie='')=>{globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.7'})};
 async function post(route,body,status=200){const res=await r[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await res.json();assert.equal(res.status,status,JSON.stringify(d));if(res.headers.has('set-cookie'))identify(res.headers.get('set-cookie').split(';')[0]);return d}
 const get=async(q='')=>{const res=await r.grammar.GET(new Request('https://school.test/api/grammar'+q));assert.equal(res.status,200);return res.json()};
 const {parseGrammarMarkdown,grammarTopics,planGrammar,scheduleGrammar,topicFor}=r.bank;

 // 两份题库：数量、四个选项、答案与解析齐全，类别都能识别。
 const seed=JSON.parse(await readFile('data-content/grammar-bank.json','utf8'));
 for(const [file,n] of [['北京中考核心语法选择题100题.md',100],['北京中考语法选择题60题.md',60]]){const {questions,errors}=parseGrammarMarkdown(await readFile('data-content/grammar/'+file,'utf8'));assert.deepEqual(errors,[]);assert.equal(questions.length,n)}
 assert.equal(seed.length,160);assert.equal(new Set(seed.map(q=>q.id)).size,160);
 assert.ok(seed.every(q=>q.options.length===4&&q.answer>=0&&q.answer<4&&q.explanation&&grammarTopics.includes(q.topic)));
 assert.deepEqual(seed.filter(q=>!q.enabled).map(q=>q.id),['g100-042','g100-095']);
 assert.equal(seed.find(q=>q.id==='g60-054').topic,'定语从句');assert.equal(seed.find(q=>q.id==='g60-051').topic,'宾语从句');
 assert.equal(seed.find(q=>q.id==='g100-077').topic,'被动语态');assert.equal(seed.find(q=>q.id==='g60-029').topic,'动词时态');
 assert.equal(topicFor('','一般现在时的被动语态'),'被动语态');assert.equal(topicFor('其他','无关'),null);
 const bad=parseGrammarMarkdown('## 动词时态\n\n**1. I ____ there.**\nA. go  B. went  C. gone\n* **【答案】** B\n* **【考点】** 一般过去时\n* **【解析】** x\n\n## 杂项\n\n### 第 2 题\n\nHe ____.\n\nA. a\nB. b\nC. c\nD. d\n\n**答案：A**\n\n**解析：** y');
 assert.equal(bad.questions.length,0);assert.match(bad.errors[0],/第 1 题.*识别到 3 个/);assert.match(bad.errors[1],/第 2 题.*无法判断语法类别/);

 // 错题间隔：答错次日，之后 3、7、14 天，连续答对四次后不再安排；首次答对不进入复习。
 let s=scheduleGrammar('2026-10-01',null,false);assert.deepEqual(s,{nextDue:'2026-10-02',streak:0});
 for(const [day,expected] of [['2026-10-02','2026-10-05'],['2026-10-05','2026-10-12'],['2026-10-12','2026-10-26'],['2026-10-26',null]]){s=scheduleGrammar(day,s,true);assert.equal(s.nextDue,expected)}
 assert.deepEqual(scheduleGrammar('2026-10-01',null,true),{nextDue:null,streak:1});

 // 组题：到期错题最多占一半；薄弱类别优先；新题按类别轮流；题库练完后重做较早做对的题。
 const qs=grammarTopics.flatMap(t=>Array.from({length:6},(_,i)=>({id:`${t}-${i}`,topic:t})));
 const due=new Map(Array.from({length:8},(_,i)=>[`动词时态-${i%6}`+(i>5?'x':''),{nextDue:'2026-10-01',streak:0,wrong:1,lastDay:'2026-09-30'}]).filter(([id])=>qs.some(q=>q.id===id)));
 let plan=planGrammar({day:'2026-10-02',count:10,questions:qs,progress:due,history:[],exclude:new Set(),includeReviews:true,random:()=>0});
 assert.equal(plan.length,10);assert.equal(plan.filter(p=>p.kind==='review').length,5);assert.equal(new Set(plan.map(p=>p.id)).size,10);
 assert.equal(new Set(plan.filter(p=>p.kind==='new').map(p=>p.id.split('-')[0])).size,5);
 const weakHistory=[...Array(4)].map(()=>({topic:'被动语态',correct:false})).concat([...Array(4)].map(()=>({topic:'介词',correct:true})));
 plan=planGrammar({day:'2026-10-02',count:9,questions:qs,progress:new Map(),history:weakHistory,exclude:new Set(),includeReviews:true,random:()=>0});
 assert.equal(plan.filter(p=>p.kind==='weak').length,6);assert.ok(plan.filter(p=>p.kind==='weak').every(p=>p.id.startsWith('被动语态')));
 const seen=new Map(qs.slice(0,3).map((q,i)=>[q.id,{nextDue:null,streak:1,wrong:0,lastDay:`2026-09-0${i+1}`}]));
 plan=planGrammar({day:'2026-10-02',count:3,questions:qs.slice(0,4),progress:seen,history:[],exclude:new Set([qs[3].id]),includeReviews:true,random:()=>0});
 assert.deepEqual(plan.map(p=>p.kind),['repeat','repeat','repeat']);

 // 接口：学生开始今日练习，作答前看不到答案，作答后立即得到对错与解析。
 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 let t=await get();assert.equal(t.role,'teacher');assert.equal(t.questions.length,160);assert.equal(t.available,158);assert.equal(t.dailyCount,10);
 await post('grammar',{op:'start'},403);
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 assert.deepEqual(await get('?summary=1'),{day:t.day,dailyCount:10,started:false,total:0,done:0,correct:0,due:0,available:158});
 await post('grammar',{op:'settings',dailyCount:5,topics:['动词时态']},403);
 let st=await post('grammar',{op:'start'});
 assert.equal(st.items.length,10);assert.ok(st.items.every(i=>!i.result&&i.answer===undefined&&i.explanation===undefined&&i.topic===undefined&&i.options.length===4));
 assert.equal((await post('grammar',{op:'start'})).items.length,10);
 await post('grammar',{op:'more'},409);
 const first=st.items[0],q1=seed.find(q=>q.prompt===first.prompt);
 const wrongChoice=(q1.answer+1)%4;
 let fb=(await post('grammar',{op:'answer',id:first.id,choice:wrongChoice})).feedback;
 assert.equal(fb.correct,false);assert.equal(fb.answer,q1.answer);assert.equal(fb.explanation,q1.explanation);assert.equal(fb.topic,q1.topic);assert.ok(fb.nextDue>t.day);
 assert.deepEqual((await post('grammar',{op:'answer',id:first.id,choice:q1.answer})).feedback,fb);
 for(const item of st.items.slice(1)){const q=seed.find(x=>x.prompt===item.prompt);fb=(await post('grammar',{op:'answer',id:item.id,choice:q.answer,unsure:item===st.items[1]})).feedback;assert.equal(fb.correct,true)}
 st=await get();assert.equal(st.done,10);assert.equal(st.correct,9);assert.equal(st.streakDays,1);
 assert.deepEqual(st.mistakes.map(m=>m.prompt).sort(),[first.prompt,st.items[1].prompt].sort());
 const topicStat=st.stats.find(x=>x.topic===q1.topic);assert.ok(topicStat.total>=1&&topicStat.pending>=1);
 const extra=await post('grammar',{op:'more'});assert.equal(extra.items.length,15);assert.ok(extra.items.slice(10).every(i=>i.kind!=='review'));
 await post('grammar',{op:'answer',id:'missing',choice:0},404);

 // 次日：前一天的错题与“不确定”题作为到期错题出现；跨天的旧题不能再作答。
 const {startGrammar,answerGrammar}=r.store;
 const day2=new Date(new Date(t.day+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
 const sid=new DatabaseSync(path.join(dir,'data','english-daily.sqlite')).prepare("SELECT id FROM accounts WHERE role='student'").get().id;
 await assert.rejects(async()=>answerGrammar(sid,extra.items[12].id,0,false,day2),/已跨天/);
 const day2State=startGrammar(sid,false,day2);
 assert.equal(day2State.items.length,10);assert.deepEqual(day2State.items.filter(i=>i.kind==='review').map(i=>i.prompt).sort(),[first.prompt,st.items[1].prompt].sort());
 assert.ok(day2State.items.every(i=>!st.items.some(x=>x.prompt===i.prompt&&i.kind!=='review')));

 // 老师设置：只开放部分类别、修改每日题量；暂停的题不再出现；可修改和导入题目。
 identify(teacher);
 t=await post('grammar',{op:'settings',dailyCount:6,topics:['被动语态']});assert.equal(t.dailyCount,6);assert.deepEqual(t.topics,['被动语态']);
 await post('grammar',{op:'settings',dailyCount:6,topics:[]},400);
 const day3=new Date(new Date(day2+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
 const passive=seed.filter(q=>q.topic==='被动语态');
 const paused={...passive[0],enabled:false};await post('grammar',{op:'save',question:paused});
 const day3State=startGrammar(sid,false,day3);
 assert.ok(day3State.items.filter(i=>i.kind!=='review').every(i=>passive.some(q=>q.prompt===i.prompt)));assert.ok(!day3State.items.some(i=>i.prompt===passive[0].prompt));
 await post('grammar',{op:'save',question:{...passive[1],options:['a','a','b','c']}},400);
 await post('grammar',{op:'save',question:{...passive[1],id:'nope'}},404);
 const md='## 被动语态\n\n### 第 1 题｜基础\n\nThe song ______ by many people.\n\nA. loves\nB. is loved\nC. loved\nD. loving\n\n**答案：B**\n\n**考点：** 一般现在时被动语态\n\n**解析：** 歌曲被人喜爱。';
 const preview=await post('grammar',{op:'import',markdown:md});assert.equal(preview.questions.length,1);assert.equal(preview.questions[0].answer,1);
 assert.equal((await post('grammar',{op:'import',markdown:md,preview:false})).added,1);
 t=await get();assert.equal(t.questions.length,161);assert.match(t.questions.at(-1).id,/^t[a-z0-9]+-1$/);assert.match(t.questions.at(-1).source,/^老师导入/);
 assert.equal((await post('grammar',{op:'import',markdown:'## 动词时态\n\n**1. Broken**',preview:false})).errors.length,1);
 assert.equal(t.recent.length,7);assert.ok(t.recent.at(-1).total===0||t.recent.some(x=>x.total>0));
});
