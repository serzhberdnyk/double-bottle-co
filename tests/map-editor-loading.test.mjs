import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import * as React from 'react';
const require=createRequire(import.meta.url);
function editorHarness(){
 const slots=[],effects=[],cache=new Map();let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useId(){cursor++;return 'synthetic-editor';},useEffect(fn,deps){const i=cursor++;const previous=slots[i];if(!previous||deps.some((dep,index)=>dep!==previous[index])){slots[i]=deps;effects.push(fn);}}};
 const upload={busy:false,status:'',retryable:false,reset(){},cancel(){},retry(){},start:async()=>{}};
 function load(file){
  if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);
  const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('exports','require',compiled)(out,specifier=>{
   if(specifier==='react')return react;
   if(specifier.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   if(specifier==='./image-guidance')return {ImageGuidance:()=>null};
   if(specifier==='@/hooks/use-editor-image-upload')return {useEditorImageUpload:()=>upload};
   if(specifier.startsWith('@/')||specifier.startsWith('.')){let local=specifier.startsWith('@/')?path.resolve(specifier.slice(2)):path.resolve(path.dirname(file),specifier);if(!/\.(ts|tsx)$/.test(local))local+=existsSync(local+'.tsx')?'.tsx':'.ts';return load(local);}
   return require(specifier);
  });return out;
 }
 const {MapEditorPanel}=load(path.resolve('app/admin/map-panel.tsx'));
 return {render(){cursor=0;return MapEditorPanel();},effects};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];}
function text(tree){if(typeof tree==='string'||typeof tree==='number')return String(tree);return React.Children.toArray(tree?.props?.children).map(text).join('');}
const button=(tree,label)=>{const result=nodes(tree).find(node=>node.type==='button'&&text(node)===label);assert(result,`Missing button ${label}`);return result;};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const fixture=()=>({revision:0,publishedRevision:0,published:[],draft:null,catalogGeneration:null,tours:[],publishedDocument:{version:2,placements:[
 {id:'yona-boarding',x:30,y:30,image:'/media/reference/yona-user-icon.webp'},
 {id:'phuket-airport',x:20,y:20,image:'/media/reference/airport-plane-cutout.png'},
 {id:'big-buddha',x:40,y:40,image:'/media/reference/big-buddha-cutout.png'},
 {id:'diving',x:50,y:50,image:'/media/reference/diving-user-boat.webp'}],routes:[]},draftDocument:null});

