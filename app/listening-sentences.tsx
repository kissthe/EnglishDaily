'use client';
import {useEffect,useState} from 'react';
import {Checkbox} from '@/components/ui/checkbox';
import {Button} from './daily-app';
import type {Question} from '@/lib/course';
import {toast} from 'sonner';

export function ListeningSentences({transcript,onGenerate,existing}:{transcript:string;onGenerate:(questions:Question[])=>void;existing:number}){
 const [lines,setLines]=useState(''),[selected,setSelected]=useState<number[]>([]);
 useEffect(()=>{setLines(transcript.trim().split(/\n+/).flatMap(p=>p.match(/[^.!?]+(?:[.!?]+["”’']*|$)/g)||[]).map(s=>s.trim()).filter(Boolean).join('\n'));setSelected([])},[transcript]);
 const sentences=lines.split('\n').map(s=>s.trim()).filter(Boolean);
 function generate(){if(!selected.length||selected.length>30){toast.error('请选择 1–30 句，建议每次 2–4 句');return}const questions=sentences.flatMap((answer,i)=>selected.includes(i)?[{id:crypto.randomUUID(),type:'fill' as const,prompt:`请听写音频中的第 ${i+1} 句。`,options:[],answer,explanation:'',tag:'重点句听写',strict:true,caseSensitive:false,punctuationSensitive:false}]:[]);if(questions.some(q=>q.answer.length>2000)){toast.error('单句最多 2000 字符，请检查分句');return}onGenerate(questions);toast.success('重点句已生成，参考答案已自动填入')}
 return <section className="import-box"><h3>从文字稿选择重点句</h3><p className="helper">先播放音频核对分句，再勾选。每行一句；缩写、引号或对话可能需要手动合并。题干只显示句子序号，不显示原句，可补充时间位置或中文提示。</p><label>核对分句（每行一句）<textarea rows={6} maxLength={120000} value={lines} onChange={e=>{setLines(e.target.value);setSelected([])}}/></label><div className="listening-sentence-list">{sentences.map((s,i)=><label className="listening-sentence" key={i}><Checkbox checked={selected.includes(i)} onCheckedChange={v=>setSelected(a=>v?[...a,i]:a.filter(n=>n!==i))}/><span><b>第 {i+1} 句</b> {s}</span></label>)}</div><p className="helper">已选 {selected.length} 句。生成后自动逐词核对，默认忽略大小写和标点，可在题目中调整。原文与答案按审核页设置的时间开放。</p><Button disabled={!selected.length||selected.length>30} onClick={generate}>{existing?'用所选句子替换当前题目':'生成重点句听写'}</Button></section>
}
