import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('daily knowledge pick and notice board merged into chat',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/home-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',messages:'app/api/messages/route.ts',knowledge:'app/api/knowledge/route.ts',culture:'app/api/culture/route.ts',pick:'lib/daily-pick.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const r={};for(const name of ['auth','course','messages','knowledge','culture','pick'])r[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const identify=(cookie='')=>{globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.11'})};
 async function post(route,body,status=200){const res=await r[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await res.json();assert.equal(res.status,status,JSON.stringify(d));if(res.headers.has('set-cookie'))identify(res.headers.get('set-cookie').split(';')[0]);return d}
 const get=async(route,q='')=>{const res=await r[route].GET(new Request('https://school.test/api/'+route+q));assert.equal(res.status,200);return res.json()};

 // 每日推荐：没打开过的优先，其次学习中，最后已完成；同一天结果固定，不同日期会轮换。
 const {pickDaily}=r.pick,ms=['a','b','c','d','e','f'].map(id=>({id,title:id.toUpperCase(),subtitle:'',kind:'知识拓展',level:'A2',minutes:10,reviewed:true,category:'体育运动'}));
 const none=new Map();
 assert.equal(pickDaily(ms,none,'2026-10-17').id,pickDaily(ms,none,'2026-10-17').id);
 assert.ok(new Set(Array.from({length:14},(_,i)=>pickDaily(ms,none,`2026-10-${String(i+1).padStart(2,'0')}`).id)).size>1);
 const some=new Map(ms.slice(0,5).map(m=>[m.id,{status:'已完成'}]));
 assert.equal(pickDaily(ms,some,'2026-10-17').id,'f');
 some.set('f',{status:'学习中',activities:['map','quiz']});some.set('b',{status:'学习中'});
 assert.deepEqual(['b','f'].includes(pickDaily(ms,some,'2026-10-17').id),true);
 const allDone=new Map(ms.map(m=>[m.id,{status:'已完成'}]));const p=pickDaily(ms,allDone,'2026-10-17');assert.equal(p.status,'已完成');
 assert.equal(pickDaily([],none,'2026-10-17'),null);
 assert.equal(pickDaily([{...ms[0],interactive:true,assets:[{name:'x',url:'/api/media?key=1',type:'audio'},{name:'y',url:'/api/media?key=2',type:'image'}]}],none,'2026-10-17').cover,'/api/media?key=2');

 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('course',{op:'teacherMessage',message:'  本周五停课，周六补课。  '});
 const base={subtitle:'Tagline here',level:'A2',minutes:20,body:'<p>x</p>',source:'老师',sourceUrl:'',rights:'原创',audio:'',questions:[],completionOnly:true,contentFormat:'html',kind:'知识拓展'};
 await post('course',{op:'material',material:{...base,id:'k1',title:'Topic One',reviewed:true,category:'体育运动'}});
 await post('course',{op:'material',material:{...base,id:'k2',title:'Draft Topic',reviewed:false}});

 // 旧“老师留言板”内容只迁移一次，成为聊天里的老师消息；之后通知被清空。
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 let chat=await get('messages');assert.deepEqual(chat.messages.map(m=>[m.author,m.body]),[['teacher','本周五停课，周六补课。']]);assert.equal(chat.unread,1);
 chat=await get('messages');assert.equal(chat.messages.length,1);
 identify(teacher);assert.equal((await get('course')).settings.teacherMessage,'');
 chat=await get('messages');assert.equal(chat.messages.length,1);
 await post('messages',{op:'send',body:'有问题随时问我。'});
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 chat=await get('messages');assert.equal(chat.unread,2);
 await post('messages',{op:'read',through:chat.messages.at(-1).id});assert.equal((await get('messages')).unread,0);

 // 学生首页的每日推荐只包含已发布主题，并带上学习进度。
 let daily=await get('knowledge','?daily=1');
 assert.equal(daily.total,1);assert.equal(daily.explored,0);assert.equal(daily.pick.id,'k1');assert.equal(daily.pick.status,'未开始');assert.equal(daily.pick.tagline,'Tagline here');assert.equal(daily.pick.category,'体育运动');
 await post('culture',{material:'k1',activity:'map'});
 daily=await get('knowledge','?daily=1');assert.equal(daily.explored,1);assert.equal(daily.pick.status,'学习中');assert.equal(daily.pick.activities,1);
});
