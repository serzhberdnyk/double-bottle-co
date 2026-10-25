// Dependency-free, LOCAL-ONLY real-codec QA harness. Never contacts application APIs.
// node tests/editor-image-browser.mjs, then open http://127.0.0.1:4179 in a browser.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const modules={
 '/prepare-editor-image.js':'../lib/public/prepare-editor-image.ts',
 '/editor-image-limits.js':'../lib/public/editor-image-limits.ts',
};
const server=createServer(async(req,res)=>{
 if(req.url==='/results'&&req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>100000){res.writeHead(413).end();return;}}
  writeFileSync(new URL('./editor-image-browser-results.json',import.meta.url),body);res.end('ok');return;
 }
 if(req.url in modules){const source=readFileSync(new URL(modules[req.url],import.meta.url),'utf8');res.setHeader('Content-Type','text/javascript');res.end(stripTypeScriptTypes(source).replace("'./editor-image-limits'","'/editor-image-limits.js'"));return;}
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync(new URL('./editor-image-browser.html',import.meta.url)));return;}
 res.writeHead(404).end();
}).listen(4179,'127.0.0.1',async()=>{
 console.log('Local codec QA: http://127.0.0.1:4179 (Ctrl+C to stop)');
 if(process.argv.includes('--smoke')){
  try{for(const path of ['/','/prepare-editor-image.js','/editor-image-limits.js']){const response=await fetch('http://127.0.0.1:4179'+path);if(!response.ok||!(await response.text()).length)throw Error(path);console.log('PASS HTTP '+path);}}catch(error){console.error(error);process.exitCode=1;}finally{server.close();}
 }
});
