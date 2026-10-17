import type {Material} from './course';
// 每日推荐：优先没打开过的主题，其次学习中的，最后已完成的；同组内按“日期 + 主题”哈希排序，一天内固定、每天轮换。
export type DailyStatus='未开始'|'学习中'|'已完成';
export type DailyPick={id:string;title:string;tagline:string;category:string;level:string;minutes:number;interactive:boolean;lab:boolean;cover:string;status:DailyStatus;activities:number};
const hash=(s:string)=>{let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
export function pickDaily(materials:Material[],progress:Map<string,{status:string;activities?:string[]}>,day:string):DailyPick|null{
 const rank=(m:Material)=>{const s=progress.get(m.id)?.status;return !s||s==='未开始'?0:s==='已完成'?2:1};
 const m=[...materials].sort((a,b)=>rank(a)-rank(b)||hash(day+a.id)-hash(day+b.id))[0];
 if(!m)return null;const p=progress.get(m.id);
 return {id:m.id,title:m.title,tagline:m.cultureConfig?.tagline||m.subtitle||'',category:m.cultureConfig?.category||m.category||'主题阅读',level:m.level,minutes:m.minutes,interactive:!!m.interactive,lab:!!m.cultureConfig,cover:m.assets?.find(a=>a.type==='image')?.url||'',status:(p?.status==='已完成'?'已完成':p&&p.status!=='未开始'?'学习中':'未开始'),activities:p?.activities?.length||0};
}
