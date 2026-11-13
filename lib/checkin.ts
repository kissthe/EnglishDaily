import {offsetDate} from './course';
// 每日背单词打卡：学生用自己手机上的背单词 App 背诵，上传截图作为记录。
export type Checkin={id:string;day:string;app:string;words:number;minutes:number;note:string;images:string[];comment:string;seen:boolean;created:string;updated:string};
export const CHECKIN_MAX_IMAGES=3,CHECKIN_IMAGE_LIMIT=8*1024*1024;
// 连续打卡天数：从今天往前数；今天还没打卡时从昨天开始数，避免一早就显示中断。
export function checkinStreak(days:string[],today:string){const set=new Set(days);let d=set.has(today)?today:offsetDate(today,-1),n=0;while(set.has(d)){n++;d=offsetDate(d,-1)}return n}
export const checkinImageUrl=(key:string)=>'/api/checkin?image='+key;
