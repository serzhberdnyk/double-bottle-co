import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareImage,sourceImageSize,uploadEditorImage} from '../lib/public/prepare-editor-image';
import {MAX_EDITOR_IMAGE_BYTES,MAX_SOURCE_IMAGE_BYTES} from '../lib/public/editor-image-limits';

// Deterministic browser API doubles: these test orchestration and budgets, not real codecs.
function png(width:number,height:number,size=64){const b=new Uint8Array(size);b.set([137,80,78,71,13,10,26,10]);b.set([73,72,68,82],12);const v=new DataView(b.buffer);v.setUint32(16,width);v.setUint32(20,height);return new File([b],'icon.png',{type:'image/png'});}
function jpeg(width:number,height:number,size=64){const b=new Uint8Array(size);b.set([255,216,255,192,0,17,8,height>>8,height&255,width>>8,width&255,3]);return new File([b],'photo.jpg',{type:'image/jpeg'});}
function browser(t:any,{width=4000,height=3000,encode=(w:number,h:number,q:number)=>new Blob([new Uint8Array(Math.ceil(w*h*q))],{type:'image/webp'}),decode=async()=>{}}={}){
 const draws:number[][]=[],encodes:number[][]=[],revoked:string[]=[],canvases:any[]=[];
 class ImageDouble{src='';naturalWidth=width;naturalHeight=height;decode=decode;}
 const context={drawImage:(_image:any,_x:number,_y:number,w:number,h:number)=>draws.push([w,h])};
 t.mock.method(URL,'createObjectURL',()=> 'blob:local-test');t.mock.method(URL,'revokeObjectURL',(url:string)=>revoked.push(url));
 const stub=(name:string,value:unknown)=>{const before=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});t.after(()=>{if(before)Object.defineProperty(globalThis,name,before);else Reflect.deleteProperty(globalThis,name);});};
 stub('Image',ImageDouble);
 stub('document',{createElement:()=>{const canvas={width:0,height:0,getContext:()=>context,toBlob:(cb:any,_type:string,q:number)=>{encodes.push([canvas.width,canvas.height,q]);cb(encode(canvas.width,canvas.height,q));}};canvases.push(canvas);return canvas;}});
 return {draws,encodes,revoked,canvases};
}

test('large photo adapts quality AND dimensions to unchanged server budget without cropping',async t=>{
 const b=browser(t),progress:string[]=[];
 const blob=await prepareImage(jpeg(4000,3000,900000),{onProgress:x=>progress.push(x)});
 assert(blob.size<=MAX_EDITOR_IMAGE_BYTES);assert.equal(blob.type,'image/webp');
 assert.deepEqual(b.draws[0],[1600,1200]);assert(b.draws.length>1);
 for(const [w,h] of b.draws)assert(Math.abs(w/h-4/3)<.002);
 assert(progress.some(x=>x.startsWith('Подгонка')));assert.equal(b.revoked.length,1);assert.equal(b.canvases[0].width,1);
});

test('transparent icon uses alpha-capable WebP; PNG fallback reduces dimensions instead of flattening',async t=>{
 const b=browser(t,{width:2400,height:1200,encode:(w,h)=>new Blob([new Uint8Array(w*h)],{type:'image/png'})});
 const result=await prepareImage(png(2400,1200,800000));
 assert.equal(result.type,'image/png');assert(result.size<=MAX_EDITOR_IMAGE_BYTES);assert(b.draws.length>1);
 for(const [w,h] of b.draws)assert(Math.abs(w/h-2)<.002);
});

test('small photo and transparent icon pass through byte-for-byte without upscaling/recompression',async t=>{
 const b=browser(t,{width:320,height:200});
 for(const file of [jpeg(320,200),png(320,200)])assert.equal(await prepareImage(file),file);
 assert.equal(b.draws.length,0);assert.equal(b.encodes.length,0);assert.equal(b.revoked.length,2);
});

test('oriented photo uses decoded display dimensions (portrait) for proportional output',async t=>{
 const b=browser(t,{width:3000,height:4000,encode:()=>new Blob(['ok'],{type:'image/webp'})});
 await prepareImage(jpeg(4000,3000,800000));assert.deepEqual(b.draws,[[1200,1600]]);
});

test('unsupported, empty, oversized, corrupt and pixel-bomb input fail before decode',async t=>{
 let decoded=0;browser(t,{decode:async()=>{decoded++;}});
 await assert.rejects(prepareImage(new File(['x'],'a.heic',{type:'image/heic'})),/HEIC/);
 await assert.rejects(prepareImage(new File([],'a.png',{type:'image/png'})),/20 МБ/);
 await assert.rejects(prepareImage(png(1,1,MAX_SOURCE_IMAGE_BYTES+1)),/20 МБ/);
 await assert.rejects(prepareImage(new File(['corrupt'],'a.png',{type:'image/png'})),/повреждён/);
 await assert.rejects(prepareImage(png(10000,10000)),/40 Мп/);
 await assert.rejects(prepareImage(png(16385,1)),/16384/);assert.equal(decoded,0);
});

test('decoder failures and null encoder results have readable errors and release resources',async t=>{
 const b=browser(t,{decode:async()=>{throw Error('decoder');}});
 await assert.rejects(prepareImage(png(10,10)),/повреждён/);assert.equal(b.revoked.length,1);
});
test('encoder failure releases resources',async t=>{
 const b=browser(t,{encode:()=>null as any});await assert.rejects(prepareImage(jpeg(4000,3000)),/сжать/);assert.equal(b.revoked.length,1);
});

