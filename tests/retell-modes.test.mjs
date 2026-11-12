import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('Beijing retell bank import, guided training and timed exam simulation',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',listen:'app/api/listen/route.ts',audio:'app/api/audio/route.ts',aiConfig:'lib/ai-config.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','listen','audio'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,status=200){const r=await routes[route].GET();assert.equal(r.status,status);return r.json()}
 async function post(route,p,status=200){const r=await routes[route].POST(new Request('http://127.0.0.1:3000/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return data}

 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 // 题库在老师首次打开时导入一次，包含合成音频。
 let state=await get('course');
 const bank=state.materials.filter(m=>m.id.startsWith('retell-bj-'));
 assert.equal(bank.length,5);assert.ok(bank.every(m=>!m.reviewed&&m.retellConfig.version===2&&m.retellConfig.opening&&m.audio));
 const zoo=bank.find(m=>m.id==='retell-bj-city-zoo');
 const teacherAudio=await routes.audio.GET(new Request('https://school.test'+zoo.audio));assert.equal(teacherAudio.status,200);
 assert.deepEqual(Buffer.from(await teacherAudio.arrayBuffer()),await readFile('data-content/retell-audio/'+new URL(zoo.audio,'https://x').searchParams.get('key')+'.mp3'));
 await post('course',{op:'material',material:{...zoo,title:'Zoo (edited)'}});
 assert.equal((await get('course')).materials.find(m=>m.id===zoo.id).title,'Zoo (edited)','second load must not overwrite teacher edits');

 const {defaultAiConfig}=await import(pathToFileURL(path.join(dir,'aiConfig.js')));
 await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'mock-model',aiApiKey:'server-secret',aiConfig:defaultAiConfig()}});
 await post('course',{op:'material',material:{...zoo,reviewed:true,retellConfig:{...zoo.retellConfig,opening:''}}},400);
 await post('course',{op:'material',material:{...zoo,reviewed:true}});
 await post('course',{op:'assign',ids:[zoo.id],dates:['2026-01-01'],note:'',retellMode:'guided'});
 await post('course',{op:'assign',ids:[zoo.id],dates:['2026-01-02'],note:'',retellMode:'exam'});
 state=await get('course');
 const guidedTask=state.tasks.find(t=>t.material.retellConfig?.mode==='guided'),examTask=state.tasks.find(t=>t.material.retellConfig?.mode==='exam');
 assert.equal(guidedTask.material.playLimit,0);assert.equal(guidedTask.material.retellConfig.practiceMode,'learning');
 assert.equal(examTask.material.playLimit,3);assert.equal(examTask.material.retellConfig.practiceMode,'simulation');assert.equal(examTask.material.allowSeek,false);

 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});
 state=await get('course');
 let hidden=state.tasks.find(t=>t.id===guidedTask.id).material.retellConfig;
 assert.match(hidden.slots,/^# Time and transport\nWhen\nMeeting place/);assert.doesNotMatch(hidden.slots,/school bus/);assert.equal(hidden.referenceRetell,'');assert.equal(hidden.opening,zoo.retellConfig.opening);
 const labels=hidden.slots.split('\n').filter(l=>!l.startsWith('#'));assert.equal(labels.length,8);

 const calls=[];const realFetch=globalThis.fetch;
 const base={summary:'整体不错。',strengths:['开头正确'],improvements:['补上规则二','注意人称'],missingPoints:[],dimensions:{information:80,organization:70,language:75,coherence:70}};
 globalThis.fetch=async(url,init)=>{const payload=JSON.parse(init.body),data=JSON.parse(payload.messages[1].content);calls.push({system:payload.messages[0].content,data});
  const content=data.mode==='exam'?{...base,score:0,exam:{content:4.5,language:3},checks:[{item:'人称转换',ok:false,note:'you 没有改成 we'}]}:data.answer?{...base,score:78,checks:[{item:'使用给定开头',ok:true,note:''}]}:{...base,score:0,points:labels.map((l,i)=>({label:l,status:i===6?'missing':'correct',studentEvidence:'',sourceEvidence:'',advice:i===6?'注意 Second 之后的内容':''}))};
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}),{status:200})};
 try{
  // 转述训练：学生不能伪造“已核对”来提前看答案，也不能跳过第一步直接提交。
  await post('course',{op:'draft',task:guidedTask.id,answers:{retell:'x',notesChecked:'1'}});
  assert.doesNotMatch((await get('course')).tasks.find(t=>t.id===guidedTask.id).material.retellConfig.slots,/school bus/);
  await post('course',{op:'submit',task:guidedTask.id,answers:{retell:'I have got some information.'}},400);
  const notes=labels.map((_,i)=>i===6?{text:'',status:'missed'}:{text:'note '+i,status:'noted'});
  await post('course',{op:'checkNotes',task:guidedTask.id,notes:JSON.stringify(notes.slice(1))},400);
  await post('course',{op:'checkNotes',task:guidedTask.id,notes:JSON.stringify(notes)});
  await post('course',{op:'checkNotes',task:guidedTask.id,notes:JSON.stringify(notes)},409);
  assert.match(calls.at(-1).system,/只评价学生是否准确捕捉信息/);assert.match(calls.at(-1).data.notes,/Rule 2: \s*\[没听到\]/);
  state=await get('course');
  let sub=state.submissions.find(s=>s.task===guidedTask.id);
  assert.equal(sub.state,'draft');assert.equal(sub.notesAssessmentState,'complete');assert.equal(sub.notesAssessment.points[6].status,'missing');
  assert.match(state.tasks.find(t=>t.id===guidedTask.id).material.retellConfig.slots,/by school bus/,'standard points are revealed after the check');
  // 已核对的笔记被锁定。
  await post('course',{op:'draft',task:guidedTask.id,answers:{retell:'draft',retellNotes:JSON.stringify(labels.map(()=>({text:'changed',status:'noted'})))}});
  assert.equal(readNote((await get('course')).submissions.find(s=>s.task===guidedTask.id)),'note 0');
  await post('course',{op:'submit',task:guidedTask.id,answers:{retell:zoo.retellConfig.opening+' We will visit the zoo next Monday.'}});
  assert.match(calls.at(-1).system,/学生根据给定要点完成转述/);assert.equal(calls.at(-1).data.opening,zoo.retellConfig.opening);assert.ok(calls.at(-1).data.mindMap.length===3);
  sub=(await get('course')).submissions.find(s=>s.task===guidedTask.id);assert.equal(sub.assessmentState,'complete');assert.equal(sub.score,78);assert.equal(sub.aiAssessment.checks[0].item,'使用给定开头');

  // 全真模拟：三遍播放上限，笔记可选，按 10 分制换算。
  for(let i=0;i<3;i++)await post('listen',{task:examTask.id});
  await post('listen',{task:examTask.id},409);
  await post('course',{op:'submit',task:examTask.id,answers:{retell:zoo.retellConfig.opening+' You should bring water.',examLog:JSON.stringify({plays:3,answerSeconds:200,timedOut:false})}});
  assert.match(calls.at(-1).system,/北京中考英语听说考试/);
  sub=(await get('course')).submissions.find(s=>s.task===examTask.id);
  assert.equal(sub.score,75);assert.equal(sub.aiAssessment.exam.content,4.5);assert.match(sub.feedback,/全真模拟：7.5 \/ 10/);assert.match(sub.feedback,/人称转换：you 没有改成 we/);
  assert.equal(JSON.parse(sub.answers.examLog).plays,3);
 }finally{globalThis.fetch=realFetch}
});
function readNote(sub){return JSON.parse(sub.answers.retellNotes)[0].text}
