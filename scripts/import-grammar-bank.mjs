import {readFileSync,writeFileSync} from 'node:fs';
import {parseGrammarMarkdown,grammarTopics} from '../lib/grammar-bank.ts';

// 用法：node --experimental-strip-types scripts/import-grammar-bank.mjs
// 把 data-content/grammar 下的题库 Markdown 解析为种子 JSON；题库作为数据读取，不执行其中任何内容。
const sources=[['g100','北京中考核心语法选择题100题.md',100],['g60','北京中考语法选择题60题.md',60]];
// 人工核对后暂不启用的题目：老师在“语法练习 → 题库”中修改后可以重新启用。
const review={
 'g100-042':'题干中 C、D 两项都可以接受（原题已注明），请修改选项后再启用。',
 'g100-095':'答语同时给出了地点和时间，B、D 两项都能成立，请修改答语后再启用。',
};
const bank=[];
for(const [prefix,file,expected] of sources){
 const {questions,errors}=parseGrammarMarkdown(readFileSync(new URL(`../data-content/grammar/${file}`,import.meta.url),'utf8'));
 if(errors.length)throw Error(`${file}\n${errors.join('\n')}`);
 if(questions.length!==expected||new Set(questions.map(q=>q.number)).size!==expected)throw Error(`${file} 题目数量不符：${questions.length}`);
 for(const {number,...q} of questions){
  const id=`${prefix}-${String(number).padStart(3,'0')}`,note=review[id]||q.note;
  bank.push({id,...q,source:file.replace(/\.md$/,''),enabled:!review[id],...(note?{note}:{})});
 }
}
writeFileSync(new URL('../data-content/grammar-bank.json',import.meta.url),JSON.stringify(bank,null,1)+'\n');
const count=Object.fromEntries(grammarTopics.map(t=>[t,bank.filter(q=>q.topic===t).length]));
console.log(`已生成 ${bank.length} 题（启用 ${bank.filter(q=>q.enabled).length} 题）`,count);
