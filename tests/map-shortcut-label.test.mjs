import test from 'node:test';import assert from 'node:assert/strict';import * as React from 'react';import ts from 'typescript';import {readFileSync} from 'node:fs';
import {busMapObject,mapPlacementImageSize,mapPlacementDisplayImage} from '../lib/public/map-layout.ts';
import {cheowLanMapCopy,cheowLanMapPath} from '../lib/public/cheow-lan-map.ts';
import {localePath} from '../lib/i18n/core.ts';
const source=ts.createSourceFile('CheowLanMapLink.tsx',readFileSync('app/reference-preview/CheowLanMapLink.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=source.statements.find(n=>ts.isFunctionDeclaration(n));const code=ts.transpileModule(fn.getText(source).replace('export function','function'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const ArrowUpRight=()=>null;
function render(locale,sizePx){return new Function('React','useI18n','useMapPlacement','busMapObject','mapPlacementImageSize','mapPlacementDisplayImage','cheowLanMapCopy','cheowLanMapPath','ArrowUpRight','styles','shortcut',code+';return CheowLanMapLink;')(React,()=>({locale,href:path=>localePath(path,locale)}),()=>({...busMapObject,sizePx}),busMapObject,mapPlacementImageSize,mapPlacementDisplayImage,cheowLanMapCopy,cheowLanMapPath,ArrowUpRight,{link:'link',icon:'icon',minibus:'minibus',label:'position'},{label:'shared-label'})();}

test('bus resizing changes the artwork width while the localized destination label stays content-sized',()=>{
 for(const locale of ['ru','en','th'])for(const size of [16,83.2,240]){
  const link=render(locale,size),label=link.props.children[1];
  assert.equal(link.type,'a');assert.equal(link.props.href,localePath(cheowLanMapPath,locale));assert.equal(link.props['aria-label'],cheowLanMapCopy[locale].open);
  assert.equal(link.props.style.width,size/1280*100+'%');assert.equal(link.props.style.left,'25.7%');assert.equal(link.props.style.top,'10.34%');
  assert.equal(label.props.className,'shared-label position');assert.equal(label.props.style,undefined);assert.equal(label.props.children[0],cheowLanMapCopy[locale].title);
  const icon=label.props.children[1];assert.equal(icon.type,'svg');assert.equal(icon.props.width,'18');assert.equal(icon.props.height,'18');assert.equal(icon.props['aria-hidden'],'true');assert.equal(icon.props.strokeWidth,'2.4');
  assert.deepEqual(icon.props.children.map(n=>[n.type,n.props]),[
   ['circle',{cx:'4.5',cy:'18.5',r:'2'}],
   ['path',{d:'M7 18.5h3.2a3.3 3.3 0 0 0 0-6.6H7.8a3.3 3.3 0 0 1 0-6.6h8.7',strokeDasharray:'2.5 3.4'}],
   ['circle',{cx:'19',cy:'5.3',r:'2.6',fill:'currentColor',stroke:'none'}],
  ]);
 }
});

test('both map shortcuts share typography and box treatment, with positioning kept separate',()=>{
 const common=readFileSync('app/reference-preview/MapShortcutLabel.module.css','utf8');
 for(const declaration of ['width:max-content','min-width:0','font:400 12px/1.2 ReferenceUI','padding:5px 7px','gap:5px','border:1px solid #153552','box-shadow:2px 2px 0 #153552'])assert(common.includes(declaration));
 for(const name of ['CheowLanMapLink','PhiPhiDetail']){
  const component=readFileSync('app/reference-preview/'+name+'.tsx','utf8');assert(component.includes("import shortcut from './MapShortcutLabel.module.css'"));assert(component.includes('shortcut.label'));
 }
 const own=readFileSync('app/reference-preview/CheowLanMapLink.module.css','utf8').match(/\.label\s*\{([^}]+)\}/)[1];assert(!/font|padding|width|border|shadow/.test(own));
});
