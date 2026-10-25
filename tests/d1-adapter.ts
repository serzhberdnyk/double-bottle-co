import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function testDatabase(file=':memory:',migrate=true){
 const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON;');
 const db:any={prepare(sql:string){let args:any[]=[];const api={bind(...a:any[]){args=a;return api;},async all(){return{results:sqlite.prepare(sql).all(...args),success:true};},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){if(/^\s*SELECT/i.test(sql))return {success:true,results:sqlite.prepare(sql).all(...args),meta:{changes:0}};const r=sqlite.prepare(sql).run(...args);return{success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};return api;},async batch(statements:any[]){sqlite.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}},sqlite};
 if(migrate)for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
 return db as D1Database&{sqlite:DatabaseSync};
}
