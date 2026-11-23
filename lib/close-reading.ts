import {z} from 'zod';

// 精读：老师带着学生逐段读。每段配重点单词、有语法学习价值的重点句和仿写练习。
export const crWordSchema=z.object({word:z.string().trim().min(1,'请填写单词').max(80),phonetic:z.string().trim().max(80).default(''),meaning:z.string().trim().max(300).default(''),usage:z.string().trim().max(600).default('')});
export const crSentenceSchema=z.object({text:z.string().trim().min(1,'请填写重点句').max(1000),grammar:z.string().trim().max(1500).default(''),translation:z.string().trim().max(1000).default('')});
export const crPracticeSchema=z.object({type:z.enum(['word','sentence']),target:z.string().trim().max(120).default(''),prompt:z.string().trim().min(1,'请填写仿写要求').max(600),example:z.string().trim().max(600).default('')});
export const crParagraphSchema=z.object({text:z.string().trim().min(1).max(4000),words:z.array(crWordSchema).max(20).default([]),sentences:z.array(crSentenceSchema).max(8).default([]),practice:z.array(crPracticeSchema).max(6).default([])});
export const closeReadingSchema=z.object({paragraphs:z.array(crParagraphSchema).min(1).max(30)});
export type CRWord=z.infer<typeof crWordSchema>;
export type CRSentence=z.infer<typeof crSentenceSchema>;
export type CRPractice=z.infer<typeof crPracticeSchema>;
export type CRParagraph=z.infer<typeof crParagraphSchema>;
export type CloseReading=z.infer<typeof closeReadingSchema>;

// 段落之间空一行；单个换行视为同一段内的换行。
export function splitParagraphs(text:string){return text.replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean)}
export const articleText=(cr:CloseReading)=>cr.paragraphs.map(p=>p.text).join('\n\n');

// 重点词：第一次出现的位置（整词、忽略大小写，允许 -s/-ed/-ing/-ting 等词尾变化）。
export function findWord(text:string,word:string){
 const w=word.trim();if(!w)return null;
 const esc=w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
 const m=new RegExp(`(^|[^A-Za-z])(${esc}[A-Za-z]{0,4})(?![A-Za-z])`,'i').exec(text);
 return m?{start:m.index+m[1].length,end:m.index+m[1].length+m[2].length}:null;
}
export function findSentence(text:string,sentence:string){const i=text.indexOf(sentence.trim());return i<0?null:{start:i,end:i+sentence.trim().length}}

// 发布前检查：重点句必须是本段原文中的一句，才能在原文里标出来。
export function closeReadingIssues(cr:CloseReading){
 const issues:string[]=[];
 cr.paragraphs.forEach((p,i)=>{
  p.sentences.forEach((s,j)=>{if(!findSentence(p.text,s.text))issues.push(`第 ${i+1} 段的重点句 ${j+1} 不是本段原文，请从原文复制`)});
  p.words.forEach(w=>{if(!findWord(p.text,w.word))issues.push(`第 ${i+1} 段找不到单词“${w.word}”`)});
 });
 return issues;
}

export type CRProgress={paragraph:number;answers:Record<string,string>;comments:Record<string,string>;finished:string|null;updated?:string};
export const practiceKey=(p:number,i:number)=>`${p}-${i}`;

// ---------- 学习卡片 ----------
export const cardThemes=['violet','ocean','forest','sunset','rose','slate'] as const;
export const cardItemSchema=z.object({id:z.string().min(1).max(40),type:z.enum(['word','sentence','practice','note']),text:z.string().trim().min(1,'卡片内容不能为空').max(1500),meaning:z.string().trim().max(1500).default(''),note:z.string().trim().max(2000).default('')});
export const cardDataSchema=z.object({title:z.string().trim().min(1,'请填写卡片标题').max(120),subtitle:z.string().trim().max(200).default(''),theme:z.enum(cardThemes).default('violet'),items:z.array(cardItemSchema).max(120)});
export type CardItem=z.infer<typeof cardItemSchema>;
export type CardData=z.infer<typeof cardDataSchema>;
export type StudyCard={id:string;task:string;data:CardData;created:string;updated:string};
export const cardTypeLabels={word:'单词',sentence:'句子',practice:'我的仿写',note:'笔记'} as const;

// 默认卡片：老师给的重点词和重点句，加上学生自己收藏的单词/句子（带批注）和写过的仿写。
export function buildCard(title:string,source:string,cr:CloseReading,progress:CRProgress|null,annotations:{kind:string;text:string;note:string}[],newId:()=>string):CardData{
 const items:CardItem[]=[],seen=new Set<string>(),key=(t:string)=>t.trim().toLowerCase();
 const add=(i:Omit<CardItem,'id'>)=>{const k=i.type+':'+key(i.text);if(seen.has(k))return;seen.add(k);items.push({...i,id:newId()})};
 for(const p of cr.paragraphs)for(const w of p.words)add({type:'word',text:w.word,meaning:[w.phonetic,w.meaning].filter(Boolean).join('  '),note:w.usage});
 for(const a of annotations)if(a.kind==='word')add({type:'word',text:a.text,meaning:a.note,note:''});
 for(const p of cr.paragraphs)for(const s of p.sentences)add({type:'sentence',text:s.text,meaning:s.translation,note:s.grammar});
 for(const a of annotations)if(a.kind==='sentence')add({type:'sentence',text:a.text,meaning:a.note,note:''});
 cr.paragraphs.forEach((p,i)=>p.practice.forEach((q,j)=>{const answer=progress?.answers[practiceKey(i,j)]?.trim();if(answer)add({type:'practice',text:answer,meaning:[q.target,q.prompt].filter(Boolean).join('：'),note:progress?.comments[practiceKey(i,j)]||''})}));
 return {title,subtitle:source,theme:'violet',items:items.slice(0,120)};
}
