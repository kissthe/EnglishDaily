import type {Material,RetellStage} from './course';

export const retellTitles:Record<RetellStage,string>={1:'听懂并记要点',2:'看要点组织表达',3:'听后独立转述'};
export type RetellNote={text:string;status:'noted'|'unsure'|'missed'};
export function slotLabels(slots:string){return slots.split('\n').map(line=>line.split(/[:：]/)[0].trim()).filter(Boolean)}
export function readNotes(raw?:string):RetellNote[]{try{const value=JSON.parse(raw||'[]');return Array.isArray(value)?value.map(v=>({text:typeof v?.text==='string'?v.text:'',status:v?.status==='unsure'?'unsure':v?.status==='missed'?'missed':'noted'})):[]}catch{return []}}
export function notesText(labels:string[],notes:RetellNote[]){return labels.map((label,i)=>`${label}: ${notes[i]?.text||''}${notes[i]?.status==='missed'?' [没听到]':notes[i]?.status==='unsure'?' [不确定]':''}`).join('\n')}
export function cleanRetellAnswers(m:Material,a:Record<string,string>){
 const result=Object.fromEntries(m.questions.map(q=>[q.id,a[q.id]||'']));
 if(m.retellConfig&&a.retellNotes){const notes=readNotes(a.retellNotes).slice(0,slotLabels(m.retellConfig.slots).length);result.retellNotes=JSON.stringify(notes);if(m.retellConfig.stage===1)result.retell=notesText(slotLabels(m.retellConfig.slots),notes)}
 return result;
}
