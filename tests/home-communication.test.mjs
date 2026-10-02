import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('daily reminder, 1000-word limit and durable role-isolated conversation',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/home-communication-'));
 process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',vocabulary:'app/api/vocabulary/route.ts',messages:'app/api/messages/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','vocabulary','messages'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.5'})}
 async function post(route,body,status=200,origin='https://school.test'){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return d}
 async function get(route,query='',status=200){const r=await routes[route].GET(new Request('https://school.test/api/'+route+query));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
 await get('messages','',401);
 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await get('messages','',409);
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('vocabulary',{op:'settings',dailyNew:1000});assert.equal((await get('vocabulary')).dailyNew,1000);
 await post('vocabulary',{op:'settings',dailyNew:1001},400);await post('vocabulary',{op:'settings',dailyNew:-1},400);
 await post('vocabulary',{op:'settings',dailyNew:8});
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});const student=globalThis.__headers.get('cookie');
 await post('vocabulary',{op:'settings',dailyNew:1000},403);
 let summary=await get('vocabulary','?summary=1');assert.equal(summary.newAvailable,8);assert.equal(summary.pendingNew,0);assert.equal(summary.cards,undefined);assert.equal(summary.progress,undefined);
 await post('vocabulary',{op:'start'});summary=await get('vocabulary','?summary=1');assert.equal(summary.newAvailable,0);assert.equal(summary.pendingNew,8);
 const card=(await get('vocabulary')).cards[0];await post('vocabulary',{op:'answer',id:card.id,choice:null,unsure:true});
 summary=await get('vocabulary','?summary=1');assert.equal(summary.pendingNew,7);assert.equal(summary.done,1);
 await post('messages',{op:'send',body:'   '},400);await post('messages',{op:'send',body:'x'.repeat(2001)},400);
 await post('messages',{op:'send',body:'今天有事，明天补交。'},403,'https://evil.test');
 await post('messages',{op:'send',body:'  今天有事，明天补交。  ',author:'teacher',student:'someone-else'});
 let page=await get('messages');assert.equal(page.messages.length,1);assert.equal(page.messages[0].author,'student');assert.equal(page.messages[0].body,'今天有事，明天补交。');assert.equal(page.unread,0);
 identify(teacher);page=await get('messages');assert.equal(page.unread,1);
 await post('messages',{op:'read',through:page.messages[0].id});assert.equal((await get('messages')).unread,0);
 await post('messages',{op:'send',body:'收到，注意休息，明天再补。'});
 identify(student);page=await get('messages');assert.equal(page.unread,1);assert.equal(page.messages[0].read_at!==null,true);assert.equal(page.messages[1].author,'teacher');
 await post('messages',{op:'read',through:page.messages[1].id});assert.equal((await get('messages')).unread,0);
 // Persistent history is paginated without dropping older messages.
 const db=new DatabaseSync(path.join(process.env.DATA_DIR,'english-daily.sqlite'));
 const account=db.prepare("SELECT id FROM accounts WHERE role='student'").get().id;
 const insert=db.prepare("INSERT INTO messages(student,author,body,created) VALUES(?,'teacher',?,?)");
 for(let i=0;i<55;i++)insert.run(account,'留言 '+i,new Date().toISOString());
 db.close();page=await get('messages');assert.equal(page.messages.length,50);assert.equal(page.hasOlder,true);assert.equal(page.unread,55);
 const older=await get('messages','?before='+page.messages[0].id);assert.equal(older.messages.length,7);assert.equal(older.hasOlder,false);assert.ok(older.messages.every(m=>m.id<page.messages[0].id));
 await get('messages','?before=invalid',400);
 identify();await get('messages','',401);
});
