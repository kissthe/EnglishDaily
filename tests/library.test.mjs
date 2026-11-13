import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('library: Word upload, conversion, publishing, download control and deletion; retell bank batch 2',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',library:'app/api/library/route.ts',media:'app/api/media/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,external:['mammoth'],plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','library','media'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,query='',status=200){const r=await routes[route].GET(new Request('https://school.test/api/'+route+query));assert.equal(r.status,status);return r}
 async function post(route,p,status=200){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return data}
 async function upload(fields,bytes,name,status=200){const body=new FormData();body.append('file',new File([bytes],name,{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));for(const [k,v] of Object.entries(fields))body.append(k,v);const r=await routes.library.POST(new Request('https://school.test/api/library',{method:'POST',headers:{origin:'https://school.test'},body}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
 const docx=await readFile('tests/fixtures/library-sample.docx');

 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 // 第二批听后转述题：20 道，带导图图片，暂无音频，均未发布。
 const course=await (await routes.course.GET()).json();
 const mock=course.materials.filter(m=>m.id.startsWith('retell-mock-'));
 assert.equal(mock.length,20);assert.ok(mock.every(m=>!m.reviewed&&!m.audio&&m.images.length===1&&m.retellConfig.version===2&&m.retellConfig.opening));
 assert.equal(mock[0].retellConfig.slots.split('\n')[0],'# A School Field Trip');assert.match(mock[0].retellConfig.referenceRetell,/【基础稳妥版】.*\n\n【高分进阶版】/s);
 assert.equal((await get('media','?key='+new URL(mock[0].images[0].url,'https://x').searchParams.get('key'))).headers.get('content-type'),'image/png');
 await post('course',{op:'material',material:{...mock[0],reviewed:true}},400);// 需先上传音频才能发布

 await upload({},Buffer.from('not a zip'),'notes.docx',400);
 await upload({},docx,'old.doc',400);
 const {item}=await upload({title:'',category:'讲义',description:'时态复习'},docx,'时态练习.docx');
 assert.equal(item.title,'时态练习');assert.equal(item.published,false);assert.equal(item.foldAnswers,true);assert.equal(item.fileKey,undefined);
 let page=await (await get('library','?id='+item.id)).json();assert.match(page.html,/<h2>训练 1<\/h2>/);assert.match(page.html,/【答案与讲解】/);
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});
 assert.deepEqual((await (await get('library')).json()).items,[]);await get('library','?id='+item.id,404);
 await upload({},docx,'x.docx',403);await post('library',{op:'delete',id:item.id},403);

 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 await post('library',{op:'update',id:item.id,item:{...item,published:true}});
 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});
 const listed=(await (await get('library')).json()).items;assert.equal(listed.length,1);assert.equal(listed[0].category,'讲义');
 page=await (await get('library','?id='+item.id)).json();assert.match(page.html,/was waiting/);
 const file=await get('library','?download=1&id='+item.id);assert.deepEqual(Buffer.from(await file.arrayBuffer()),docx);assert.match(file.headers.get('content-disposition'),/filename\*=UTF-8''%E6%97%B6/);

 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 await post('library',{op:'update',id:item.id,item:{...item,published:true,allowDownload:false}});
 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'student',password:'student-long-password'});
 await get('library','?download=1&id='+item.id,403);

 await post('auth',{op:'logout'});await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 const stored=JSON.parse(execFileSync(process.execPath,['-e',`const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync(process.argv[1]).prepare('SELECT data FROM library_items').get().data)`,path.join(dir,'data/english-daily.sqlite')],{stdio:['ignore','pipe','ignore']}).toString());
 await access(path.join(dir,'data/media',stored.fileKey));
 await post('library',{op:'delete',id:item.id});
 assert.deepEqual((await (await get('library')).json()).items,[]);
 await assert.rejects(access(path.join(dir,'data/media',stored.fileKey)));await assert.rejects(access(path.join(dir,'data/media',stored.htmlKey)));
});
