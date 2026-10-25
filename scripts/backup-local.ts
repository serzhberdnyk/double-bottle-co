import {writeFileSync} from 'node:fs';
import {testDatabase} from '../tests/d1-adapter';
import {exportBackup} from '../lib/server/backup';
const [file,target]=process.argv.slice(2);if(!file?.includes('.wrangler/state/')||!target)throw Error('Pass a local .wrangler/state SQLite file and output.json');const db=testDatabase(file,false);const backup=await exportBackup(db);writeFileSync(target,JSON.stringify(backup),{mode:0o600});db.sqlite.close();console.log({tables:backup.tables.length});
