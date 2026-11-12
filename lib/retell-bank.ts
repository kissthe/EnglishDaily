import {readFile} from 'node:fs/promises';
import path from 'node:path';
import bank1 from '../data-content/retell-bank.json';
import bank2 from '../data-content/retell-bank-2.json';
import {bucket,db} from './storage';
import type {Material,RetellConfig,Settings} from './course';
import {retellQuestion} from './retell';

// 听后转述题库。按版本号分批导入，每批只导入一次；老师删除或修改后不会被覆盖。
type BankItem={id:string;title:string;subtitle:string;body:string;opening:string;slots:string;referenceRetell:string;audioKey?:string;imageKey?:string};
const batches:{version:number;items:BankItem[];source:string;rights:string}[]=[
 {version:1,items:bank1,source:'北京中考英语听说考试 · 据考生回忆要点改编（非官方原题）',rights:'改编练习材料；音频为语音合成（公有领域音色）。发布前请老师试听并核对内容。'},
 {version:2,items:bank2,source:'《北京市中考英语听说考试：听后转述专项训练指南与20道全真模拟题》（老师提供）',rights:'模拟练习材料，非官方原题。音频需老师上传后才能发布。'}
];
export const RETELL_BANK_VERSION=Math.max(...batches.map(b=>b.version));

export function bankMaterial(item:BankItem,batch=batches[0]):Material{
 const retellConfig:RetellConfig={version:2,stage:3,slots:item.slots,opening:item.opening,guidedKeywords:'',referenceRetell:item.referenceRetell,practiceMode:'learning',revisionPolicy:'missing',responseMode:'text'};
 return {id:item.id,title:item.title,subtitle:item.subtitle,kind:'听力',level:'中考听说 · 听后转述',minutes:12,body:item.body,source:batch.source,sourceUrl:'',rights:batch.rights,audio:item.audioKey?'/api/audio?key='+item.audioKey:'',reviewed:false,questions:[retellQuestion(retellConfig)],retellConfig,playLimit:0,allowSeek:true,allowSpeed:true,completionOnly:false,...(item.imageKey?{images:[{url:'/api/media?key='+item.imageKey,caption:'思维导图（考试屏幕样式）'}]}:{})};
}

async function store(key:string,file:string,contentType:string){try{if(!await bucket().head(key))await bucket().put(key,await readFile(path.resolve('data-content',file)),{httpMetadata:{contentType}})}catch{/* 文件缺失时材料仍导入，老师可自行上传 */}}

export async function importRetellBank(settings:Settings){
 const done=settings.retellBankVersion||0;if(done>=RETELL_BANK_VERSION)return;
 const now=new Date().toISOString(),statements=[];
 for(const batch of batches.filter(b=>b.version>done))for(const item of batch.items){
  if(item.audioKey)await store(item.audioKey,'retell-audio/'+item.audioKey+'.mp3','audio/mpeg');
  if(item.imageKey)await store(item.imageKey,'retell-images/'+item.imageKey+'.png','image/png');
  statements.push(db().prepare('INSERT INTO materials (id,data,created) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(item.id,JSON.stringify(bankMaterial(item,batch)),now));
 }
 const row=await db().prepare('SELECT data FROM settings WHERE id=1').first();
 statements.push(db().prepare('UPDATE settings SET data=? WHERE id=1').bind(JSON.stringify({...JSON.parse(row.data),retellBankVersion:RETELL_BANK_VERSION})));
 await db().batch(statements);
 settings.retellBankVersion=RETELL_BANK_VERSION;
}
