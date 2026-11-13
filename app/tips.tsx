'use client';
import {useEffect,useState} from 'react';
import {Lightbulb,Printer} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {tipSection,tipSections,type TipSection,type TipSectionId} from '@/lib/tips';

export function TipsContent({section}:{section:TipSection}){
 return <div className="tips-content">{section.blocks.map((b,i)=><section className={'tips-block tips-kind-'+b.type} key={i}><h3>{b.title}</h3>
  {b.type==='steps'&&<ol className="tips-steps">{b.items.map((s,j)=><li key={j}><b>{s.title}</b><p>{s.text}</p></li>)}</ol>}
  {b.type==='list'&&<ul className="tips-list">{b.items.map((s,j)=><li key={j}>{s}</li>)}</ul>}
  {b.type==='table'&&<>{b.note&&<p className="helper">{b.note}</p>}<div className="tips-table-wrap"><table><thead><tr>{b.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k} lang={/[a-z]/i.test(c)&&k>0?'en':undefined}>{c}</td>)}</tr>)}</tbody></table></div></>}
  {b.type==='compare'&&<ul className="tips-list">{b.items.map((s,j)=><li key={j}>✗ {s.wrong} → ✓ {s.right}（{s.why}）</li>)}</ul>}
 </section>)}</div>;
}

export function TipsPage(){
 const [active,setActive]=useState<TipSectionId>('retell');
 useEffect(()=>{const s=new URLSearchParams(window.location.search).get('tips');if(s&&tipSections.some(t=>t.id===s))setActive(s as TipSectionId)},[]);
 const section=tipSection(active);
 return <div className="tips-page"><div className="page-heading"><div><div className="kicker">STUDY SKILLS</div><h1>做题技巧</h1><p>每个部分的解题步骤、常用清单和易错点。做题时也可以点页面上的“技巧”按钮随时查看。</p></div><button className="btn secondary" onClick={()=>window.print()}><Printer size={16}/>打印本页</button></div>
  <nav className="tips-tabs" aria-label="技巧分类">{tipSections.map(s=><button key={s.id} aria-pressed={s.id===active} className={s.id===active?'active':''} onClick={()=>setActive(s.id)}>{s.title}</button>)}</nav>
  <header className="tips-head"><h2>{section.title}</h2><p>{section.tagline}</p></header>
  <TipsContent section={section}/></div>;
}

export function TipsButton({section,label}:{section:TipSectionId;label?:string}){
 const [open,setOpen]=useState(false),s=tipSection(section);
 return <><button type="button" className="btn secondary tips-button" onClick={()=>setOpen(true)}><Lightbulb size={16}/>{label||s.title+'技巧'}</button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="large-dialog tips-dialog"><DialogHeader><DialogTitle>{s.title} · 做题技巧</DialogTitle><DialogDescription>{s.tagline}</DialogDescription></DialogHeader><TipsContent section={s}/><p className="helper"><a className="text-link" href={'/?view=tips&tips='+s.id}>在“做题技巧”页查看全部部分 →</a></p></DialogContent></Dialog></>;
}