test('cancel before preparation or during compression sends nothing; same file can be retried',async t=>{
 const file=jpeg(4000,3000,900000),controller=new AbortController();let calls=0;
 browser(t,{encode:()=>{controller.abort();return new Blob(['ok'],{type:'image/webp'});}});
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({path:'/api/catalog-media/test'});});
 await assert.rejects(uploadEditorImage(file,controller.signal,()=>{}),{name:'AbortError'});assert.equal(calls,0);
 await assert.rejects(prepareImage(file,{signal:controller.signal}),{name:'AbortError'});
 const path=await uploadEditorImage(file,new AbortController().signal,()=>{});assert.equal(path,'/api/catalog-media/test');assert.equal(calls,1);
});

test('cancellation after response suppresses late success; request contains abort signal and actual encoded MIME',async t=>{
 browser(t,{width:320,height:200});const controller=new AbortController();
 t.mock.method(globalThis,'fetch',async(_url:any,init:any)=>{assert.equal(init.signal,controller.signal);assert.equal(init.headers['Content-Type'],'image/png');return {ok:true,json:async()=>{controller.abort();return {path:'/late'};}} as Response;});
 await assert.rejects(uploadEditorImage(png(320,200),controller.signal,()=>{}),{name:'AbortError'});
});

test('failed upload is retryable and exposes a useful error; valid retry sends same small file',async t=>{
 browser(t,{width:320,height:200});let count=0;const file=png(320,200);
 t.mock.method(globalThis,'fetch',async(_url:any,init:any)=>{assert.equal(init.body,file);return ++count===1?Response.json({error:'Нет соединения'},{status:503}):Response.json({path:'/success'});});
 await assert.rejects(uploadEditorImage(file,new AbortController().signal,()=>{}),/Нет соединения/);
 assert.equal(await uploadEditorImage(file,new AbortController().signal,()=>{}),'/success');
});

test('real tiny PNG header is accepted; truncated JPEG/WebP headers fail closed',async()=>{
 const pngBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 assert.deepEqual(sourceImageSize(pngBytes,'image/png'),{width:1,height:1});
 for(const type of ['image/jpeg','image/webp'])assert.throws(()=>sourceImageSize(new Uint8Array([255,216,255]),type),/повреждён/);
});

test('WebP VP8X, VP8L and VP8 dimensions, and JPEG metadata segments are bounded before decode',async()=>{
 const webp=(chunk:string,payload:Uint8Array)=>{const b=new Uint8Array(20+payload.length+(payload.length%2)),v=new DataView(b.buffer);b.set(Buffer.from('RIFF'));v.setUint32(4,b.length-8,true);b.set(Buffer.from('WEBP'+chunk),8);v.setUint32(16,payload.length,true);b.set(payload,20);return b;};
 const extended=new Uint8Array(10);extended[4]=99;extended[7]=49;
 assert.deepEqual(sourceImageSize(webp('VP8X',extended),'image/webp'),{width:100,height:50});
 extended[0]=2;assert.throws(()=>sourceImageSize(webp('VP8X',extended),'image/webp'),/неподвижное/);
 const lossless=new Uint8Array(5);lossless[0]=47;new DataView(lossless.buffer).setUint32(1,99+(49<<14),true);
 assert.deepEqual(sourceImageSize(webp('VP8L',lossless),'image/webp'),{width:100,height:50});
 const lossy=new Uint8Array(10);lossy.set([157,1,42],3);new DataView(lossy.buffer).setUint16(6,100,true);new DataView(lossy.buffer).setUint16(8,50,true);
 assert.deepEqual(sourceImageSize(webp('VP8 ',lossy),'image/webp'),{width:100,height:50});
 const j=new Uint8Array(await jpeg(100,50).arrayBuffer()),withMetadata=new Uint8Array(j.length+6);withMetadata.set(j.slice(0,2));withMetadata.set([255,225,0,4,0,0],2);withMetadata.set(j.slice(2),8);
 assert.deepEqual(sourceImageSize(withMetadata,'image/jpeg'),{width:100,height:50});
 const p=new Uint8Array(await png(100,50).arrayBuffer());new DataView(p.buffer).setUint32(8,13);p.set(Buffer.from('acTL'),37);assert.throws(()=>sourceImageSize(p,'image/png'),/неподвижное/);
});

test('abort during decode releases URL and never uploads',async t=>{
 const controller=new AbortController();let release!:()=>void;
 const b=browser(t,{decode:()=>new Promise<void>(resolve=>{release=resolve;})});
 const pending=prepareImage(jpeg(4000,3000),{signal:controller.signal});
 await new Promise(resolve=>setImmediate(resolve));controller.abort();release();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(b.revoked.length,1);assert.equal(b.encodes.length,0);
});

test('abort during fetch passes cancellation to request; no successful path is returned',async t=>{
 browser(t,{width:320,height:200});const controller=new AbortController();
 t.mock.method(globalThis,'fetch',async(_url:any,init:any)=>new Promise<Response>((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});controller.abort();}));
 await assert.rejects(uploadEditorImage(png(320,200),controller.signal,()=>{}),{name:'AbortError'});
});
