import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import * as React from 'react';
const require=createRequire(import.meta.url);
function harness(file,name){
 const slots=[],effects=[],cache=new Map();let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useId(){cursor++;return 'company-test';},useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((dep,index)=>dep!==previous[index])){slots[i]=deps;effects.push(fn);}}};
 function load(file){
  if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);
  const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('exports','require',compiled)(out,specifier=>{
   if(specifier==='react')return react;
   if(specifier.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   const stubs={'./programme-editor':'ProgrammeEditor','./variant-image-editor':'VariantImageEditor','./image-guidance':'ImageGuidance','./create-tour-panel':'CreateTourPanel'};
   if(stubs[specifier])return {[stubs[specifier]]:()=>null};
   if(specifier==='@/hooks/use-editor-image-upload')return {useEditorImageUpload:()=>({busy:false,reset(){}})};
   if(specifier.startsWith('@/')||specifier.startsWith('.')){let local=specifier.startsWith('@/')?path.resolve(specifier.slice(2)):path.resolve(path.dirname(file),specifier);if(!/\.(ts|tsx)$/.test(local))local+=existsSync(local+'.tsx')?'.tsx':'.ts';return load(local);}
   return require(specifier);
  });return out;
 }
 const Component=load(path.resolve(file))[name];
 return {render(props){cursor=0;return Component(props);},effects};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];}
function text(tree){if(typeof tree==='string'||typeof tree==='number')return String(tree);return React.Children.toArray(tree?.props?.children).map(text).join('');}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const companyChoices=[{id:'one',name:'Sea Trips'},{id:'two',name:'Острова'},{id:'three',name:'Острова'}];
test('search matches company names without changing the selection; choosing uses ID and reset stays available',()=>{
 const h=harness('app/admin/company-filter.tsx','CompanyFilter'),chosen=[],props={companies:companyChoices,value:'',onChange:id=>chosen.push(id)};
 let tree=h.render(props);assert.equal(nodes(tree).find(n=>n.type==='button').props['aria-expanded'],false);
 nodes(tree).find(n=>n.type==='button').props.onClick();tree=h.render(props);
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'  ОСТРО  '}});tree=h.render(props);
 let choices=nodes(tree).filter(n=>n.type==='button'&&'aria-pressed' in n.props);assert.equal(choices.length,3);assert(!text(tree).includes('Sea Trips'));assert.deepEqual(chosen,[]);
 choices[2].props.onClick();assert.deepEqual(chosen,['three']);tree=h.render({...props,value:'three'});assert.equal(nodes(tree).find(n=>n.type==='button').props['aria-expanded'],false);
 nodes(tree).find(n=>n.type==='button').props.onClick();tree=h.render({...props,value:'three'});
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'not found'}});tree=h.render({...props,value:'three'});assert(text(tree).includes('Компании не найдены'));
 choices=nodes(tree).filter(n=>n.type==='button'&&'aria-pressed' in n.props);assert.equal(choices.length,1);choices[0].props.onClick();assert.deepEqual(chosen,['three','']);
});
test('Escape closes the popup and disabled state prevents selection',()=>{
 const h=harness('app/admin/company-filter.tsx','CompanyFilter'),chosen=[],props={companies:companyChoices,value:'one',onChange:id=>chosen.push(id)};
 let tree=h.render(props);nodes(tree).find(n=>n.type==='button').props.onKeyDown({key:'ArrowDown',preventDefault(){},stopPropagation(){}});tree=h.render(props);
 assert.equal(nodes(tree).find(n=>n.type==='button').props['aria-expanded'],true);
 tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});tree=h.render({...props,disabled:true});
 assert.equal(nodes(tree).find(n=>n.type==='button').props.disabled,true);assert(!nodes(tree).some(n=>n.type==='input'));assert.deepEqual(chosen,[]);
});
test('catalog filters without reordering, clears an excluded editor and protects dirty edits',async()=>{
 const tour=(id,title)=>({id,slug:id,title,description:'Description',category:'sea',image:null,imageAlt:'',variants:[],status:'on_request',featuredRank:1});
 const data={state:{release_id:'synthetic',generation:1},tours:[tour('unknown','No company'),tour('b','Second'),tour('a','First')],serviceCompanies:{a:['Sea Trips'],b:['Острова']},serviceCompanyRefs:{a:[companyChoices[0]],b:[companyChoices[1]]},drafts:[],releases:[]};
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>data});
 try{
  const h=harness('app/admin/catalog-panel.tsx','CatalogEditorPanel');let tree=h.render();h.effects.splice(0).forEach(fn=>fn());await flush();tree=h.render();
  const filter=()=>nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='CompanyFilter');
  const select=()=>nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']==='Экскурсия для редактирования');
  const ids=()=>nodes(select()).filter(n=>n.type==='option').map(n=>n.props.value);
  assert.deepEqual(ids(),['','unknown','b','a']);select().props.onChange({target:{value:'a'}});tree=h.render();
  filter().props.onChange('two');tree=h.render();assert.deepEqual(ids(),['','b']);assert.equal(select().props.value,'');assert(!nodes(tree).some(n=>n.type==='textarea'));
  filter().props.onChange('');tree=h.render();assert.deepEqual(ids(),['','unknown','b','a']);
  select().props.onChange({target:{value:'a'}});tree=h.render();nodes(tree).find(n=>n.type==='input'&&n.props.value==='First').props.onChange({target:{value:'Unsaved title'}});tree=h.render();
  assert.equal(filter().props.disabled,true);filter().props.onChange('two');tree=h.render();assert.equal(select().props.value,'a');assert.equal(filter().props.value,'');assert(nodes(tree).some(n=>n.type==='input'&&n.props.value==='Unsaved title'));
 }finally{globalThis.fetch=original;}
});
