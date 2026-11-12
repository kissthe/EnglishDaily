import {readFile} from 'node:fs/promises';
import path from 'node:path';
import bank from '../data-content/retell-bank.json';
import {bucket,db} from './storage';
import type {Material,RetellConfig,Settings} from './course';
import {retellQuestion} from './retell';

// 北京中考听后转述题库（据考生回忆要点改编，非官方原题）。按版本号只导入一次，老师删除或修改后不会被覆盖。
export const RETELL_BANK_VERSION=1;
type BankItem=(typeof bank)[number];


export function bankMaterial(item:BankItem):Material{
 const retellConfig:RetellConfig={version:2,stage:3,slots:item.slots,opening:item.opening,guidedKeywords:'',referenceRetell:item.referenceRetell,practiceMode:'learning',revisionPolicy:'missing',responseMode:'text'};
 return {id:item.id,title:item.title,subtitle:item.subtitle,kind:'听力',level:'中考听说 · 听后转述',minutes:12,body:item.body,source:'北京中考英语听说考试 · 据考生回忆要点改编（非官方原题）',sourceUrl:'',rights:'改编练习材料；音频为语音合成（公有领域音色）。发布前请老师试听并核对内容。',audio:'/api/audio?key='+item.audioKey,reviewed:false,questions:[retellQuestion(retellConfig)],retellConfig,playLimit:0,allowSeek:true,allowSpeed:true,completionOnly:false};
}

export async function importRetellBank(settings:Settings){
 if((settings.retellBankVersion||0)>=RETELL_BANK_VERSION)return;
 const now=new Date().toISOString(),statements=[];
 for(const item of bank){
  try{if(!await bucket().head(item.audioKey))await bucket().put(item.audioKey,await readFile(path.resolve('data-content/retell-audio',item.audioKey+'.mp3')),{httpMetadata:{contentType:'audio/mpeg'}})}catch{/* 音频缺失时材料仍导入，老师可自行上传 */}
  statements.push(db().prepare('INSERT INTO materials (id,data,created) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(item.id,JSON.stringify(bankMaterial(item)),now));
 }
 const row=await db().prepare('SELECT data FROM settings WHERE id=1').first();
 statements.push(db().prepare('UPDATE settings SET data=? WHERE id=1').bind(JSON.stringify({...JSON.parse(row.data),retellBankVersion:RETELL_BANK_VERSION})));
 await db().batch(statements);
 settings.retellBankVersion=RETELL_BANK_VERSION;
}
