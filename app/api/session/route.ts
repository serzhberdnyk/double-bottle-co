import {json,sessionToken} from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(req:Request){const id=sessionToken(req)||crypto.randomUUID();return json({ready:true},200,{'Set-Cookie':`elysiam_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${new URL(req.url).protocol==='https:'?'; Secure':''}`});}
