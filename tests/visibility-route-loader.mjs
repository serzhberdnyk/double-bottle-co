import {fileURLToPath,pathToFileURL} from 'node:url';
export async function resolve(specifier,context,next){
 if(specifier==='next/headers')return {url:'data:text/javascript,export async function headers(){return new Headers({"x-doublebottle-locale":globalThis.__testLocale||"ru"})}',shortCircuit:true};
 if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__visibilityEnv',shortCircuit:true};
 if(specifier.startsWith('@/'))specifier=pathToFileURL(fileURLToPath(new URL('../'+specifier.slice(2),import.meta.url))+'.ts').href;
 try{return await next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error;}
}
