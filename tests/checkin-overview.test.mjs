import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const PNG=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f6d1ef0000000049454e44ae426082','hex');

test('upgrade of existing data, daily word check-in and student home overview',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',grammar:'app/api/grammar/route.ts',checkin:'app/api/checkin/route.ts',overview:'app/api/overview/route.ts',runtime:'lib/runtime.mjs'},bundle:true,platform:'node',format:'esm',outdir:dir,external:['mammoth','docx'],plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','grammar','checkin','overview'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const sqlite=()=>{const {DatabaseSync}=globalThis.__sqlite;return new DatabaseSync(path.join(dir,'data/english-daily.sqlite'))};
 globalThis.__sqlite=await import('node:sqlite');
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,query='',status=200){const r=await routes[route].GET(new Request('https://school.test/api/'+route+query));assert.equal(r.status,status);return r}
 const json=async(route,query='')=>(await get(route,query)).json();
 async function post(route,p,status=200){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return data}
 async function checkin(fields,images,status=200){const body=new FormData();for(const [k,v] of Object.entries(fields))body.append(k,v);for(const [i,img] of images.entries())body.append('images',new File([img],'shot'+i+'.png',{type:'image/png'}));const r=await routes.checkin.POST(new Request('https://school.test/api/checkin',{method:'POST',headers:{origin:'https://school.test'},body}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
 const login=async(u,p)=>{await post('auth',{op:'logout'});await post('auth',{op:'login',username:u,password:p})};

 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 await (await routes.course.GET()).json();
 assert.equal((await json('grammar')).questions.length,276);
 // 模拟旧版本数据：语法题库只有原 160 题（版本 1），听后转述题库停在版本 2 且第一批题没有导图，老师给其中一题加了自己的图。
 let d=sqlite();d.exec("DELETE FROM grammar_questions WHERE id LIKE 'g20-%'");d.exec('UPDATE grammar_settings SET seed_version=1');
 d.prepare("UPDATE grammar_questions SET data=json_set(data,'$.explanation','老师改过的解析') WHERE id='g100-001'").run();
 const settings=JSON.parse(d.prepare('SELECT data FROM settings WHERE id=1').get().data);d.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify({...settings,retellBankVersion:2}));
 for(const id of ['retell-bj-city-zoo','retell-bj-music-competition']){const m=JSON.parse(d.prepare('SELECT data FROM materials WHERE id=?').get(id).data);delete m.images;if(id==='retell-bj-music-competition')m.images=[{url:'/api/media?key=00000000-0000-4000-8000-000000000000',caption:'老师的图'}];d.prepare('UPDATE materials SET data=? WHERE id=?').run(JSON.stringify(m),id)}
 d.close();
 const g=await json('grammar');assert.equal(g.questions.length,276);assert.equal(g.questions.find(q=>q.id==='g100-001').explanation,'老师改过的解析');
 const counts={};for(const q of g.questions)if(q.enabled)counts[q.topic]=(counts[q.topic]||0)+1;assert.ok(Object.values(counts).every(n=>n>=20),JSON.stringify(counts));
 const mats=(await (await routes.course.GET()).json()).materials;
 assert.match(mats.find(m=>m.id==='retell-bj-city-zoo').images[0].url,/^\/api\/media\?key=[-a-f0-9]{36}$/);
 assert.equal(mats.find(m=>m.id==='retell-bj-music-competition').images[0].caption,'老师的图');
 assert.ok(mats.filter(m=>m.id.startsWith('retell-bj-')).every(m=>m.images?.length===1));
 await access(path.join(dir,'data/media',new URL(mats.find(m=>m.id==='retell-bj-city-zoo').images[0].url,'https://x').searchParams.get('key')));

 // 作业：布置一份阅读并在学生提交后批改，首页数据应反映出来。
 await post('course',{op:'material',material:{id:'r1',title:'Reading one',kind:'阅读',body:'Text.',reviewed:true,questions:[{id:'q1',type:'choice',prompt:'Pick A',options:['A','B'],answer:'A',explanation:'',tag:'细节'},{id:'q2',type:'choice',prompt:'Pick B',options:['A','B'],answer:'B',explanation:'',tag:'细节'}]}});
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 await post('course',{op:'assign',ids:['r1'],dates:[day],note:''});
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await checkin({words:'30'},[PNG],403);
 await login('student','student-long-password');

 let o=await json('overview');assert.equal(o.checkin.todayDone,false);assert.equal(o.tasks.week,1);assert.equal(o.tasks.weekDone,0);assert.equal(o.activity.length,14);
 // 打卡：必须有截图，最多 3 张，只接受图片。
 await checkin({words:'30'},[],400);
 await checkin({},[Buffer.from('not an image')],400);
 await checkin({},[PNG,PNG,PNG,PNG],400);
 await checkin({app:'百词斩',words:'30',minutes:'15',note:'复习了错词'},[PNG,PNG]);
 let list=await json('checkin');assert.equal(list.checkins.length,1);const c=list.checkins[0];
 assert.deepEqual({day:c.day,app:c.app,words:c.words,minutes:c.minutes,images:c.images.length,seen:c.seen},{day,app:'百词斩',words:30,minutes:15,images:2,seen:false});
 assert.equal((await get('checkin','?image='+c.images[0])).headers.get('content-type'),'image/png');
 await get('checkin','?image=00000000-0000-4000-8000-000000000000',404);
 // 修改当天打卡：保留一张、删除一张，被删除的文件从存储中移除。
 await checkin({app:'百词斩',words:'40',keep:JSON.stringify([c.images[0]])},[]);
 list=await json('checkin');assert.equal(list.checkins.length,1);assert.deepEqual(list.checkins[0].images,[c.images[0]]);assert.equal(list.checkins[0].words,40);
 await assert.rejects(access(path.join(dir,'data/media',c.images[1])));
 // 连续打卡：补一条昨天的记录
 d=sqlite();const y=new Date(Date.parse(day+'T12:00:00Z')-864e5).toISOString().slice(0,10);d.prepare("INSERT INTO checkins(id,student,day,images,created,updated) SELECT 'y',student,?,'[]',created,updated FROM checkins LIMIT 1").run(y);d.close();
 // 完成作业和一道语法题
 const task=(await (await routes.course.GET()).json()).tasks.find(t=>t.material.id==='r1');
 await post('course',{op:'submit',task:task.id,answers:{q1:'A',q2:'A'}});
 const st=await post('grammar',{op:'start'});await post('grammar',{op:'answer',id:st.items[0].id,choice:0});
 o=await json('overview');
 assert.equal(o.checkin.todayDone,true);assert.equal(o.checkin.streak,2);assert.equal(o.tasks.weekDone,1);assert.equal(o.grammar.answered,1);assert.equal(o.grammar.todayDone,1);
 assert.deepEqual(o.activity.at(-1),{day,task:true,grammar:true,vocabulary:false,checkin:true});assert.equal(o.activity.at(-2).checkin,true);
 await post('checkin',{op:'comment',id:c.id,comment:'坚持得很好'},403);

 // 老师：看到同样的数据，点评打卡。
 await login('teacher','teacher-long-password');
 await post('course',{op:'grade',id:(await (await routes.course.GET()).json()).submissions.find(s=>s.task===task.id).id,feedback:'',grades:{},requestRevision:false});
 o=await json('overview');assert.equal(o.checkin.streak,2);assert.deepEqual(o.scores.map(s=>s.percent),[50]);assert.equal(o.average,50);
 assert.equal((await get('checkin','?image='+c.images[0])).status,200);
 await post('checkin',{op:'comment',id:c.id,comment:'坚持得很好'});
 await checkin({},[PNG],403);
 await login('student','student-long-password');
 list=await json('checkin');const mine=list.checkins.find(x=>x.id===c.id);assert.equal(mine.comment,'坚持得很好');assert.equal(mine.seen,true);
});
