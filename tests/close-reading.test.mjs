import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('close reading: paragraph notes, imitation progress, annotations and study cards',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/close-reading-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 const entry={auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',reading:'app/api/close-reading/route.ts',cards:'app/api/cards/route.ts',annotations:'app/api/annotations/route.ts',translation:'app/api/reading-translation/route.ts',wordbook:'app/api/wordbook/route.ts',print:'app/cards/print/route.ts',sample:'lib/close-reading-sample.ts',lib:'lib/close-reading.ts'};
 await build({entryPoints:entry,bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const r={};for(const name of Object.keys(entry))r[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const identify=(cookie='')=>{globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.21'})};
 async function post(route,body,status=200){const res=await r[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await res.json();assert.equal(res.status,status,JSON.stringify(d));if(res.headers.has('set-cookie'))identify(res.headers.get('set-cookie').split(';')[0]);return d}
 const get=async(route,q='',status=200)=>{const res=await r[route].GET(new Request('https://school.test/x'+q));assert.equal(res.status,status);return res};
 const {sampleCloseReading:s}=r.sample,{articleText,splitParagraphs,findWord,buildCard}=r.lib;

 // 纯函数：拆段、找词（含词尾变化）、默认卡片去重。
 assert.deepEqual(splitParagraphs('One\nline.\n\n\nTwo.  \n'),['One line.','Two.']);
 assert.deepEqual(findWord('By admitting it, we grow.','admit'),{start:3,end:12});assert.equal(findWord('submit it','admit'),null);
 const card=buildCard('T','S',{paragraphs:[{text:'x',words:[{word:'value',phonetic:'',meaning:'重视',usage:''}],sentences:[],practice:[{type:'word',target:'value',prompt:'造句',example:''}]}]},{paragraph:0,answers:{'0-0':'I value time.'},comments:{'0-0':'Good!'},finished:null},[{kind:'word',text:'Value',note:'dup'},{kind:'sentence',text:'Mine.',note:'n'}],()=>Math.random().toString(36).slice(2));
 assert.deepEqual(card.items.map(i=>[i.type,i.text,i.note]),[['word','value',''],['sentence','Mine.',''],['practice','I value time.','Good!']]);

 identify();await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 const material={id:'cr-2024d',title:s.title,subtitle:s.subtitle,kind:'精读',level:s.level,minutes:s.minutes,body:articleText(s.closeReading),source:s.source,sourceUrl:'',rights:'课堂教学使用',audio:'',reviewed:true,questions:[],completionOnly:true,contentFormat:'text',closeReading:s.closeReading};
 const broken=structuredClone(material);broken.closeReading.paragraphs[1].sentences[0].text='Not in the paragraph.';
 assert.match((await post('course',{op:'material',material:broken},400)).error,/第 2 段的重点句 1/);
 assert.match((await post('course',{op:'material',material:{...material,body:'changed'}},400)).error,/不一致/);
 await post('course',{op:'material',material:{...material,id:'reading-x',kind:'阅读',completionOnly:false,questions:[{id:'q1',type:'choice',prompt:'?',options:['a','b'],answer:'a',explanation:'',tag:'细节理解'}]}},400);
 await post('course',{op:'material',material});
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 await post('course',{op:'assign',ids:['cr-2024d'],dates:[day],note:''});
 const taskId=(await (await r.course.GET()).json()).tasks[0].id;
 await post('reading',{op:'save',task:taskId,paragraph:0,answers:{}},403);
 assert.equal((await post('reading',{op:'draft',paragraphs:['A short paragraph.']},502)).error.includes('AI'),true);

 // 学生：保存段落位置与仿写；无效题号被拒绝；老师可以点评。
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 let p=(await post('reading',{op:'save',task:taskId,paragraph:2,answers:{'0-0':'I value my family.','1-1':'Reading books can make me calm.'}})).progress;
 assert.equal(p.paragraph,2);assert.deepEqual(Object.keys(p.answers).sort(),['0-0','1-1']);
 p=(await post('reading',{op:'save',task:taskId,paragraph:3,answers:{'1-1':''}})).progress;assert.deepEqual(Object.keys(p.answers),['0-0']);
 await post('reading',{op:'save',task:taskId,paragraph:0,answers:{'9-0':'x'}},400);
 await post('reading',{op:'comment',task:taskId,key:'0-0',text:'Nice!'},403);
 await post('reading',{op:'draft',paragraphs:['x']},403);

 // 划线与翻译可用于精读段落；收藏的单词带原句进入单词本。
 const para=s.closeReading.paragraphs[1].text,start=para.indexOf('self-doubt');
 await post('annotations',{op:'save',task:taskId,section:'para:1',start,end:start+10,text:'self-doubt',kind:'word',note:'自我怀疑'});
 await post('annotations',{op:'save',task:taskId,section:'para:1',start,end:start+10,text:'self-dout',kind:'word',note:''},400);
 const words=(await (await get('wordbook')).json()).entries;
 assert.equal(words[0].text,'self-doubt');assert.match(words[0].context,/^This disagreement can lead to serious results/);
 const tr=await post('translation',{task:taskId,section:'para:1',start,end:start+10,text:'self-doubt'},502);assert.match(tr.error,/AI/);

 identify(teacher);
 const tp=(await post('reading',{op:'comment',task:taskId,key:'0-0',text:'Nice sentence!'})).progress;assert.equal(tp.comments['0-0'],'Nice sentence!');
 assert.equal((await (await get('reading','?task='+taskId)).json()).progress.answers['0-0'],'I value my family.');
 await post('cards',{op:'generate',task:taskId},403);

 // 完成精读：作业记为完成，生成学习卡片（重点词、句、收藏、仿写和老师点评）。
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 const done=await post('reading',{op:'finish',task:taskId});assert.ok(done.progress.finished);assert.ok(done.card);
 const state=await (await r.course.GET()).json();assert.equal(state.submissions.find(x=>x.task===taskId).state,'reviewed');
 let cards=(await (await get('cards')).json()).cards;assert.equal(cards.length,1);
 const items=cards[0].data.items,count=t=>items.filter(i=>i.type===t).length;
 assert.equal(count('word'),28);assert.equal(count('sentence'),8);assert.deepEqual(items.filter(i=>i.type==='practice').map(i=>[i.text,i.note]),[['I value my family.','Nice sentence!']]);
 assert.equal((await post('reading',{op:'finish',task:taskId})).card,done.card);
 const edited={...cards[0].data,title:'我的第一张卡片',theme:'forest',items:[...items.slice(0,2),{id:'n1',type:'note',text:'记住 live up to',meaning:'',note:''}]};
 cards=(await post('cards',{op:'save',id:done.card,data:edited})).cards;assert.equal(cards[0].data.title,'我的第一张卡片');assert.equal(cards[0].data.items.length,3);
 await post('cards',{op:'save',id:done.card,data:{...edited,theme:'neon'}},400);
 await post('cards',{op:'save',id:'missing',data:edited},404);
 const docx=await get('cards','?export=docx&id='+done.card);assert.match(docx.headers.get('content-type'),/wordprocessingml/);const bytes=new Uint8Array(await docx.arrayBuffer());assert.equal(String.fromCharCode(bytes[0],bytes[1]),'PK');
 const html=await (await get('print','?id='+done.card)).text();assert.match(html,/我的第一张卡片/);assert.match(html,/记住 live up to/);
 const again=(await post('cards',{op:'generate',task:taskId,replace:true})).card;assert.equal(again.id,done.card);assert.equal(again.data.title,s.title);
 identify(teacher);assert.equal((await (await get('cards')).json()).cards.length,1);
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 assert.deepEqual((await post('cards',{op:'delete',id:done.card})).cards,[]);
});
