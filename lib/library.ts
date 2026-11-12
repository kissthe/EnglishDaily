// 资料库：老师上传的 Word 讲义/教案，转换为网页供学生阅读。
export type LibraryItem={id:string;title:string;description:string;category:string;fileName:string;size:number;published:boolean;allowDownload:boolean;foldAnswers:boolean;created:string;updated:string};
export const libraryCategories=['教案','讲义','练习','复习资料','其他'];
export const DOCX_TYPE='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const LIBRARY_FILE_LIMIT=20*1024*1024;

const answerHeading=/^\s*【[^】]{0,20}(答案|解析|讲解|参考)[^】]{0,20}】/;
const library_css='<style>body{font:17px/1.9 "PingFang SC","Microsoft YaHei",Georgia,serif}h1{font-size:1.5em;line-height:1.4;margin:1.6em 0 .6em}h2{font-size:1.25em;margin:1.4em 0 .5em}h3{font-size:1.1em}table{border-collapse:collapse;width:100%;margin:1em 0}td,th{border:1px solid #d9dce5;padding:8px 12px;vertical-align:top}details.library-answer{margin:12px 0 20px;padding:10px 16px;border:1px dashed #b9b2f5;border-radius:10px;background:#f6f5ff}details.library-answer summary{cursor:pointer;color:#5346eb;font-weight:600}html.dark details.library-answer{background:#232038;border-color:#5b54a0}html.dark details.library-answer summary{color:#c0b5ff}html.dark td,html.dark th{border-color:#3b4254}</style>';

// 把“【答案与讲解】”等段落到下一个标题之间的内容折叠起来，让学生先做题再看答案。只在浏览器中调用。
export function prepareLibraryHtml(html:string,fold:boolean){
 if(!fold)return library_css+html;
 const doc=new DOMParser().parseFromString(`<div id="root">${html}</div>`,'text/html'),root=doc.getElementById('root')!;
 // 段落形式的答案标题折叠到下一个标题为止；标题形式的答案折叠到下一个同级或更高级标题为止。
 let details:HTMLElement|null=null,level=7;
 for(const node of Array.from(root.childNodes)){
  const el=node as HTMLElement,heading=el.nodeType===1&&/^H[1-6]$/.test(el.tagName)?Number(el.tagName[1]):0;
  const isAnswer=el.nodeType===1&&(heading||el.tagName==='P')&&answerHeading.test(el.textContent||'');
  if(heading&&!isAnswer&&details&&heading>level){details.appendChild(node);continue}
  if(heading&&!isAnswer){details=null;continue}
  if(isAnswer){
   details=doc.createElement('details');details.className='library-answer';level=heading||6;const summary=doc.createElement('summary');summary.textContent=(el.textContent||'').trim().slice(0,40)+'（先做题，再点开）';details.appendChild(summary);root.insertBefore(details,el);el.remove();continue;
  }
  if(details)details.appendChild(node);
 }
 return library_css+root.innerHTML;
}
