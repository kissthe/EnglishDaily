// 单词本：作业划线收藏与 HTML 页面中收藏的单词、句子。
export type WordbookKind='word'|'sentence';
export type WordbookSource='task'|'knowledge'|'library';
export type WordbookEntry={id:string;kind:WordbookKind;text:string;note:string;context:string;sourceKind:WordbookSource;sourceId:string;sourceTitle:string;mastered:boolean;fromAnnotation:boolean;created:string;updated:string};
export type ExportOptions={kind:'all'|WordbookKind;mode:'full'|'quiz';includeMastered:boolean};

export function normalizeEntry(text:string){return text.trim().replace(/\s+/g,' ').toLowerCase()}
export function guessKind(text:string):WordbookKind{return text.trim().split(/\s+/).length>3||/[.!?。！？]\s*$/.test(text.trim())?'sentence':'word'}

// 取出选中内容所在的句子，作为单词的例句。
export function sentenceAround(text:string,start:number,end:number){
 const before=text.slice(0,start),after=text.slice(end);
 const from=Math.max(before.search(/[^.!?。！？\n]*$/),0),stop=after.search(/[.!?。！？\n]/);
 const sentence=(before.slice(from)+text.slice(start,end)+(stop<0?after:after.slice(0,stop+1))).replace(/\s+/g,' ').trim();
 return sentence.length>400?sentence.slice(0,400)+'…':sentence;
}

export function filterWordbook(rows:WordbookEntry[],o:{kind:'all'|WordbookKind;query?:string;includeMastered?:boolean;source?:string}){
 const term=(o.query||'').trim().toLowerCase();
 return rows.filter(r=>(o.kind==='all'||r.kind===o.kind)&&(o.includeMastered!==false||!r.mastered)&&(!o.source||o.source==='all'||r.sourceKind===o.source)&&(!term||[r.text,r.note,r.context,r.sourceTitle].join(' ').toLowerCase().includes(term)));
}
export const sourceLabels:Record<WordbookSource,string>={task:'作业',knowledge:'知识拓展',library:'资料库'};
export function sourceHref(e:Pick<WordbookEntry,'sourceKind'|'sourceId'>){return e.sourceKind==='task'?'/practice/'+encodeURIComponent(e.sourceId):e.sourceKind==='knowledge'?'/knowledge/'+encodeURIComponent(e.sourceId):'/?view=library'}
