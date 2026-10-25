/** One-way management client. Secrets are read only from environment; never logged. */
import {readFileSync} from 'node:fs';
const [command,fileOrId,generation]=process.argv.slice(2);
const origin=process.env.ELYSIAM_ORIGIN,token=process.env.ADMIN_TOKEN;
if(!origin||!token)throw Error('Set ELYSIAM_ORIGIN and ADMIN_TOKEN in the process environment.');
if(!['import','publish','rollback','read'].includes(command))throw Error('Usage: admin-api.mjs import packet.json | publish release-id generation | rollback release-id generation | read');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
if(process.env.OAI_SITES_AUTHORIZATION)headers['OAI-Sites-Authorization']='Bearer '+process.env.OAI_SITES_AUTHORIZATION;
const body=command==='import'?{action:'import',packet:JSON.parse(readFileSync(fileOrId,'utf8'))}:{action:command,releaseId:fileOrId,generation:Number(generation)};
const response=await fetch(new URL('/api/admin',origin),{method:command==='read'?'GET':'POST',headers,...(command==='read'?{}:{body:JSON.stringify(body)})});
const result=await response.json();
if(!response.ok)throw Error(result.error||'Management request failed');
if(command==='read')console.log(JSON.stringify({state:result.state,releases:result.releases.map(r=>({id:r.id,status:r.status,createdAt:r.created_at})),inquiryCount:result.inquiries.length,bindings:result.bindings.length},null,2));
else if(command==='import')console.log(JSON.stringify({id:result.id,status:result.status,idempotent:result.idempotent,summary:result.summary},null,2));
else console.log(JSON.stringify(result,null,2));
