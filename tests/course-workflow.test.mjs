import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('self-hosted initialization, durable SQLite/media, role isolation and dictation',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 const initEnv={...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'};
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:initEnv,stdio:'pipe'});
 assert.throws(()=>execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:initEnv,stdio:'pipe'}));
 globalThis.__headers=new Headers();
 await build({entryPoints:{vocabulary:'app/api/vocabulary/route.ts',vocabularyStore:'lib/vocabulary-store.ts',vocabularyLogic:'lib/vocabulary.ts',ai:'app/api/ai/route.ts',aiConfig:'lib/ai-config.ts',auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',culture:'app/api/culture/route.ts',listen:'app/api/listen/route.ts',audio:'app/api/audio/route.ts',media:'app/api/media/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','culture','listen','audio','media','ai','vocabulary'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,status=200){const r=await routes[route].GET();assert.equal(r.status,status);return r.json()}
 async function post(route,p,status=200,origin='https://school.test'){const r=await routes[route].POST(new Request('http://127.0.0.1:3000/api/'+route,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie')){assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure/);identify(r.headers.get('set-cookie').split(';')[0])}return data}
 await get('course',401);assert.equal((await get('auth')).canBootstrap,false);await post('auth',{op:'setupTeacher',username:'attacker',password:'attacker-password'},403);
 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');assert.equal((await get('course')).role,'teacher');
 const {defaultAiConfig}=await import(pathToFileURL(path.join(dir,'aiConfig.js')));const aiConfig=defaultAiConfig();aiConfig.generalPrompt='统一教学要求TEST';aiConfig.scenarios.retell2.prompt='只按给定关键词组织表达TEST';aiConfig.scenarios.retell2.model='retell-special-model';
 await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiApiKey:'server-secret',aiConfig}});const configured=await get('course');assert.equal(configured.settings.aiConfigured,true);assert.equal(configured.settings.aiApiKey,undefined);assert.equal(configured.settings.aiConfig.scenarios.retell2.model,'retell-special-model');
 await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiConfig:{...aiConfig,temperature:5}}},400);
 const aiFetch=globalThis.fetch;try{globalThis.fetch=async(url,init)=>{const payload=JSON.parse(init.body);assert.match(payload.messages[0].content,/统一教学要求TEST/);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({ok:true})}}]}))};await post('ai',{op:'test',scenario:'retell2'});}finally{globalThis.fetch=aiFetch}
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 async function upload(route,bytes,type){const body=new FormData();body.append('file',new File([bytes],'sample',{type}));const r=await routes[route].POST(new Request('http://127.0.0.1:3000/api/'+route,{method:'POST',headers:{origin:'https://school.test'},body}));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.url}
 const audio=await upload('audio','sample-audio','audio/mpeg');const video=await upload('media','0123456789','video/mp4');
 const ranged=await routes.media.GET(new Request('https://school.test'+video,{headers:{range:'bytes=2-5'}}));assert.equal(ranged.status,206);assert.equal(await ranged.text(),'2345');assert.equal(ranged.headers.get('content-range'),'bytes 2-5/10');
 const material={id:'dictation',title:'Listen',subtitle:'Key sentences',kind:'听力',level:'A2',minutes:8,body:'He has a blue bag.',source:'老师自编',sourceUrl:'',rights:'原创',audio,playLimit:1,reviewed:true,questions:[{id:'q1',type:'fill',prompt:'请听写第 1 句。',options:[],answer:'He has a blue bag.',explanation:'注意冠词。',tag:'听写',strict:true}]};
 const knowledge={id:'knowledge-html',title:'Explore space',kind:'知识拓展',body:'<article><h1>The Moon</h1></article>',contentFormat:'html',completionOnly:true,reviewed:true,cultureConfig:{category:'城市与地理',tagline:'Explore the Moon in English',explore:'Build some background knowledge.',fastFacts:'The Moon goes around Earth.',vocabulary:'orbit | 轨道',cultureNotes:'Why the Moon?\nIt has inspired stories around the world.',checkQuestions:[{id:'c1',prompt:'What goes around Earth?',options:['The Moon','The Sun'],answer:'The Moon'},{id:'c2',prompt:'Is the Moon a cultural symbol?',options:['Yes','No'],answer:'Yes'},{id:'c3',prompt:'What do we use to explore it?',options:['Science','Cooking'],answer:'Science'}],expressPrompt:'What did you learn about the Moon?'}};
 const grammar={id:'grammar-sheet',title:'Past tense review',kind:'语法',body:'1. I ___ home.\n答案：went',completionOnly:true,reviewed:true};
 const retell={id:'retell-guided',title:'Concert retelling',kind:'听力',body:'The concert is on July 5th and costs thirty pounds.',audio:'',playLimit:0,reviewed:true,retellConfig:{stage:2,slots:'Time: July 5th\nPrice: thirty pounds',guidedKeywords:'July 5 / £30',referenceRetell:'The concert is on July 5th. The ticket costs thirty pounds.',responseMode:'text'},questions:[{id:'retell',type:'writing',prompt:'Retell with the keywords.',options:[],answer:'The concert is on July 5th. The ticket costs thirty pounds.',explanation:'AI assessment',tag:'听力转述',maxScore:100}]};
 const writing={...retell,id:'writing-assist',kind:'写作',retellConfig:undefined,body:'',questions:[{id:'writing',type:'writing',prompt:'Describe a school trip.',options:[],answer:'',explanation:'',tag:'写作',maxScore:15}]};
 await post('course',{op:'material',material:writing});
 const notesMaterial={...retell,id:'retell-notes',audio,playLimit:1,retellConfig:{...retell.retellConfig,stage:1,practiceMode:'learning'}};
 const independentMaterial={...retell,id:'retell-independent',audio,playLimit:1,retellConfig:{...retell.retellConfig,stage:3,practiceMode:'simulation',revisionPolicy:'teacher'}};
 await post('course',{op:'material',material:notesMaterial});await post('course',{op:'material',material:independentMaterial});
 await post('course',{op:'material',material:knowledge});await post('course',{op:'material',material:grammar});
 await post('course',{op:'material',material:retell});await post('course',{op:'material',material});await post('course',{op:'assign',ids:['dictation','retell-guided','retell-notes','retell-independent','writing-assist'],dates:['2026-01-01'],note:''});const teacherTasks=(await get('course')).tasks,task=teacherTasks.find(t=>t.material.id==='dictation'),retellTask=teacherTasks.find(t=>t.material.id==='retell-guided');await post('course',{op:'submit',task:task.id,answers:{q1:'test'}},403);
 await post('auth',{op:'login',username:'student',password:'student-long-password'},409);await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});const student=globalThis.__headers.get('cookie');
 await post('course',{op:'material',material},403);await post('auth',{op:'saveStudent',username:'other',password:'other-password',teacherPassword:'student-long-password'},403);const studentState=await get('course'),hidden=studentState.tasks[0].material;assert.equal(hidden.body,'');assert.equal(hidden.questions[0].answer,undefined);assert.deepEqual(studentState.materials.map(m=>m.id),['knowledge-html']);assert.match(studentState.materials[0].body,/The Moon/);assert.equal(studentState.materials[0].cultureConfig.checkQuestions[0].answer,undefined);await post('culture',{material:'knowledge-html',step:'check',answers:{c1:'The Moon',c2:'Yes',c3:'Science'}});const cultureDone=await post('culture',{material:'knowledge-html',step:'express',expression:'I learned that the Moon goes around Earth.'});assert.equal(cultureDone.progress.status,'已完成');assert.equal(cultureDone.progress.score,100);
 assert.equal((await routes.audio.GET(new Request('https://school.test'+audio))).status,403);const play=await post('listen',{task:task.id});const sound=await routes.audio.GET(new Request('https://school.test'+play.url));assert.equal(await sound.text(),'sample-audio');assert.equal((await routes.audio.GET(new Request('https://school.test'+play.url))).status,403);await post('listen',{task:task.id},409);
 await post('course',{op:'submit',task:task.id,answers:{q1:'He has blue bag.'}},403,'https://attacker.test');await post('course',{op:'submit',task:task.id,answers:{q1:'He has blue bag.'}});let data=await get('course');assert.equal(data.submissions[0].score,0);assert.equal(data.tasks.find(t=>t.id===task.id).material.questions[0].answer,material.questions[0].answer);await post('course',{op:'correct',task:task.id,answers:{q1:'He has a blue bag.'}});assert.equal((await get('course')).submissions[0].answers.q1,'He has blue bag.');
 const notesTask=teacherTasks.find(t=>t.material.id==='retell-notes'),independentTask=teacherTasks.find(t=>t.material.id==='retell-independent');
 await post('listen',{task:notesTask.id});await post('listen',{task:notesTask.id});await post('listen',{task:independentTask.id});await post('listen',{task:independentTask.id},409);
 await post('ai',{op:'test',scenario:'retell1'},403);assert.equal(studentState.settings.aiConfig,undefined);
 const writingTask=teacherTasks.find(t=>t.material.id==='writing-assist');await post('course',{op:'submit',task:writingTask.id,answers:{writing:'We visited a museum last Saturday. It was interesting.'}});
 const hiddenRetell=studentState.tasks.find(t=>t.id===retellTask.id).material;
 assert.equal(hiddenRetell.retellConfig.slots,'Time\nPrice');assert.equal(hiddenRetell.retellConfig.referenceRetell,'');assert.equal(hiddenRetell.retellConfig.guidedKeywords,'July 5 / £30');
 const realFetch=globalThis.fetch;
 let aiResult={score:64,summary:'价格信息遗漏。',strengths:['时间准确'],improvements:['补上价格'],missingPoints:['票价'],dimensions:{information:50,organization:80,language:82,coherence:80},points:[{label:'Time',status:'correct',studentEvidence:'July 5th',sourceEvidence:'July 5th',advice:''},{label:'Price',status:'missing',studentEvidence:'',sourceEvidence:'thirty pounds',advice:'补上票价。'}]};
 let failAi=false;
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://ai.test/v1/chat/completions');assert.match(init.headers.Authorization,/server-secret/);const payload=JSON.parse(init.body);assert.match(payload.messages[0].content,/统一教学要求TEST/);if(JSON.parse(payload.messages[1].content).stage===2){assert.equal(payload.model,'retell-special-model');assert.match(payload.messages[0].content,/只按给定关键词组织表达TEST/)}if(failAi)return new Response('{}',{status:503});return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(aiResult)}}]}),{status:200,headers:{'content-type':'application/json'}})};
 try{
  await post('course',{op:'submit',task:notesTask.id,answers:{retellNotes:'[]'}},400);
  await post('course',{op:'draft',task:notesTask.id,answers:{retellNotes:'broken'}},400);
  const noteData=JSON.stringify([{text:'July 5',status:'unsure'},{text:'',status:'missed'}]);
  await post('course',{op:'draft',task:notesTask.id,answers:{retell:'ignored derived text',retellNotes:noteData}});
  let noteSub=(await get('course')).submissions.find(s=>s.task===notesTask.id);assert.equal(noteSub.answers.retellNotes,noteData);assert.match(noteSub.answers.retell,/Time: July 5 \[不确定\]/);
  await post('course',{op:'submit',task:notesTask.id,answers:{retellNotes:noteData}});
  noteSub=(await get('course')).submissions.find(s=>s.task===notesTask.id);assert.equal(noteSub.score,50);assert.doesNotMatch(noteSub.feedback,/顺序 80/);assert.equal(noteSub.workflow,'待订正');
  await post('course',{op:'submit',task:independentTask.id,answers:{retell:'The concert is on July 5th.',retellNotes:noteData}});
  const independentSub=(await get('course')).submissions.find(s=>s.task===independentTask.id);assert.equal(independentSub.answers.retell,'The concert is on July 5th.');assert.equal(independentSub.answers.retellNotes,noteData);assert.equal(independentSub.workflow,'待批改');
  await post('course',{op:'submit',task:retellTask.id,answers:{retell:'The concert is on July 5th.'}});
  let assessed=await get('course'),retellSub=assessed.submissions.find(s=>s.task===retellTask.id);
  assert.equal(retellSub.state,'reviewed');assert.equal(retellSub.score,64);assert.equal(retellSub.workflow,'待订正');assert.equal(retellSub.aiAssessment.points[1].status,'missing');
  aiResult={...aiResult,score:94,summary:'时间和价格准确。',missingPoints:[],points:aiResult.points.map(p=>({...p,status:'correct'}))};
  await post('course',{op:'correct',task:retellTask.id,answers:{retell:'The concert is on July 5th. It costs thirty pounds.'}});
  retellSub=(await get('course')).submissions.find(s=>s.task===retellTask.id);
  assert.equal(retellSub.score,64);assert.equal(retellSub.answers.retell,'The concert is on July 5th.');assert.equal(retellSub.aiAssessment.score,64);assert.equal(retellSub.revisionAssessment.score,94);assert.equal(retellSub.workflow,'已完成');
  await post('course',{op:'retryRetell',task:retellTask.id},409);
  failAi=true;await post('course',{op:'correct',task:retellTask.id,answers:{retell:'The concert is on July 5th and costs thirty pounds.'}});
  retellSub=(await get('course')).submissions.find(s=>s.task===retellTask.id);assert.equal(retellSub.revisionAssessmentState,'failed');assert.equal(retellSub.workflow,'待批改');assert.equal(retellSub.score,64);
  failAi=false;await post('course',{op:'retryRetell',task:retellTask.id});retellSub=(await get('course')).submissions.find(s=>s.task===retellTask.id);assert.equal(retellSub.revisionAssessmentState,'complete');assert.equal(retellSub.score,64);
 }finally{globalThis.fetch=realFetch}

 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const aiRealFetch=globalThis.fetch;try{
  let response={questions:[{id:'q1',type:'choice',prompt:'Where did they go?',options:['A museum','A park'],answer:'A museum',explanation:'原文说 visited a museum。',tag:'细节理解'}]};
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]}));
  const generated=await post('ai',{op:'questions',body:'They visited a museum.',title:'Trip'});assert.equal(generated.questions[0].answer,'A museum');
  const before=(await get('course')).submissions.find(s=>s.task===writingTask.id);response={feedback:'内容清楚，建议补充细节。',grades:{writing:12},requestRevision:true};
  await post('ai',{op:'writing',submission:before.id});const after=(await get('course')).submissions.find(s=>s.id===before.id);assert.equal(after.feedback,before.feedback);assert.deepEqual(after.grades,before.grades);assert.equal(after.state,'submitted');
  response={...response,grades:{writing:99}};await post('ai',{op:'writing',submission:before.id},400);
  const paused={...aiConfig,scenarios:{...aiConfig.scenarios,questions:{...aiConfig.scenarios.questions,enabled:false}}};await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiConfig:paused}});await post('ai',{op:'questions',body:'Test'},502);

  const pausedRetell={...aiConfig,scenarios:{...aiConfig.scenarios,retell2:{...aiConfig.scenarios.retell2,enabled:false}}};
  await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiConfig:pausedRetell}});
  identify(student);await post('course',{op:'correct',task:retellTask.id,answers:{retell:'The concert is on July 5th and costs thirty pounds.'}});
  let pausedSub=(await get('course')).submissions.find(s=>s.task===retellTask.id);assert.equal(pausedSub.revisionAssessmentState,'paused');assert.equal(pausedSub.score,64);
  identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
  await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiConfig}});
  response=aiResult;identify(student);await post('course',{op:'retryRetell',task:retellTask.id});
  pausedSub=(await get('course')).submissions.find(s=>s.task===retellTask.id);assert.equal(pausedSub.revisionAssessmentState,'complete');assert.equal(pausedSub.score,64);
  identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 }finally{globalThis.fetch=aiRealFetch}

 // Sentence vocabulary: all words imported, only reviewed starter sentences enabled.
 const vocabTeacherCookie=globalThis.__headers.get('cookie');const vocabTeacher=await get('vocabulary');assert.equal(vocabTeacher.totalCount,424);assert.equal(vocabTeacher.enabledCount,32);assert.equal(vocabTeacher.words.filter(w=>w.enabled).every(w=>w.sentences.length>=3),true);

 const vocabFetch=globalThis.fetch;try{globalThis.fetch=async(url,init)=>{const p=JSON.parse(init.body);assert.match(p.messages[0].content,/三个不同生活/);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({sentences:vocabTeacher.words.find(w=>w.enabled).sentences})}}]}))};const generated=await post('vocabulary',{op:'generate',word:'physical',meaning:'身体的'});assert.equal(generated.sentences.length,3);assert.equal((await get('vocabulary')).enabledCount,32);}finally{globalThis.fetch=vocabFetch}

 // Completing imported sentences must preserve the user's original text and remain a draft.
 const importedWord=vocabTeacher.words.find(w=>w.enabled),contexts=importedWord.contextSentences;
 assert.equal(vocabTeacher.words.reduce((n,w)=>n+w.contextSentences.length,0),1272);
 let rewriteContext=false;
 try{
  globalThis.fetch=async(url,init)=>{
   const input=JSON.parse(JSON.parse(init.body).messages[1].content);
   assert.deepEqual(input.contextSentences,contexts);
   const sentences=contexts.map((s,i)=>({...importedWord.sentences[i],...s,text:rewriteContext?s.text+' This is changed.':s.text}));
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({sentences})}}]}));
  };
  const prepared=await post('vocabulary',{op:'generate',word:importedWord.word,meaning:importedWord.meaning,contextSentences:contexts});
  assert.deepEqual(prepared.sentences.map(s=>({text:s.text,target:s.target})),contexts);
  assert.equal((await get('vocabulary')).enabledCount,32);
  rewriteContext=true;await post('vocabulary',{op:'generate',word:importedWord.word,meaning:importedWord.meaning,contextSentences:contexts},502);
 }finally{globalThis.fetch=vocabFetch}
 await post('vocabulary',{op:'settings',dailyNew:2});await post('vocabulary',{op:'settings',dailyNew:31},400);
 const activeWord=vocabTeacher.words.find(w=>w.enabled);await post('vocabulary',{op:'save',word:{...activeWord,sentences:[]}},400);
 identify(student);await post('vocabulary',{op:'settings',dailyNew:20},403);await post('vocabulary',{op:'generate',word:'device',meaning:'设备'},403);
 let vocab=await get('vocabulary');assert.equal(vocab.words,undefined);assert.equal(vocab.recent,undefined);
 const session=await post('vocabulary',{op:'start'});assert.equal(session.cards.length,2);assert.equal(session.cards[0].isNew,true);assert.equal(session.cards[0].translation,undefined);assert.equal(session.cards[0].answer,undefined);
 const repeated=await post('vocabulary',{op:'start'});assert.deepEqual(repeated.cards,session.cards);
 const card=session.cards[0],source=vocabTeacher.words.find(w=>w.word===card.word),correctIndex=card.options.indexOf(source.sentences[0].meaning);
 const wrong=await post('vocabulary',{op:'answer',id:card.id,choice:null,unsure:true});assert.equal(wrong.feedback.remembered,false);assert.equal(wrong.feedback.streak,0);
 const duplicate=await post('vocabulary',{op:'answer',id:card.id,choice:correctIndex,unsure:false});assert.deepEqual(duplicate.feedback,wrong.feedback);assert.equal((await get('vocabulary')).done,1);
 await post('vocabulary',{op:'answer',id:session.cards[1].id,choice:4,unsure:false},400);
 const other=session.cards[1],otherSource=vocabTeacher.words.find(w=>w.word===other.word);const guess=await post('vocabulary',{op:'answer',id:other.id,choice:other.options.indexOf(otherSource.sentences[0].meaning),unsure:true});assert.equal(guess.feedback.correct,true);assert.equal(guess.feedback.remembered,false);
 const finished=await post('vocabulary',{op:'start'});assert.equal(finished.cards.length,0);assert.equal(finished.newAvailable,0);assert.equal(finished.done,2);
 const store=await import(pathToFileURL(path.join(dir,'vocabularyStore.js'))),logic=await import(pathToFileURL(path.join(dir,'vocabularyLogic.js')));const studentId=(await get('course')).userId;
 assert.ok(studentId);const nextDay=wrong.feedback.nextDue;store.setVocabularyDaily(0);const nextSession=store.startVocabulary(studentId,nextDay);assert.equal(nextSession.cards.length,2);assert.equal(nextSession.cards.every(c=>!c.isNew),true);
 const nextCard=nextSession.cards.find(c=>c.word===card.word);assert.notEqual(nextCard.sentence,card.sentence);assert.equal(nextCard.sentence,source.sentences[1].text);
 assert.throws(()=>store.answerVocabulary('another-student',nextCard.id,0,false,nextDay),/不存在/);
 assert.throws(()=>store.answerVocabulary(studentId,nextCard.id,0,false,'2099-01-01'),/跨天/);
 const nextFeedback=store.answerVocabulary(studentId,nextCard.id,nextCard.options.indexOf(source.sentences[1].meaning),false,nextDay);assert.equal(nextFeedback.streak,1);
 assert.deepEqual(logic.scheduleReview('2026-12-31',0,true),{streak:1,nextDue:'2027-01-01'});assert.deepEqual(logic.scheduleReview('2026-01-01',3,true),{streak:4,nextDue:'2026-01-15'});assert.deepEqual(logic.scheduleReview('2026-01-01',4,false),{streak:0,nextDue:'2026-01-02'});

 identify(vocabTeacherCookie);const editable=(await get('vocabulary')).words.find(w=>w.id===source.id);await post('vocabulary',{op:'save',word:{...editable,enabled:false,meaning:editable.meaning+'（已核对）'}});store.ensureVocabulary();const retained=(await get('vocabulary')).words.find(w=>w.id===source.id);assert.equal(retained.enabled,false);assert.match(retained.meaning,/已核对/);assert.equal(store.startVocabulary(studentId,nextDay).cards.some(c=>c.word===source.word),false);
 identify(vocabTeacherCookie);await post('vocabulary',{op:'start'},403);await post('vocabulary',{op:'settings',dailyNew:8});
 await post('auth',{op:'saveStudent',username:'student',password:'student-reset-password',teacherPassword:'teacher-long-password'});identify(student);await get('course',401);
 const persisted=execFileSync(process.execPath,['--input-type=module','-e',"import {openDatabase,env} from './lib/runtime.mjs';const d=openDatabase();console.log(JSON.stringify({submissions:d.prepare('SELECT count(*) AS n FROM submissions').get().n,migrations:d.prepare('SELECT count(*) AS n FROM selfhost_migrations').get().n}));"],{env:process.env,encoding:'utf8'});assert.deepEqual(JSON.parse(persisted),{submissions:5,migrations:8});
 const {env}=await import('../lib/runtime.mjs');await assert.rejects(env.BUCKET.get('../etc/passwd'));await assert.rejects(env.DB.batch([env.DB.prepare("INSERT INTO materials VALUES ('rollback','{}','today')"),env.DB.prepare('INVALID SQL')]));assert.equal(await env.DB.prepare("SELECT * FROM materials WHERE id='rollback'").first(),null);
 try{await rm(dir,{recursive:true,force:true})}catch(e){if(e.code!=='EBUSY')throw e}
});
