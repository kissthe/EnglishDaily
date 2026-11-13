import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import mammoth from 'mammoth';

test('wordbook: homework and HTML collection, dedupe, sync with annotations, Word export',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',annotations:'app/api/annotations/route.ts',wordbook:'app/api/wordbook/route.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,external:['mammoth','docx'],plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','annotations','wordbook'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 function identify(cookie=''){globalThis.__headers=new Headers({'cookie':cookie,'x-real-ip':'192.0.2.1'})}
 async function get(route,query='',status=200){const r=await routes[route].GET(new Request('https://school.test/api/'+route+query));assert.equal(r.status,status);return r}
 async function post(route,p,status=200){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(p)}));const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return data}
 const entries=async()=>(await (await get('wordbook')).json()).entries;
 const login=async(u,p)=>{await post('auth',{op:'logout'});await post('auth',{op:'login',username:u,password:p})};

 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});
 const body='Last Saturday, Mia visited a small library near her home. She expected to find books, but she also saw shelves full of tools.';
 await post('course',{op:'material',material:{id:'reading-wb',title:'A different library',kind:'阅读',body,reviewed:true,questions:[{id:'q1',type:'choice',prompt:'Where did Mia go?',options:['A library','A park'],answer:'A library',explanation:'',tag:'细节'}]}});
 await post('course',{op:'material',material:{id:'topic-wb',title:'Museums',kind:'知识拓展',body:'<article><h1>Museums</h1><p>The museum has a huge <b>exhibition</b> of ancient art. Visitors love it.</p></article>',contentFormat:'html',completionOnly:true,reviewed:true}});
 await post('course',{op:'material',material:{id:'draft-wb',title:'Draft',kind:'知识拓展',body:'<p>Secret draft words.</p>',contentFormat:'html',completionOnly:true,reviewed:false}});
 await post('course',{op:'assign',ids:['reading-wb'],dates:['2026-01-01'],note:''});
 const task=JSON.parse(await (await routes.course.GET()).text()).tasks[0];
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 await post('wordbook',{op:'add',kind:'word',text:'exhibition',sourceKind:'knowledge',sourceId:'topic-wb'},403);
 await login('student','student-long-password');

 // 作业中收藏单词：自动带出原句；仅划线不进单词本。
 const start=body.indexOf('library');
 await post('annotations',{op:'save',task:task.id,section:'body',start,end:start+7,text:'library',kind:'word',note:'n. 图书馆'});
 const hs=body.indexOf('shelves');await post('annotations',{op:'save',task:task.id,section:'body',start:hs,end:hs+7,text:'shelves',kind:'highlight'});
 let list=await entries();assert.equal(list.length,1);
 assert.deepEqual({text:list[0].text,kind:list[0].kind,note:list[0].note,source:list[0].sourceKind,title:list[0].sourceTitle,from:list[0].fromAnnotation},{text:'library',kind:'word',note:'n. 图书馆',source:'task',title:'A different library',from:true});
 assert.equal(list[0].context,'Last Saturday, Mia visited a small library near her home.');
 // 收藏句子
 const s0=body.indexOf('She expected');const sentence='She expected to find books, but she also saw shelves full of tools.';
 await post('annotations',{op:'save',task:task.id,section:'body',start:s0,end:s0+sentence.length,text:sentence,kind:'sentence',note:'but 表转折'});
 assert.equal((await entries()).filter(e=>e.kind==='sentence').length,1);

 // HTML 页面收藏：来源需已发布，文字需出现在页面中；同一单词合并。
 await post('wordbook',{op:'add',kind:'word',text:'exhibition',context:'The museum has a huge exhibition of ancient art.',sourceKind:'knowledge',sourceId:'topic-wb'});
 await post('wordbook',{op:'add',kind:'word',text:'Exhibition ',note:'n. 展览',sourceKind:'knowledge',sourceId:'topic-wb'});
 await post('wordbook',{op:'add',kind:'word',text:'spaceship',sourceKind:'knowledge',sourceId:'topic-wb'},400);
 await post('wordbook',{op:'add',kind:'word',text:'Secret',sourceKind:'knowledge',sourceId:'draft-wb'},404);
 list=await entries();const ex=list.filter(e=>e.text.toLowerCase().trim()==='exhibition');
 assert.equal(ex.length,1);assert.equal(ex[0].note,'n. 展览');assert.equal(ex[0].context,'The museum has a huge exhibition of ancient art.');assert.equal(ex[0].sourceTitle,'Museums');

 // 在单词本里编辑：同步到作业批注；标记已掌握；删除后原文划线保留。
 const lib=list.find(e=>e.text==='library');
 await post('wordbook',{op:'update',id:lib.id,note:'n. 图书馆（借书的地方）',mastered:true});
 let marks=(await (await get('annotations','?task='+task.id)).json()).annotations;
 assert.equal(marks.find(a=>a.text==='library').note,'n. 图书馆（借书的地方）');assert.equal((await entries()).find(e=>e.id===lib.id).mastered,true);
 await post('wordbook',{op:'delete',id:lib.id});
 marks=(await (await get('annotations','?task='+task.id)).json()).annotations;assert.equal(marks.find(a=>a.text==='library').kind,'highlight');
 assert.equal((await entries()).some(e=>e.text==='library'),false);
 // 把划线改回单词 → 重新进入单词本；删除划线 → 单词本同步删除。
 const mark=marks.find(a=>a.text==='library');
 await post('annotations',{op:'update',id:mark.id,kind:'word',note:'图书馆'});assert.equal((await entries()).some(e=>e.text==='library'),true);
 await post('annotations',{op:'delete',id:mark.id});assert.equal((await entries()).some(e=>e.text==='library'),false);

 // 导出 Word：完整版含释义，默写版不含释义。
 let r=await get('wordbook','?export=docx');assert.match(r.headers.get('content-type'),/wordprocessingml/);
 let text=(await mammoth.extractRawText({buffer:Buffer.from(await r.arrayBuffer())})).value;
 assert.match(text,/exhibition/);assert.match(text,/n\. 展览/);assert.match(text,/She expected to find books/);assert.match(text,/but 表转折/);
 r=await get('wordbook','?export=docx&mode=quiz&kind=word');text=(await mammoth.extractRawText({buffer:Buffer.from(await r.arrayBuffer())})).value;
 assert.match(text,/默写/);assert.match(text,/exhibition/);assert.doesNotMatch(text,/展览/);assert.doesNotMatch(text,/She expected/);
 await get('wordbook','?export=docx&mode=bad',400);

 // 老师可以查看学生单词本，但不能修改。
 await login('teacher','teacher-long-password');
 assert.equal((await entries()).length,2);
 await post('wordbook',{op:'delete',id:ex[0].id},403);
});