test('actual editor ignores a late initial GET after refresh and local edits',async()=>{
 const pending=[];const original=globalThis.fetch;globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
 try{
  const editor=editorHarness();let tree=editor.render();editor.effects.splice(0).forEach(fn=>fn());assert.equal(pending.length,1);
  const refresh=button(tree,'Обновить карту').props.onClick();assert.equal(pending.length,2);
  pending[1]({ok:true,json:async()=>fixture()});await refresh;tree=editor.render();button(tree,'Добавить маршрут').props.onClick();
  pending[0]({ok:true,json:async()=>fixture()});await flush();tree=editor.render();
  assert(button(tree,'Маршруты (1)'));assert(text(tree).includes('Есть неопубликованные изменения.'));
 }finally{globalThis.fetch=original;}
});
test('actual editor guards repeated save clicks and keeps dirty edits after a failed publish',async()=>{
 const pending=[];const original=globalThis.fetch;globalThis.fetch=(_url,options)=>new Promise(resolve=>pending.push({resolve,options}));
 try{
  const editor=editorHarness();editor.render();editor.effects.splice(0).forEach(fn=>fn());pending[0].resolve({ok:true,json:async()=>fixture()});await flush();let tree=editor.render();
  button(tree,'Добавить значок').props.onClick();tree=editor.render();const save=button(tree,'Сохранить и опубликовать');const first=save.props.onClick();const second=save.props.onClick();assert.equal(pending.length,2);
  const payload=JSON.parse(pending[1].options.body);assert.equal(payload.action,'saveAndPublish');assert.equal(payload.document.placements.length,6);
  pending[1].resolve({ok:false,json:async()=>({error:'Synthetic publication failure'})});await Promise.all([first,second]);tree=editor.render();
  assert(text(tree).includes('Synthetic publication failure'));assert(text(tree).includes('Есть неопубликованные изменения.'));assert(button(tree,'Значки (6)'));
 }finally{globalThis.fetch=original;}
});
test('actual point keyboard move retains its label/colour and publishes the changed point fields',async()=>{
 const pending=[];const original=globalThis.fetch;globalThis.fetch=(_url,options)=>new Promise(resolve=>pending.push({resolve,options}));
 try{
  const editor=editorHarness();editor.render();editor.effects.splice(0).forEach(fn=>fn());const data=fixture();data.publishedDocument.routes=[{id:'synthetic-route',title:'Route',color:'sea',style:'dashed',points:[{x:10,y:20,label:'Start',color:'gold'},{x:30,y:40,label:'Finish',color:'land'}]}];pending[0].resolve({ok:true,json:async()=>data});await flush();let tree=editor.render();
  button(tree,'Маршруты (1)').props.onClick();tree=editor.render();const routeSelect=nodes(tree).find(node=>node.type==='select'&&nodes(node).some(option=>option.type==='option'&&option.props.value==='synthetic-route'));assert(routeSelect);routeSelect.props.onChange({target:{value:'synthetic-route'}});tree=editor.render();
  const point=nodes(tree).find(node=>node.type==='button'&&String(node.props['aria-label']).startsWith('Start —'));assert(point);point.props.onKeyDown({key:'ArrowRight',shiftKey:false,preventDefault(){}});tree=editor.render();
  const name=nodes(tree).find(node=>node.type==='input'&&node.props.value==='Start');assert(name);name.props.onChange({target:{value:'New start'}});tree=editor.render();const color=nodes(tree).find(node=>node.type==='select'&&node.props.value==='gold');assert(color);color.props.onChange({target:{value:'coral'}});tree=editor.render();
  const save=button(tree,'Сохранить и опубликовать').props.onClick();const payload=JSON.parse(pending[1].options.body);assert.deepEqual(payload.document.routes[0].points[0],{x:10.25,y:20,label:'New start',color:'coral'});
  pending[1].resolve({ok:true,json:async()=>({...data,revision:1,publishedRevision:1,publishedDocument:payload.document})});await save;
 }finally{globalThis.fetch=original;}
});
test('actual closed toggle, reverse and delete preserve stop metadata without storing duplicate first point',async()=>{
 const pending=[];const original=globalThis.fetch;globalThis.fetch=(_url,options)=>new Promise(resolve=>pending.push({resolve,options}));
 try{
  const editor=editorHarness();editor.render();editor.effects.splice(0).forEach(fn=>fn());const data=fixture();data.tours=[{id:'tour-one',slug:'one',title:'Tour'}];data.publishedDocument.routes=[{id:'synthetic-route',title:'Route',tourId:'tour-one',color:'sea',style:'dashed',points:[{x:10,y:20,label:'Start',color:'gold'},{x:30,y:40,label:'Middle',color:'land'},{x:50,y:60,label:'Finish',color:'coral'}]}];pending[0].resolve({ok:true,json:async()=>data});await flush();let tree=editor.render();button(tree,'Маршруты (1)').props.onClick();tree=editor.render();nodes(tree).find(node=>node.type==='select'&&nodes(node).some(option=>option.type==='option'&&option.props.value==='synthetic-route')).props.onChange({target:{value:'synthetic-route'}});tree=editor.render();
  const checkbox=()=>nodes(tree).find(node=>node.type==='input'&&node.props.type==='checkbox');assert.equal(checkbox().props.disabled,false);checkbox().props.onChange({target:{checked:true}});tree=editor.render();assert.equal(checkbox().props.checked,true);checkbox().props.onChange({target:{checked:false}});tree=editor.render();assert.equal(checkbox().props.checked,false);checkbox().props.onChange({target:{checked:true}});tree=editor.render();button(tree,'Развернуть порядок точек').props.onClick();tree=editor.render();
  let save=button(tree,'Сохранить и опубликовать').props.onClick();let payload=JSON.parse(pending[1].options.body);assert.equal(payload.document.routes[0].closed,true);assert.equal(payload.document.routes[0].tourId,'tour-one');assert.deepEqual(payload.document.routes[0].points,[...data.publishedDocument.routes[0].points].reverse());
  pending[1].resolve({ok:true,json:async()=>({...data,revision:1,publishedRevision:1,publishedDocument:payload.document})});await save;tree=editor.render();button(tree,'Убрать последнюю точку').props.onClick();tree=editor.render();assert.equal(checkbox().props.checked,false);assert.equal(checkbox().props.disabled,true);assert(text(tree).includes('Маршрут разомкнут'));
  save=button(tree,'Сохранить и опубликовать').props.onClick();payload=JSON.parse(pending[2].options.body);assert.equal(payload.document.routes[0].closed,false);assert.equal(payload.document.routes[0].points.length,2);assert.equal(payload.document.routes[0].tourId,'tour-one');pending[2].resolve({ok:true,json:async()=>({...data,revision:2,publishedRevision:2,publishedDocument:payload.document})});await save;
 }finally{globalThis.fetch=original;}
});

