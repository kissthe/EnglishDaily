import type {AiConfig} from './ai-config';
export type Question={id:string;type:'choice'|'fill'|'writing';prompt:string;options:string[];answer:string;explanation:string;tag:string;strict?:boolean;caseSensitive?:boolean;punctuationSensitive?:boolean;audioStart?:number;audioEnd?:number;maxScore?:number};
export type RetellStage=1|2|3;
export type RetellConfig={stage:RetellStage;slots:string;guidedKeywords:string;referenceRetell:string;practiceMode?:'learning'|'simulation';revisionPolicy?:'missing'|'teacher';responseMode?:'text'|'audio'};
export type CultureQuestion={id:string;prompt:string;options:string[];answer:string};
export type CultureConfig={category:'城市与地理'|'电影里的英语'|'歌曲与表达'|'小说与人物'|'人物故事'|'音乐影视'|'校园生活'|'节日文化'|'日常文化'|'地方与身份';tagline:string;explore:string;fastFacts:string;vocabulary:string;cultureNotes:string;checkQuestions:CultureQuestion[];expressPrompt:string};
export type RetellPoint={label:string;status:'correct'|'missing'|'incorrect';studentEvidence:string;sourceEvidence:string;advice:string};
export type AiAssessment={points?:RetellPoint[];score:number;summary:string;strengths:string[];improvements:string[];missingPoints:string[];dimensions:{information:number;organization:number;language:number;coherence:number}};
export type Material={id:string;title:string;subtitle:string;kind:'阅读'|'听力'|'知识拓展'|'写作'|'视频'|'语法';level:string;minutes:number;body:string;source:string;sourceUrl:string;rights:string;audio:string;reviewed:boolean;questions:Question[];images?:{url:string;caption:string}[];video?:string;contentFormat?:'text'|'html';grammarMode?:'choice'|'fill'|'passage';subtitles?:string;playLimit?:number;allowSeek?:boolean;allowSpeed?:boolean;explanationVisibility?:'submitted'|'reviewed';completionOnly?:boolean;retellConfig?:RetellConfig;cultureConfig?:CultureConfig};
export type Task={id:string;date:string;material:Material;note:string};
export type Submission={id:string;task:string;student:string;answers:Record<string,string>;state:string;score:number;total:number;feedback:string;feedback_updated?:string;feedback_read?:string;correction_status?:string;workflow?:string;unreadFeedback?:boolean;grades:Record<string,number>;corrections:Record<string,string>;submitted:string|null;updated:string;aiAssessment?:AiAssessment;assessmentState?:string;revisionAssessment?:AiAssessment;revisionAssessmentState?:string};
export type Settings={teacherMessage?:string;teacherMessageUpdated?:string;aiConfig?:AiConfig;studentEmail:string;studentName:string;studentId?:string;studentUsername?:string;textbook:string;region:string;minutes:number;aiBaseUrl?:string;aiModel?:string;aiConfigured?:boolean;aiApiKey?:string};
export type CourseData={role:'teacher'|'student';email:string;userId?:string;tagStats?:Record<string,{total:number;wrong:number}>;settings:Settings;materials:Material[];tasks:Task[];submissions:Submission[]};
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())}
export function offsetDate(d:string,n:number){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
export function normalize(v:string){return v.trim().toLowerCase().replace(/[.!?。！？，,]+$/g,'').replace(/\s+/g,' ')}
export function correct(q:Question,v:string){if(q.strict){const norm=(x:string)=>{x=x.trim().replace(/\s+/g,' ');if(!q.caseSensitive)x=x.toLowerCase();if(!q.punctuationSensitive)x=x.replace(/[\p{P}]/gu,'');return x};return (q.answer||'').split('|').some(a=>norm(a)===norm(v||''))}return (q.answer||'').split('|').some(a=>normalize(a)===normalize(v||''))}
export function objectiveScore(m:Material,a:Record<string,string>){const qs=m.questions.filter(q=>q.type!=='writing');return {score:qs.filter(q=>correct(q,a[q.id])).length,total:qs.length}}

export function normalizeMaterial(value:any):Material{const m={subtitle:'',level:'',minutes:0,body:'',source:'',sourceUrl:'',rights:'',audio:'',questions:[],...value};if(m.kind==='巩固复习')m.kind=m.questions.some((q:Question)=>q.type!=='writing')?'语法':'写作';if(m.kind==='歌曲'){m.kind='知识拓展';m.body=[m.body,m.lyrics].filter(Boolean).join('\n\n');m.contentFormat='text'}delete m.lyrics;m.questions=m.questions.map(({aiRetell,...q}:any)=>q);return m}
export type Annotation={id:string;student:string;task:string;section:string;start:number;end:number;text:string;kind:'highlight'|'word'|'sentence';note:string;created:string;updated:string;title?:string;date?:string;source?:string};

export function taskStatus(s?:Submission){return !s?'待完成':s.state==='draft'?'进行中':s.workflow|| (s.state==='reviewed'?'已完成':'待批改')}
