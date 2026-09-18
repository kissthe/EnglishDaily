// Retired endpoint: old clients cannot trigger evaluation or external API calls.
export const dynamic='force-dynamic';
function retired(){return Response.json({error:'转述评估功能已移除。'},{status:410,headers:{'Cache-Control':'no-store'}})}
export const GET=retired;
export const POST=retired;
