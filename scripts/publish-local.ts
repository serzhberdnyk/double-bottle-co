import {readFileSync} from 'node:fs';
import {testDatabase} from '../tests/d1-adapter';
import {stageImport,publishRelease} from '../lib/server/management';
const [file,packet]=process.argv.slice(2);if(!file?.includes('.wrangler/state/')||!packet)throw Error('Only a local .wrangler/state database is supported. Pass its file and the reviewed packet.');
const db=testDatabase(file,false);const staged=await stageImport(db,JSON.parse(readFileSync(packet,'utf8')),'local-review');const state=await db.prepare('SELECT generation FROM catalog_state WHERE id=1').first<any>();if(staged.status==='draft')console.log(await publishRelease(db,staged.id,state?.generation||0,'local-review'));else console.log({id:staged.id,status:staged.status});db.sqlite.close();
