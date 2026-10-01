import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('submitted reading translation, listening images and independent teacher notice',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/student-features-'));
 process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',media:'app/api/media/route.ts',translation:'app/api/reading-translation/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','media','translation'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.2'})}
 async function post(route,body,status=200){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return d}
 async function get(){const r=await routes.course.GET();assert.equal(r.status,200);return r.json()}
 async function upload(type,bytes,status=200){const form=new FormData();form.append('file',new File([bytes],'upload',{type}));const r=await routes.media.POST(new Request('https://school.test/api/media',{method:'POST',headers:{origin:'https://school.test'},body:form}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'translation-model',aiApiKey:'test-secret'}});
 await post('course',{op:'teacherMessage',message:'今天没有新作业，周一再继续。'});
 assert.equal((await get()).settings.teacherMessage,'今天没有新作业，周一再继续。');
 await upload('image/svg+xml','<svg/>',400);await upload('image/png','not a PNG',400);
 const image=await upload('image/png',png),unassigned=await upload('image/png',png),futureImage=await upload('image/png',png);
 const base={subtitle:'',level:'A2',minutes:10,source:'老师自编',sourceUrl:'',rights:'原创',reviewed:true};
 const reading={...base,id:'reading-translation',title:'Reading',kind:'阅读',body:'A small device can help students learn.',audio:'',explanationVisibility:'reviewed',questions:[{id:'q1',type:'choice',prompt:'What can help students?',options:['A device','A tree'],answer:'A device',explanation:'根据原文',tag:'细节'}]};
 const listening={...base,id:'listening-image',title:'Listening',kind:'听力',body:'Listen to the map.',audio:'/api/audio?key=00000000-0000-0000-0000-000000000000',images:[{url:image.url,caption:'活动地图'}],questions:[{id:'q1',type:'fill',prompt:'Listen',options:[],answer:'map',explanation:'',tag:'听写'}]};
 await post('course',{op:'material',material:reading});await post('course',{op:'material',material:listening});
 await post('course',{op:'material',material:{...listening,id:'future-images',images:[{url:futureImage.url,caption:'未开放'}]}});
 await post('course',{op:'material',material:{...listening,id:'invalid-images',images:[{url:'https://other.test/image.png',caption:''}]}},400);
 await post('course',{op:'assign',ids:[reading.id,listening.id],dates:['2026-01-01'],note:''});
 await post('course',{op:'assign',ids:['future-images'],dates:['2099-01-01'],note:''});
 const tasks=(await get()).tasks,readingTask=tasks.find(t=>t.material.id===reading.id),listeningTask=tasks.find(t=>t.material.id===listening.id);
 await post('translation',{task:readingTask.id,section:'body',start:0,end:1,text:'A'},403);
 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});const student=globalThis.__headers.get('cookie');
 let state=await get();assert.equal(state.settings.teacherMessage,'今天没有新作业，周一再继续。');assert.ok(state.settings.teacherMessageUpdated);assert.equal(state.settings.aiApiKey,undefined);
 assert.deepEqual(state.tasks.find(t=>t.id===listeningTask.id).material.images,listening.images);
 await post('course',{op:'teacherMessage',message:'学生不能修改'},403);await upload('image/png',png,403);
 assert.equal((await routes.media.GET(new Request('https://school.test'+unassigned.url))).status,403);
 assert.equal((await routes.media.GET(new Request('https://school.test'+futureImage.url))).status,403);
 const downloaded=await routes.media.GET(new Request('https://school.test'+image.url));assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),png);
 const selection={task:readingTask.id,section:'body',start:8,end:14,text:'device'};
 let calls=0;const realFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://ai.test/v1/chat/completions');const p=JSON.parse(init.body);assert.match(p.messages[0].content,/只翻译/);assert.match(p.messages[0].content,/不要回答阅读题目/);const input=JSON.parse(p.messages[1].content);assert.equal(input.selectedText,'device');assert.equal(input.context,reading.body);assert.equal(input.questions,undefined);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({translation:'设备',notes:'这里指帮助学生学习的小设备。'})}}]}))};
  await post('translation',selection,403);assert.equal(calls,0);
  await post('course',{op:'draft',task:readingTask.id,answers:{q1:'A device'}});await post('translation',selection,403);assert.equal(calls,0);
  await post('course',{op:'submit',task:readingTask.id,answers:{q1:'A device'}});
  state=await get();assert.equal(state.tasks.find(t=>t.id===readingTask.id).material.questions[0].answer,undefined);
  const result=await post('translation',selection);assert.equal(result.translation,'设备');assert.equal(calls,1);
  await post('translation',{...selection,text:'invented'},400);await post('translation',{...selection,end:120000},400);assert.equal(calls,1);
  await post('translation',{...selection,task:'another-task'},403);assert.equal(calls,1);
  await post('course',{op:'submit',task:listeningTask.id,answers:{q1:'map'}});await post('translation',{...selection,task:listeningTask.id},400);assert.equal(calls,1);
 }finally{globalThis.fetch=realFetch}
 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 await post('course',{op:'teacherMessage',message:''});
 await post('course',{op:'material',material:{...listening,images:[]}});
 identify(student);state=await get();assert.equal(state.settings.teacherMessage,'');assert.deepEqual(state.tasks.find(t=>t.id===listeningTask.id).material.images,listening.images);
 // The notice is independent of task creation; saving it never creates extra homework.
 assert.equal(state.tasks.length,2);
});
