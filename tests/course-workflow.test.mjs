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
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',listen:'app/api/listen/route.ts',audio:'app/api/audio/route.ts',media:'app/api/media/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','listen','audio','media'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,status=200){const r=await routes[route].GET();assert.equal(r.status,status);return r.json()}
 async function post(route,p,status=200,origin='https://school.test'){const r=await routes[route].POST(new Request('http://127.0.0.1:3000/api/'+route,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie')){assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure/);identify(r.headers.get('set-cookie').split(';')[0])}return data}
 await get('course',401);assert.equal((await get('auth')).canBootstrap,false);await post('auth',{op:'setupTeacher',username:'attacker',password:'attacker-password'},403);
 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');assert.equal((await get('course')).role,'teacher');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 async function upload(route,bytes,type){const body=new FormData();body.append('file',new File([bytes],'sample',{type}));const r=await routes[route].POST(new Request('http://127.0.0.1:3000/api/'+route,{method:'POST',headers:{origin:'https://school.test'},body}));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.url}
 const audio=await upload('audio','sample-audio','audio/mpeg');const video=await upload('media','0123456789','video/mp4');
 const ranged=await routes.media.GET(new Request('https://school.test'+video,{headers:{range:'bytes=2-5'}}));assert.equal(ranged.status,206);assert.equal(await ranged.text(),'2345');assert.equal(ranged.headers.get('content-range'),'bytes 2-5/10');
 const material={id:'dictation',title:'Listen',subtitle:'Key sentences',kind:'听力',level:'A2',minutes:8,body:'He has a blue bag.',source:'老师自编',sourceUrl:'',rights:'原创',audio,playLimit:1,reviewed:true,questions:[{id:'q1',type:'fill',prompt:'请听写第 1 句。',options:[],answer:'He has a blue bag.',explanation:'注意冠词。',tag:'听写',strict:true}]};
 await post('course',{op:'material',material});await post('course',{op:'assign',ids:['dictation'],dates:['2026-01-01'],note:''});const task=(await get('course')).tasks[0];await post('course',{op:'submit',task:task.id,answers:{q1:'test'}},403);
 await post('auth',{op:'login',username:'student',password:'student-long-password'},409);await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});const student=globalThis.__headers.get('cookie');
 await post('course',{op:'material',material},403);await post('auth',{op:'saveStudent',username:'other',password:'other-password',teacherPassword:'student-long-password'},403);const hidden=(await get('course')).tasks[0].material;assert.equal(hidden.body,'');assert.equal(hidden.questions[0].answer,undefined);
 assert.equal((await routes.audio.GET(new Request('https://school.test'+audio))).status,403);const play=await post('listen',{task:task.id});const sound=await routes.audio.GET(new Request('https://school.test'+play.url));assert.equal(await sound.text(),'sample-audio');assert.equal((await routes.audio.GET(new Request('https://school.test'+play.url))).status,403);await post('listen',{task:task.id},409);
 await post('course',{op:'submit',task:task.id,answers:{q1:'He has blue bag.'}},403,'https://attacker.test');await post('course',{op:'submit',task:task.id,answers:{q1:'He has blue bag.'}});let data=await get('course');assert.equal(data.submissions[0].score,0);assert.equal(data.tasks[0].material.questions[0].answer,material.questions[0].answer);await post('course',{op:'correct',task:task.id,answers:{q1:'He has a blue bag.'}});assert.equal((await get('course')).submissions[0].answers.q1,'He has blue bag.');
 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});await post('auth',{op:'saveStudent',username:'student',password:'student-reset-password',teacherPassword:'teacher-long-password'});identify(student);await get('course',401);
 const persisted=execFileSync(process.execPath,['--input-type=module','-e',"import {openDatabase,env} from './lib/runtime.mjs';const d=openDatabase();console.log(JSON.stringify({submissions:d.prepare('SELECT count(*) AS n FROM submissions').get().n,migrations:d.prepare('SELECT count(*) AS n FROM selfhost_migrations').get().n}));"],{env:process.env,encoding:'utf8'});assert.deepEqual(JSON.parse(persisted),{submissions:1,migrations:6});
 const {env}=await import('../lib/runtime.mjs');await assert.rejects(env.BUCKET.get('../etc/passwd'));await assert.rejects(env.DB.batch([env.DB.prepare("INSERT INTO materials VALUES ('rollback','{}','today')"),env.DB.prepare('INVALID SQL')]));assert.equal(await env.DB.prepare("SELECT * FROM materials WHERE id='rollback'").first(),null);
 await rm(dir,{recursive:true,force:true});
});
