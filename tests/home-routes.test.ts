import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import * as publicCatalog from '../lib/server/catalog';
import * as catalogNavigation from '../lib/public/catalog-navigation';
import {createReferenceCatalogController} from '../app/reference-preview/reference-feed';
import type {CatalogResponse} from '../lib/public/types';

// Execute the real route modules; replace only platform bindings and the client
// presentation boundary. This fails if '/' imports the legacy home again.
function executeModule(file:string,dependencies:Record<string,unknown>) {
  const source=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
    fileName:file,
  }).outputText;
  const exports:Record<string,any>={};
  const require=(name:string)=>{
    if(name==='react/jsx-runtime')return jsxRuntime;
    if(Object.hasOwn(dependencies,name))return dependencies[name];
    throw new Error('Unexpected route dependency: '+name);
  };
  new Function('require','exports',source)(require,exports);
  return exports;
}

function homeModules(db:D1Database) {
  const ReferenceHome=({data}:{data:CatalogResponse|null})=>React.createElement('main',{'data-home':'illustrated','data-count':data?.count});
  const root=executeModule('app/page.tsx',{
    '@/lib/server/catalog':publicCatalog,
    '@/lib/public/catalog-navigation':catalogNavigation,
    '@/lib/server/db':{database:()=>db},
    '@/lib/server/seo':{pageMetadata:async()=>({})},
    './reference-preview/ReferenceHome':{ReferenceHome},
  });
  const preview=executeModule('app/reference-preview/page.tsx',{'../page':root});
  return {root,preview,ReferenceHome};
}

test('Main and previous review URL execute the same approved home with real published data and 4+20 feed',async()=>{
  const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const release=await stageImport(db,packet,'route-test');await publishRelease(db,release.id,0,'route-test');
  const {root,preview,ReferenceHome}=homeModules(db);
  assert.equal(root.dynamic,'force-dynamic');assert.equal(preview.dynamic,'force-dynamic');
  assert.equal(preview.default,root.default);
  const main=await root.default();const previous=await preview.default();
  assert.equal(main.type,ReferenceHome);assert.equal(previous.type,ReferenceHome);
  const data=main.props.data as CatalogResponse;
  assert.equal(data.releaseId,release.id);assert.equal(data.count,43);assert.equal(data.items.length,4);
  assert.deepEqual(previous.props.data,data);
  const feed=createReferenceCatalogController(data,query=>publicCatalog.catalog(db,query));
  await feed.loadMore();assert.equal(feed.getSnapshot().data?.items.length,24);
  assert.deepEqual(feed.getSnapshot().data?.items.slice(0,4),data.items);
});

test('Main and previous review URL retain the illustrated retry state when catalogue is unavailable',async()=>{
  const {root,preview,ReferenceHome}=homeModules(testDatabase());
  for(const route of [root,preview]){const page=await route.default();assert.equal(page.type,ReferenceHome);assert.equal(page.props.data,null);}
});

test('Rendered shared tour/header/footer navigation returns to the corrected main route',()=>{
  const Icon=()=>null;
  const chrome=executeModule('app/components/SiteChrome.tsx',{
    react:React,
    'lucide-react':{Heart:Icon,Search:Icon,Menu:Icon,X:Icon},
    './LicenseBadge':{LicenseBadge:()=>React.createElement('span',null,'32/02104')},
  });
  const header=renderToStaticMarkup(React.createElement(chrome.Header));
  const footer=renderToStaticMarkup(React.createElement(chrome.Footer));
  assert.match(header,/<a class="wordmark" href="\/#selected" aria-label="Double Bottle Co’ - главная">/);
  assert.match(footer,/<a class="footer-brand" href="\/#selected">Double Bottle Co’<\/a>/);
  assert(!header.includes('/reference-preview'));assert(!footer.includes('/reference-preview'));
});
