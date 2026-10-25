import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app/admin/image-guidance.tsx');
const js=ts.transpileModule(source.replace("import styles from './image-guidance.module.css';","const styles = new Proxy({}, {get: (_, name) => name});"),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports','React',js)(require,module,module.exports,React);
const render=props=>renderToStaticMarkup(React.createElement(module.exports.ImageGuidance,{id:'guidance',...props}));

test('empty upload has visible dimensions and aspect ratios, not a mandatory resolution',()=>{
 const html=render({});assert.match(html,/1600 × 1200 px \(4:3\)/);assert.match(html,/не обязательный размер/);assert.match(html,/cover/);assert.match(html,/1360 × 1000/);assert.doesNotMatch(html,/<img/);
});
test('uploaded photo previews six real responsive slots with cover and intact original',()=>{
 const html=render({src:'/local-test.png',compact:true});assert.equal((html.match(/<img /g)||[]).length,7);assert.equal((html.match(/object-fit:cover/g)||[]).length,6);for(const ratio of [1.24,1.32,1.65,1.22,1.68,1.58])assert.match(html,new RegExp(`aspect-ratio:${ratio}`));assert.match(html,/не меняет изображение или черновик/);
});
test('standard illustration retains contain; map icon never suggests cover cropping',()=>{
 const art=render({src:'/local.png',kind:'illustration',compact:true});assert.equal((art.match(/object-fit:contain/g)||[]).length,6);const map=render({src:'/local.png',mapIcon:true});assert.match(map,/264 × 264 px/);assert.match(map,/1:1/);assert.match(map,/без обрезки/);assert.doesNotMatch(map,/object-fit:cover|Главная/);
});
test('all three upload fields reference guidance; reset, retry, cancel and publication stay separate',()=>{
 for(const file of ['catalog-panel','create-tour-panel','map-panel']){const s=read(`app/admin/${file}.tsx`);assert.match(s,/<ImageGuidance/);assert.match(s,/aria-describedby=/);assert.match(s,/type="file"/);assert.match(s,/setConfirm/);}
 for(const file of ['catalog-panel','map-panel']){const s=read(`app/admin/${file}.tsx`);assert.match(s,/imageUpload.cancel/);assert.match(s,/imageUpload.retry/);assert.match(s,/imageUpload.reset/);}
 assert.match(source,/naturalWidth:w,naturalHeight:h/);assert.match(source,/ImageExamples key=\{src\}/);assert.match(source,/onError=/);
});
test('preview ratios track current public CSS',()=>{
 const home=read('app/reference-preview/reference.module.css'),global=read('app/globals.css'),detail=read('app/components/CompactTourDetail.module.css');
 for(const r of ['1.24','1.32'])assert.ok(home.includes('aspect-ratio:'+r));for(const r of ['1.65','1.22','1.36','1.5'])assert.ok(global.includes('aspect-ratio:'+r));for(const r of ['1.68','1.58'])assert.ok(detail.includes('aspect-ratio: '+r));
});
