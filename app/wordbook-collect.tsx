'use client';
// 在知识拓展、资料库等 HTML 页面中选中文字后，底部出现“收藏到单词本”工具条。
import {createContext,useContext,useState,type ReactNode} from 'react';
import {BookmarkPlus,X} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {guessKind,sentenceAround,type WordbookKind} from '@/lib/wordbook';

type Picked={text:string;context:string};
const CollectContext=createContext<((p:Picked|null)=>void)|null>(null);
export function useWordbookCollect(){return useContext(CollectContext)}

// 从 iframe 文档的当前选区取出文字和所在句子。
export function pickFromSelection(doc:Document):Picked|null{
 const sel=doc.getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount)return null;
 const text=sel.toString().replace(/\s+/g,' ').trim();if(!text||text.length>1000)return null;
 const range=sel.getRangeAt(0);let node:Node|null=range.commonAncestorContainer;
 while(node&&node.nodeType!==1)node=node.parentNode;
 const block=(node as Element|null)?.closest?.('p,li,td,th,h1,h2,h3,h4,blockquote,figcaption,div')||null;
 const whole=(block?.textContent||'').replace(/\s+/g,' '),i=whole.indexOf(text);
 return {text,context:i>=0?sentenceAround(whole,i,i+text.length):''};
}

export function WordbookCollector({source,enabled,children}:{source:{kind:'knowledge'|'library';id:string};enabled:boolean;children:ReactNode}){
 const [picked,setPicked]=useState<Picked|null>(null),[dialog,setDialog]=useState<WordbookKind|null>(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function open(kind:WordbookKind){setDialog(kind);setNote('');setError('')}
 async function save(){if(!picked||!dialog)return;setBusy(true);setError('');try{const r=await fetch('/api/wordbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'add',kind:dialog,text:picked.text,note,context:dialog==='word'?picked.context:'',sourceKind:source.kind,sourceId:source.id})});const d=await r.json();if(!r.ok)throw Error(d.error||'暂时无法收藏');toast.success(dialog==='word'?'单词已加入单词本':'句子已加入单词本');setDialog(null);setPicked(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <CollectContext.Provider value={enabled?p=>{if(!dialog)setPicked(p)}:null}>{children}
  {enabled&&picked&&!dialog&&<div className="wordbook-collect-bar" role="region" aria-label="收藏到单词本"><span className="wordbook-collect-text">{picked.text}</span><div><button className={'btn'+(guessKind(picked.text)==='word'?'':' secondary')} onClick={()=>open('word')}><BookmarkPlus size={16}/>收藏单词</button><button className={'btn'+(guessKind(picked.text)==='sentence'?'':' secondary')} onClick={()=>open('sentence')}>收藏句子</button><button className="wordbook-collect-close" aria-label="取消选择" onClick={()=>setPicked(null)}><X size={18}/></button></div></div>}
  <Dialog open={!!dialog} onOpenChange={v=>{if(!v&&!busy)setDialog(null)}}><DialogContent className="medium-dialog"><DialogHeader><DialogTitle>{dialog==='word'?'收藏单词':'收藏句子'}</DialogTitle><DialogDescription>加入单词本，之后可以自测、导出 Word 打印。</DialogDescription></DialogHeader>
   <blockquote className="annotation-quote">{picked?.text}</blockquote>
   {dialog==='word'&&picked?.context&&<p className="helper">原句：{picked.context}</p>}
   <label>{dialog==='word'?'释义 / 用法（可选）':'理解 / 翻译（可选）'}<textarea rows={4} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder={dialog==='word'?'例如：n. 展览；an art exhibition':'例如：句子结构、中文意思、可以仿写的句型'}/></label>
   {error&&<p role="alert" className="error-text">{error}</p>}
   <div className="dialog-actions"><button className="btn secondary" disabled={busy} onClick={()=>setDialog(dialog==='word'?'sentence':'word')}>改为{dialog==='word'?'句子':'单词'}</button><button className="btn" disabled={busy} onClick={save}>{busy?'正在保存…':'加入单词本'}</button></div>
  </DialogContent></Dialog>
 </CollectContext.Provider>;
}
