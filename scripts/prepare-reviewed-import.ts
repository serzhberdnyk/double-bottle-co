// Offline normalization boundary. Google reads are saved privately before review.
// No network, automatic publication, positional IDs, or writes back to the source.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePacket,type ImportPacket} from '../lib/server/management';
const [basePath,changesPath,outPath]=process.argv.slice(2);
if(!basePath||!changesPath||!outPath)throw Error('Usage: prepare-reviewed-import.ts BASE CHANGES OUTPUT');
const bytes=readFileSync(basePath),changes=JSON.parse(readFileSync(changesPath,'utf8'));
if(changes.baseSha256!==createHash('sha256').update(bytes).digest('hex'))throw Error('STALE_BASE: review against the current packet');
if(changes.spreadsheetId!=='1lxWUu0O7pTJ_lcne5jCISduokKnpqHvhmNUXH0mDxh8')throw Error('UNKNOWN_CANONICAL_SOURCE');
const packet=JSON.parse(bytes.toString()) as ImportPacket;
for(const change of changes.products||[]){
 if(!change.id||!change.sourceRanges?.length)throw Error('MISSING_ID_OR_SOURCE');
 const item=packet.products.find(p=>p.id===change.id);if(!item)throw Error('UNKNOWN_PRODUCT_ID');
 if(change.fields.id!==undefined)throw Error('IDENTITY_CHANGE_FORBIDDEN');
 Object.assign(item,change.fields);
}
for(const change of changes.destinations||[]){
 const item=packet.destinations.find(d=>d.id===change.id);if(!item)throw Error('UNKNOWN_DESTINATION_ID');
 if(change.fields.id!==undefined)throw Error('IDENTITY_CHANGE_FORBIDDEN');
 Object.assign(item,change.fields);
}
for(const media of changes.media||[]){
 if(packet.media.some(m=>m.id===media.id||m.path===media.path))throw Error('MEDIA_IDENTITY_CONFLICT');
 packet.media.push(media);
}
packet.source='TOURS MASTER - reviewed update';packet.checkedAt=changes.checkedAt;
const summary=validatePacket(packet);writeFileSync(outPath,JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({output:outPath,...summary,publicationPerformed:false}));
