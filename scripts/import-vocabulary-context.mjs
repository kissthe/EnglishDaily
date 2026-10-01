import {readFileSync,writeFileSync} from 'node:fs';

// Treat the supplied Markdown as data: only parse word headings and metadata.
const source=process.argv[2];
if(!source)throw Error('请提供词表 Markdown 文件路径');
const seedPath=new URL('../data-content/beijing-cd-vocabulary.json',import.meta.url);
const words=JSON.parse(readFileSync(seedPath,'utf8'));
const entries=[...readFileSync(source,'utf8').matchAll(/^### \d+\. (.+)\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)];
const imported=new Map();
for(const [,name,body] of entries){
 const word=name.trim().toLowerCase();
 const sentences=[...body.matchAll(/^\d\. (.+)$/gm)].map(([,line])=>{
  const target=line.match(/\*\*(.+?)\*\*/)?.[1];
  const text=line.replaceAll('**','').trim();
  if(!target||!text.toLowerCase().includes(target.toLowerCase()))throw Error(`${word} 缺少目标词标记`);
  return {text,target};
 });
 if(sentences.length!==3||new Set(sentences.map(s=>s.text)).size!==3||imported.has(word))throw Error(`${word} 例句数量或去重检查失败`);
 imported.set(word,sentences);
}
if(imported.size!==424||words.length!==424)throw Error(`词条数量不符：${imported.size}`);
for(const w of words){
 const sentences=imported.get(w.word.toLowerCase());
 if(!sentences)throw Error(`缺少词条 ${w.word}`);
 w.contextSentences=sentences;
}
writeFileSync(seedPath,JSON.stringify(words,null,2)+'\n');
console.log(`已处理 ${imported.size} 个词，${imported.size*3} 个原始语境句；保留已核对练习。`);
