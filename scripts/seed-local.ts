import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {testDatabase} from '../tests/d1-adapter';
import {stageImport,publishRelease} from '../lib/server/management';
const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/initial-catalog.json','utf8'));const staged=await stageImport(db,packet,'reviewed-initial-migration');await publishRelease(db,staged.id,0,'reviewed-initial-migration');
const tables=db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[];
const quote=(x:unknown)=>x===null?'NULL':typeof x==='number'||typeof x==='bigint'?String(x):"'"+String(x).replaceAll("'","''")+"'";
const ordered:typeof tables=[];const pending=[...tables];while(pending.length){const i=pending.findIndex(t=>(db.sqlite.prepare('PRAGMA foreign_key_list(\"'+t.name+'\")').all() as {table:string}[]).every(f=>ordered.some(o=>o.name===f.table)));if(i<0)throw Error('Cyclic table dependencies');ordered.push(pending.splice(i,1)[0]);}let output='PRAGMA foreign_keys=ON;\n';for(const {name}of ordered){const rows=db.sqlite.prepare(`SELECT * FROM "${name}"`).all();for(const row of rows)output+=`INSERT OR IGNORE INTO "${name}" (${Object.keys(row).map(k=>'"'+k+'"').join(',')}) VALUES (${Object.values(row).map(quote).join(',')});\n`;}
mkdirSync('work',{recursive:true});writeFileSync('work/seed.sql',output);console.log(JSON.stringify({release:staged.id,...staged.summary}));
