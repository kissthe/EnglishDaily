import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('AI client: endpoint normalisation, parameter fallback, tolerant parsing and clear errors',async()=>{
 await mkdir('work',{recursive:true});const dir=await mkdtemp(path.resolve('work/test-'));
 await build({entryPoints:{client:'lib/ai-client.ts',retell:'lib/retell-ai.ts',config:'lib/ai-config.ts'},bundle:true,platform:'node',format:'esm',outdir:dir});
 const {aiJson,aiErrorText,chatEndpoint}=await import(pathToFileURL(path.join(dir,'client.js')));
 const {assessRetell}=await import(pathToFileURL(path.join(dir,'retell.js')));
 const {defaultAiConfig}=await import(pathToFileURL(path.join(dir,'config.js')));
 const settings={aiBaseUrl:'https://ai.test/v1/chat/completions/',aiModel:'m',aiApiKey:'sk-secret-123456',aiConfig:defaultAiConfig()};
 const realFetch=globalThis.fetch,calls=[];
 const reply=(status,body)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status});
 const ok=content=>reply(200,{choices:[{message:{content}}]});
 let handler;
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push({url:String(url),body});return handler(body)};
 try{
  assert.equal(chatEndpoint('https://api.x.com/v1/'),'https://api.x.com/v1/chat/completions');
  // 1. 地址里已经写了 /chat/completions，不重复拼接
  handler=()=>ok('{"ok":true}');
  assert.deepEqual(await aiJson(settings,'retell1',{},'x'),{ok:true});assert.equal(calls.at(-1).url,'https://ai.test/v1/chat/completions');
  // 2. 模型不支持 temperature / response_format：自动去掉后重试
  calls.length=0;handler=b=>'temperature' in b?reply(400,{error:{message:"Unsupported value: 'temperature' does not support 0.2 with this model."}}):'response_format' in b?reply(400,{error:{message:'response_format json_object is not supported'}}):ok('{"ok":true}');
  assert.deepEqual(await aiJson(settings,'retell1',{},'x'),{ok:true});assert.equal(calls.length,3);assert.ok(!('temperature' in calls[2].body)&&!('response_format' in calls[2].body));
  // 3. 推理模型的 <think> 和多余文字
  handler=()=>ok('<think>先分析一下……</think>\n好的，结果如下：\n```json\n{"ok":true}\n```\n希望有帮助');
  assert.deepEqual(await aiJson(settings,'retell1',{},'x'),{ok:true});
  // 4. 常见错误给出具体原因，且不泄露密钥
  handler=()=>reply(401,{error:{message:'Incorrect API key provided: sk-secret-123456.'}});
  let err=await aiJson(settings,'retell1',{},'x').catch(e=>e);assert.match(aiErrorText(err),/HTTP 401.*密钥/);assert.doesNotMatch(aiErrorText(err),/secret-123456/);
  handler=()=>reply(404,{error:{message:'The model `gpt-x` does not exist'}});
  err=await aiJson(settings,'retell1',{},'x').catch(e=>e);assert.match(aiErrorText(err),/找不到这个模型/);assert.match(aiErrorText(err),/gpt-x/);
  handler=()=>reply(404,'<html>Not Found</html>');
  err=await aiJson(settings,'retell1',{},'x').catch(e=>e);assert.match(aiErrorText(err),/\/v1/);
  handler=()=>reply(402,{error:{message:'Insufficient Balance'}});
  assert.match(aiErrorText(await aiJson(settings,'retell1',{},'x').catch(e=>e)),/余额/);
  handler=()=>{throw new TypeError('fetch failed')};
  assert.match(aiErrorText(await aiJson(settings,'retell1',{},'x').catch(e=>e)),/无法连接/);
  handler=()=>ok('这不是 JSON');
  assert.match(aiErrorText(await aiJson(settings,'retell1',{},'x').catch(e=>e)),/不是合法 JSON/);
  // 5. 评测结果有小偏差也能接受：超长字段截断，数字是字符串，状态写成中文
  const material={title:'T',body:'Text',questions:[],retellConfig:{version:2,mode:'exam',stage:3,slots:'# A\nTime: 8:00',opening:'Hi.',guidedKeywords:'',referenceRetell:'Ref'}};
  handler=()=>ok(JSON.stringify({score:'0',summary:'不错'.repeat(800),strengths:'开头正确',improvements:['a'.repeat(400),'b','c'],missingPoints:[],dimensions:{information:'80',organization:70,language:'75分',coherence:70},exam:{content:'4.5',language:3.2},checks:[{item:'人称转换',ok:'否',note:'x'.repeat(500)},{item:'使用给定开头',ok:'是',note:''}],points:[{label:'Time',status:'遗漏',studentEvidence:'',sourceEvidence:'8:00',advice:'y'.repeat(600)}]}));
  const a=await assessRetell(settings,material,'Hi. We will meet.','');
  assert.equal(a.score,75);assert.deepEqual(a.exam,{content:4.5,language:3});assert.equal(a.summary.length,1200);assert.deepEqual(a.strengths,['开头正确']);
  assert.equal(a.improvements.length,2);assert.equal(a.improvements[0].length,300);assert.equal(a.dimensions.language,75);
  assert.equal(a.points[0].status,'missing');assert.equal(a.points[0].advice.length,300);assert.equal(a.checks[0].ok,false);assert.equal(a.checks[1].ok,true);
 }finally{globalThis.fetch=realFetch}
});
