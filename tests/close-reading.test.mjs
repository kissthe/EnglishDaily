import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('close reading: AI-pushed articles, reading progress, annotations, study cards and recite marks',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/close-reading-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 const entry={auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',reading:'app/api/close-reading/route.ts',cards:'app/api/cards/route.ts',annotations:'app/api/annotations/route.ts',translation:'app/api/reading-translation/route.ts',wordbook:'app/api/wordbook/route.ts',print:'app/cards/print/route.ts',sample:'lib/close-reading-sample.ts',lib:'lib/close-reading.ts'};
 await build({entryPoints:entry,bundle:true,platform:'node',format:'esm',outdir:dir,external:['mammoth'],plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const r={};for(const name of Object.keys(entry))r[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const identify=(cookie='')=>{globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.21'})};
 async function post(route,body,status=200){const res=await r[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await res.json();assert.equal(res.status,status,JSON.stringify(d));if(res.headers.has('set-cookie'))identify(res.headers.get('set-cookie').split(';')[0]);return d}
 const get=async(route,q='',status=200)=>{const res=await r[route].GET(new Request('https://school.test/x'+q));assert.equal(res.status,status);return res};
 const {sampleCloseReading:s}=r.sample,{articleText,splitParagraphs,findWord,buildCard}=r.lib,text=articleText(s.closeReading);

 // AI 接口用本地替身：返回标题、副标题和每段讲解（其中故意夹带原文里没有的词和句）。
 let aiCalls=0;const realFetch=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{if(!String(url).startsWith('https://ai.test/'))return realFetch(url,init);aiCalls++;const input=JSON.parse(JSON.parse(init.body).messages[1].content);
  if(!input.paragraphs)return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({translation:'自我怀疑',notes:''})}}]}),{headers:{'content-type':'application/json'}});
  const out={title:'Values and Actions',subtitle:'行动与价值观',paragraphs:input.paragraphs.map((p,i)=>({words:[{word:p.text.split(' ')[1],phonetic:'',meaning:'释义',usage:''},{word:'notintext',phonetic:'',meaning:'x',usage:''}],sentences:[{text:p.text.split(/(?<=\.)\s/)[0],grammar:'语法',translation:'翻译'},{text:'Invented sentence.',grammar:'',translation:''}],practice:[{type:'word',target:'value',prompt:`第${i+1}段造句`,example:''}]}))};
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(out)}}]}),{headers:{'content-type':'application/json'}})};

 assert.deepEqual(splitParagraphs('One\nline.\n\n\nTwo.  \n'),['One line.','Two.']);
 assert.deepEqual(findWord('By admitting it, we grow.','admit'),{start:3,end:12});
 const card=buildCard('T','S',{paragraphs:[{text:'x',words:[{word:'value',phonetic:'',meaning:'重视',usage:''}],sentences:[],practice:[{type:'word',target:'value',prompt:'造句',example:''}]}]},{paragraph:0,answers:{'0-0':'I value time.'},comments:{'0-0':'Good!'},finished:null},[{kind:'word',text:'Value',note:'dup'}],()=>Math.random().toString(36).slice(2));
 assert.deepEqual(card.items.map(i=>[i.type,i.text,i.recite]),[['word','value',false],['practice','I value time.',false]]);

 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 assert.match((await post('reading',{op:'create',text},502)).error,/AI/);
 await post('course',{op:'aiSettings',settings:{aiBaseUrl:'https://ai.test/v1',aiModel:'m',aiApiKey:'k'}});

 // 老师：上传 TXT 读取正文；直接推送（AI 生成标题与讲解），学生立即可见。
 assert.equal((await post('reading',{op:'extract',name:'a.txt',data:Buffer.from('Hello\n\nWorld').toString('base64')})).text,'Hello\n\nWorld');
 await post('reading',{op:'extract',name:'a.pdf',data:'AA=='},400);
 const {id}=await post('reading',{op:'create',text,source:'2024 中考'});assert.equal(aiCalls,1);
 const plain=(await post('reading',{op:'create',title:'Plain',text:'First paragraph here.\n\nSecond one.',ai:false})).id;assert.equal(aiCalls,1);
 let list=(await (await get('reading')).json()).articles;assert.deepEqual(list.map(a=>a.title),['Plain','Values and Actions']);
 let art=(await (await get('reading','?id='+id)).json()).article;
 assert.equal(art.subtitle,'行动与价值观');assert.equal(art.closeReading.paragraphs.length,5);
 assert.ok(art.closeReading.paragraphs.every(p=>p.words.length===1&&p.sentences.length===1&&!p.words.some(w=>w.word==='notintext')));
 // 精读不进入作业、批改和题库。
 const course=await (await r.course.GET()).json();assert.equal(course.tasks.length,0);assert.ok(!course.materials.some(m=>m.kind==='精读'));
 // 编辑讲解：替换为示例讲解；找不到原文的句子被丢弃。
 const edited=structuredClone(s.closeReading);edited.paragraphs[0].sentences.push({text:'Not here.',grammar:'',translation:''});
 await post('reading',{op:'update',id,title:s.title,subtitle:s.subtitle,source:s.source,closeReading:edited});
 art=(await (await get('reading','?id='+id)).json()).article;assert.equal(art.title,s.title);assert.equal(art.closeReading.paragraphs[0].sentences.length,1);assert.equal(art.closeReading.paragraphs[1].words.length,7);
 await post('reading',{op:'remove',id:plain});assert.equal((await (await get('reading')).json()).articles.length,1);

 // 学生：待精读列表、仿写保存、划线进单词本、翻译不需要提交。
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 await post('reading',{op:'create',text},403);await post('cards',{op:'recite',id:'x',item:'y',recite:true},403);
 list=(await (await get('reading')).json()).articles;assert.deepEqual(list.map(a=>[a.title,a.status]),[[s.title,'未开始']]);
 let p=(await post('reading',{op:'save',task:id,answers:{'0-0':'I value my family.','1-1':'Reading books can make me calm.'}})).progress;
 assert.deepEqual(Object.keys(p.answers).sort(),['0-0','1-1']);assert.equal((await (await get('reading')).json()).articles[0].status,'在读');
 await post('reading',{op:'save',task:id,answers:{'9-0':'x'}},400);
 const para=s.closeReading.paragraphs[1].text,start=para.indexOf('self-doubt');
 await post('annotations',{op:'save',task:id,section:'para:1',start,end:start+10,text:'self-doubt',kind:'word',note:'自我怀疑'});
 assert.match((await (await get('wordbook')).json()).entries[0].context,/^This disagreement can lead to serious results/);
 assert.equal((await post('translation',{task:id,section:'para:1',start,end:start+10,text:'self-doubt'})).translation!==undefined,true);

 identify(teacher);assert.equal((await post('reading',{op:'comment',task:id,key:'0-0',text:'Nice sentence!'})).progress.comments['0-0'],'Nice sentence!');
 assert.equal((await (await get('reading')).json()).articles[0].status,'在读');

 // 完成：生成学习卡片；老师标记背诵抄写，学生保存卡片时不能改动这个标记。
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 const done=await post('reading',{op:'finish',task:id});assert.ok(done.card);
 list=(await (await get('reading')).json()).articles;assert.deepEqual([list[0].status,list[0].card],['已读',done.card]);
 let cards=(await (await get('cards')).json()).cards;const items=cards[0].data.items;
 assert.equal(items.filter(i=>i.type==='word').length,28);assert.equal(items.filter(i=>i.type==='sentence').length,8);assert.deepEqual(items.filter(i=>i.type==='practice').map(i=>[i.text,i.note]),[['I value my family.','Nice sentence!'],['Reading books can make me calm.','']]);
 identify(teacher);
 const target=items.find(i=>i.type==='sentence');cards=(await post('cards',{op:'recite',id:done.card,item:target.id,recite:true})).cards;
 assert.deepEqual(cards[0].data.items.filter(i=>i.recite).map(i=>i.id),[target.id]);
 await post('cards',{op:'save',id:done.card,data:cards[0].data},403);
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 const mine=(await (await get('cards')).json()).cards[0].data;
 cards=(await post('cards',{op:'save',id:done.card,data:{...mine,title:'我的卡片',items:mine.items.map(i=>({...i,recite:i.type==='word'}))}})).cards;
 assert.deepEqual(cards[0].data.items.filter(i=>i.recite).map(i=>i.id),[target.id]);assert.equal(cards[0].data.title,'我的卡片');
 const again=(await post('cards',{op:'generate',task:id,replace:true})).card;assert.equal(again.data.items.filter(i=>i.recite).length,1);
 const html=await (await get('print','?id='+done.card)).text();assert.match(html,/背诵抄写/);assert.doesNotMatch(html,/background:var\(--ink\)/);
 const docx=await get('cards','?export=docx&id='+done.card);const bytes=new Uint8Array(await docx.arrayBuffer());assert.equal(String.fromCharCode(bytes[0],bytes[1]),'PK');

 // 移除已读过的文章：老师列表中消失，学生的“读过的文章”和卡片保留。
 identify(teacher);await post('reading',{op:'remove',id});assert.equal((await (await get('reading')).json()).articles.length,0);
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 assert.deepEqual((await (await get('reading')).json()).articles.map(a=>[a.status,a.archived]),[['已读',true]]);
 assert.equal((await (await get('cards')).json()).cards.length,1);
 globalThis.fetch=realFetch;
});
