// 学生首页“学习数据”接口的返回结构。
export type StudentOverview={
 today:string;
 tasks:{week:number;weekDone:number;pending:number;corrections:number;total:number};
 scores:{title:string;kind:string;percent:number;day:string}[];
 average:number|null;
 grammar:{answered:number;correct:number;todayDone:number};
 vocabulary:{learned:number;todayDone:number};
 wordbook:{words:number;sentences:number};
 checkin:{streak:number;todayDone:boolean;monthDays:number;total:number};
 activity:{day:string;task:boolean;grammar:boolean;vocabulary:boolean;checkin:boolean}[];
};
