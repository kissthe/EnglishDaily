'use client';
import {useState} from 'react';
import {Sparkles,Copy} from 'lucide-react';
import type {Question} from '@/lib/course';
import {resolveAiConfig} from '@/lib/ai-config';
import {questionTemplate,solutionTemplate} from '@/lib/material-import';
async function call(body:unknown){const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);return d}
export function AiQuestionGenerator({title,body,onResult}:{title:string;body:string;onResult:(questions:Question[])=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="ai-assist-box"><div><h3><Sparkles size={18}/> AI 辅助出题</h3><p>根据当前正文生成草稿，核对后再替换题目。使用 AI 配置中心的“阅读 · 辅助出题”。</p></div><div className="practice-buttons"><button className="btn" type="button" disabled={busy||!body.trim()} onClick={async()=>{setBusy(true);setMessage('');try{onResult((await call({op:'questions',title,body})).questions);setMessage('草稿已生成，请检查下方题目、答案和解析。')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}><Sparkles size={16}/>{busy?'正在生成…':'生成题目草稿'}</button><button className="btn secondary" type="button" disabled={busy} onClick={async()=>{try{const r=await fetch('/api/course',{cache:'no-store'});if(!r.ok)throw Error('无法读取 AI 配置');const d=await r.json(),cfg=resolveAiConfig(d.settings.aiConfig);await navigator.clipboard.writeText([cfg.generalPrompt,cfg.scenarios.questions.prompt,'输出以下两个独立 JSON 区块：',questionTemplate,solutionTemplate,'文章：',body||'[在此粘贴文章]'].join('\n\n'));setMessage('已复制当前配置的出题提示词。')}catch(e){setMessage((e as Error).message)}}}><Copy size={16}/>复制当前提示词</button></div>{message&&<p role="status">{message}</p>}</section>;
}
export function AiWritingAssistant({submission,disabled,onApply}:{submission:string;disabled:boolean;onApply:(v:{feedback:string;grades:Record<string,number>;requestRevision:boolean})=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{feedback:string;grades:Record<string,number>;requestRevision:boolean}|null>(null);
 return <section className="ai-assist-box"><h3><Sparkles size={18}/> AI 辅助批改</h3><p>先生成建议，再由你决定是否采用。不会自动发布给学生。</p><button type="button" className="btn secondary" disabled={busy||disabled} onClick={async()=>{setBusy(true);setError('');try{setResult(await call({op:'writing',submission}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'正在分析作文…':'生成批改建议'}</button>{error&&<p role="alert">{error}</p>}{result&&<div className="ai-draft"><b>建议分数：{Object.entries(result.grades).map(([id,score])=>`${id} · ${score} 分`).join(' / ')}</b><p className="retell-text">{result.feedback}</p><button type="button" className="btn" disabled={disabled} onClick={()=>{onApply(result);setResult(null)}}>采用建议，继续人工核对</button></div>}</section>;
}
