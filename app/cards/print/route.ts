import {context,failure} from '@/lib/server';
import {cardsDocument,listCards} from '@/lib/study-cards-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const c=await context(),student=c.role==='teacher'?c.settings?.studentId:c.id,url=new URL(req.url),id=url.searchParams.get('id');
 const cards=(student?await listCards(student):[]).filter(x=>!id||x.id===id);
 const headers:Record<string,string>={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
 if(url.searchParams.get('download')==='1')headers['Content-Disposition']='attachment; filename="study-cards.html"';
 return new Response(cardsDocument(cards,c.settings?.studentName||''),{headers});
}catch(e){return failure(e)}}
