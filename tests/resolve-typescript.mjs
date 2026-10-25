import {registerHooks} from 'node:module';import {existsSync} from 'node:fs';
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL&&existsSync(new URL(s+'.ts',c.parentURL)))return n(s+'.ts',c);return n(s,c);}});
