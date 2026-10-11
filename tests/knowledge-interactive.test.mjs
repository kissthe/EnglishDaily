import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('interactive knowledge pages: sandbox document, page media access, single-topic loading and activities',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/knowledge-'));process.env.DATA_DIR=path.join(dir,'data');process.env.PUBLIC_ORIGIN='https://school.test';
 execFileSync(process.execPath,['scripts/init-teacher.mjs'],{env:{...process.env,TEACHER_USERNAME:'teacher',TEACHER_PASSWORD:'teacher-long-password'},stdio:'pipe'});
 globalThis.__headers=new Headers();
 await build({entryPoints:{auth:'app/api/auth/route.ts',course:'app/api/course/route.ts',media:'app/api/media/route.ts',culture:'app/api/culture/route.ts',knowledge:'app/api/knowledge/route.ts',html:'lib/interactive-html.ts'},bundle:true,platform:'node',format:'esm',outdir:dir,plugins:[{name:'headers',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function headers(){return globalThis.__headers}'}))}}]});
 const routes={};for(const name of ['auth','course','media','culture','knowledge','html'])routes[name]=await import(pathToFileURL(path.join(dir,name+'.js')));
 const identify=(cookie='')=>{globalThis.__headers=new Headers({cookie,'x-real-ip':'192.0.2.9'})};
 async function post(route,body,status=200){const r=await routes[route].POST(new Request('https://school.test/api/'+route,{method:'POST',headers:{origin:'https://school.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));if(r.headers.has('set-cookie'))identify(r.headers.get('set-cookie').split(';')[0]);return d}
 async function upload(type,bytes,status=200){const form=new FormData();form.append('file',new File([bytes],'upload',{type}));const r=await routes.media.POST(new Request('https://school.test/api/media',{method:'POST',headers:{origin:'https://school.test'},body:form}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
 const media=url=>routes.media.GET(new Request('https://school.test'+url)).then(r=>r.status);
 const topic=async(id,status=200)=>{const r=await routes.knowledge.GET(new Request('https://school.test/api/knowledge?id='+id));assert.equal(r.status,status);return r.json()};

 // 文档构建：平台头部必须位于教师内容之前，CSP 禁止联网。
 const {buildInteractiveDocument,inspectInteractiveHtml,INTERACTIVE_CSP}=routes.html;
 assert.match(INTERACTIVE_CSP,/connect-src 'none'/);assert.match(INTERACTIVE_CSP,/default-src 'none'/);
 for(const page of ['<!doctype html><html lang="en"><head><title>T</title></head><body><script>go()</script></body></html>','<html><body><p>Hi</p></body></html>','<p>Fragment</p><script>x()</script>']){
  const doc=buildInteractiveDocument(page,'dark'),csp=doc.indexOf('Content-Security-Policy'),bridge=doc.indexOf('window.EnglishDaily='),first=Math.min(...['<title>','<p>','<script>go','<script>x'].map(t=>doc.indexOf(t)).filter(i=>i>=0));
  assert.ok(doc.startsWith('<!doctype html>'));assert.equal(doc.match(/<!doctype/gi).length,1);assert.ok(csp>0&&csp<bridge&&bridge<first,page);assert.match(doc,/var api=\{theme:"dark"/);
 }
 const notes=inspectInteractiveHtml('<script src="https://cdn.test/x.js"></script><link rel="stylesheet" href="https://fonts.googleapis.com/x"><img data-media="missing"><script>fetch("/api")</script><div style="height:100vh"></div>',[]);
 for(const pattern of [/外部脚本/,/外部样式/,/联网/,/找不到页面媒体“missing”/,/100vh/,/夜间样式/])assert.ok(notes.some(n=>pattern.test(n)),String(pattern));
 assert.deepEqual(inspectInteractiveHtml('<style>html.dark{color:#fff}</style><img data-media="photo">',[{name:'photo',url:'/api/media?key=x',type:'image'}]),[]);
 // B 站视频：解析 BV 号、分 P 与开始时间，只生成官方播放器地址。
 const {parseBilibili,bilibiliPlayerUrl}=routes.html;
 assert.deepEqual(parseBilibili('BV1GJ411x7h7'),{bvid:'BV1GJ411x7h7',p:1,t:0});
 assert.deepEqual(parseBilibili('https://www.bilibili.com/video/BV1GJ411x7h7/?p=3&t=42.5&spm_id_from=x'),{bvid:'BV1GJ411x7h7',p:3,t:42});
 assert.deepEqual(parseBilibili('BV1GJ411x7h7','2','90'),{bvid:'BV1GJ411x7h7',p:2,t:90});
 for(const bad of ['','b23.tv/abc','https://evil.test/?x=BV1GJ411x7h7extra','BV123','javascript:alert(1)'])assert.equal(parseBilibili(bad),null,bad);
 const player=new URL(bilibiliPlayerUrl(parseBilibili('BV1GJ411x7h7','2','30')));
 assert.equal(player.origin,'https://player.bilibili.com');assert.equal(player.searchParams.get('bvid'),'BV1GJ411x7h7');assert.equal(player.searchParams.get('autoplay'),'0');assert.equal(player.searchParams.get('t'),'30');
 const videoNotes=inspectInteractiveHtml('<style>.dark{}</style><div data-bilibili="b23.tv/xyz"></div><div data-bilibili="hello"></div><div data-bilibili="BV1GJ411x7h7"></div><iframe src="https://player.bilibili.com/x"></iframe>');
 assert.equal(videoNotes.length,3);assert.ok(videoNotes.some(n=>/短链接/.test(n)));assert.ok(videoNotes.some(n=>/无法识别的 B 站视频“hello”/.test(n)));assert.ok(videoNotes.some(n=>/data-bilibili/.test(n)));
 assert.match(buildInteractiveDocument('<p>x</p>'),/\[data-bilibili\]\{display:block/);
 // 沙箱回归保护：互动 iframe 只允许脚本，不能获得本站身份。
 const [iframe,embed]=(await readFile('app/interactive-html.tsx','utf8')).match(/<iframe[\s\S]*?\/>/g);assert.match(iframe,/sandbox="allow-scripts"/);assert.doesNotMatch(iframe,/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
 // B 站播放器在自己的源中运行，可以有存储，但不能导航本站或打开弹窗。
 assert.match(embed,/src=\{e\.url\}/);assert.match(embed,/sandbox="allow-scripts allow-same-origin allow-presentation"/);assert.doesNotMatch(embed,/allow-top-navigation|allow-popups|allow-forms/);

 await post('auth',{op:'login',username:'teacher',password:'teacher-long-password'});const teacher=globalThis.__headers.get('cookie');
 await post('auth',{op:'saveStudent',username:'student',password:'student-long-password',teacherPassword:'teacher-long-password'});
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const photo=await upload('image/png',png),song=await upload('audio/mpeg','ID3-audio'),draftOnly=await upload('image/png',png),unused=await upload('image/png',png);
 await upload('audio/mpeg',new Uint8Array(21*1024*1024),400);
 const base={subtitle:'',level:'A2',minutes:20,source:'老师自编',sourceUrl:'',rights:'原创',audio:'',reviewed:true,questions:[],completionOnly:true,contentFormat:'html',kind:'知识拓展'};
 const bigPage='<html><head><style>html.dark{color:#fff}</style></head><body><script>EnglishDaily.done("map")</script>'+'<p>California is a state.</p>'.repeat(20000)+'</body></html>';
 assert.ok(bigPage.length>120000&&bigPage.length<1000000);
 await post('course',{op:'material',material:{...base,id:'ca',title:'California',category:'城市与地理',interactive:true,body:bigPage,assets:[{name:'la-skyline',url:photo.url,type:'image',caption:''},{name:'song-clip',url:song.url,type:'audio',caption:''}]}});
 await post('course',{op:'material',material:{...base,id:'draft',title:'Draft',reviewed:false,interactive:true,body:'<p>Draft</p>',assets:[{name:'secret',url:draftOnly.url,type:'image',caption:''}]}});
 await post('course',{op:'material',material:{...base,id:'dup',title:'Dup',interactive:true,body:'<p>x</p>',assets:[{name:'a',url:photo.url,type:'image'},{name:'a',url:song.url,type:'audio'}]}},400);
 await post('course',{op:'material',material:{...base,id:'bad-name',title:'Bad',interactive:true,body:'<p>x</p>',assets:[{name:'LA Skyline',url:photo.url,type:'image'}]}},400);
 await post('course',{op:'material',material:{...base,id:'reading',title:'Reading',kind:'阅读',completionOnly:false,contentFormat:'text',body:'x'.repeat(120001),questions:[{id:'q1',type:'choice',prompt:'?',options:['a','b'],answer:'a',explanation:'',tag:'细节理解'}]}},400);
 await post('course',{op:'material',material:{...base,id:'essay',title:'Essay',kind:'语法',contentFormat:'text',interactive:true,body:'x'}},400);
 assert.equal((await topic('draft')).material.title,'Draft');

 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 const list=(await (await routes.course.GET()).json()).materials;
 assert.deepEqual(list.map(m=>[m.id,m.body,m.interactive,m.category]),[['ca','',true,'城市与地理']]);
 const ca=(await topic('ca')).material;assert.equal(ca.body,bigPage);assert.equal(ca.assets.length,2);
 await topic('draft',404);await topic('missing',404);
 assert.equal(await media(photo.url),200);assert.equal(await media(song.url),200);
 assert.equal(await media(draftOnly.url),403);assert.equal(await media(unused.url),403);
 await upload('image/png',png,403);

 // 互动活动：普通互动页面也能记录，名称去重，最多 50 项。
 await post('culture',{material:'ca'},400);
 await post('culture',{material:'ca',activity:'map'});await post('culture',{material:'ca',activity:'map'});
 let progress=(await post('culture',{material:'ca',activity:'quiz'})).progress;
 assert.deepEqual(progress.activities,['map','quiz']);assert.equal(progress.status,'学习中');
 for(let i=0;i<60;i++)progress=(await post('culture',{material:'ca',activity:'step-'+i})).progress;
 assert.equal(progress.activities.length,50);
 await post('culture',{material:'draft',activity:'map'},404);
 await post('culture',{material:'ca',activity:'x'.repeat(61)},400);

 // Culture Lab 主题：活动与检测、表达进度互不覆盖。
 identify(teacher);
 const cfg={category:'流行文化',tagline:'Awards',explore:'Explore',fastFacts:'',vocabulary:'',cultureNotes:'Note\nText',expressPrompt:'Write.',checkQuestions:[1,2,3].map(i=>({id:'c'+i,prompt:'Q'+i,options:['Yes','No'],answer:'Yes'}))};
 await post('course',{op:'material',material:{...base,id:'oscars',title:'The Oscars',interactive:true,body:'<p>Oscars</p>',cultureConfig:cfg}});
 identify();await post('auth',{op:'login',username:'student',password:'student-long-password'});
 await post('culture',{material:'oscars',activity:'pick-winner'});
 await post('culture',{material:'oscars',step:'check',answers:{c1:'Yes',c2:'Yes',c3:'Yes'}});
 progress=(await post('culture',{material:'oscars',step:'express',expression:'I like the Oscars.'})).progress;
 assert.equal(progress.status,'已完成');assert.deepEqual(progress.activities,['pick-winner']);
 assert.equal((await topic('oscars')).material.cultureConfig.checkQuestions[0].answer,undefined);
});