test('actual editor keeps legacy tour binding explicit and selects a stable program from all admin choices',async()=>{
 const pending=[],original=globalThis.fetch;globalThis.fetch=(_url,options)=>new Promise(resolve=>pending.push({resolve,options}));
 try{
  const data=fixture();data.tours=Array.from({length:16},(_,index)=>({id:'tour-'+index,slug:'tour-'+index,title:'Tour '+index,hidden:index===15,variants:[{id:'program-'+index,name:'Standard',visible:index!==14,status:'on_request'},...(index===0?[{id:'vip',name:'VIP',visible:true,status:'on_request'}]:[])]}));
  data.publishedDocument.routes=[{id:'legacy',title:'Legacy route',tourId:'tour-0',closed:true,color:'sea',style:'dashed',points:[{x:10,y:20,label:'Start',color:'gold'},{x:30,y:40,label:'Bay',color:'violet'},{x:50,y:60,label:'Return',color:'coral'}]}];
  const editor=editorHarness();editor.render();editor.effects.splice(0).forEach(fn=>fn());pending[0].resolve({ok:true,json:async()=>data});await flush();let tree=editor.render();button(tree,'Маршруты (1)').props.onClick();tree=editor.render();
  const selectWith=value=>nodes(tree).find(node=>node.type==='select'&&nodes(node).some(option=>option.type==='option'&&option.props.value===value));
  selectWith('legacy').props.onChange({target:{value:'legacy'}});tree=editor.render();
  assert(text(tree).includes('У экскурсии несколько программ.'));assert(text(tree).includes('Уточните программу'));
  assert.equal(selectWith('vip').props.value,'');assert.equal(selectWith('tour-15').props.value,'tour-0');
  assert.equal(nodes(selectWith('tour-15')).filter(node=>node.type==='option').length,17);
  assert(text(selectWith('tour-15')).includes('Tour 15 — архивная'));assert(text(selectWith('tour-14')).includes('Tour 14 — все программы скрыты'));
  selectWith('vip').props.onChange({target:{value:'vip'}});tree=editor.render();
  const save=button(tree,'Сохранить и опубликовать').props.onClick(),payload=JSON.parse(pending[1].options.body);
  assert.deepEqual(payload.document.routes[0],{...data.publishedDocument.routes[0],variantId:'vip'});
  pending[1].resolve({ok:true,json:async()=>({...data,revision:1,publishedRevision:1,publishedDocument:payload.document})});await save;tree=editor.render();
  selectWith('tour-14').props.onChange({target:{value:'tour-14'}});tree=editor.render();assert.equal(selectWith('program-14').props.value,'');assert(text(selectWith('program-14')).includes('Standard — скрыта'));
  selectWith('program-14').props.onChange({target:{value:'program-14'}});tree=editor.render();
  const saveHidden=button(tree,'Сохранить и опубликовать').props.onClick(),hiddenPayload=JSON.parse(pending[2].options.body);
  assert.equal(hiddenPayload.document.routes[0].tourId,'tour-14');assert.equal(hiddenPayload.document.routes[0].variantId,'program-14');assert.deepEqual(hiddenPayload.document.routes[0].points,data.publishedDocument.routes[0].points);
  pending[2].resolve({ok:true,json:async()=>({...data,revision:2,publishedRevision:2,publishedDocument:hiddenPayload.document})});await saveHidden;
 }finally{globalThis.fetch=original;}
});
