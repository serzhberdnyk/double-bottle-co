import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Render the real component with only the locale context mocked.
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/components/ApprovedBrochures.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const products={
  p_at_ks_1d:['cheo1d'],p_at_city_ab:['citytour'],p_at_kl_safari_1d:['khaolak'],p_at_ttoa_1d:['ttoa'],
  p_e340acb314a559f4b49a6e22:['ohosky','ohovip'],p_1cdc3b7fc1625ada979ad010:['4pearl'],p_dd70e1051d36596481a18438:['simila'],
};
function component(locale){
  const exports={};
  new Function('exports','require',compiled)(exports,specifier=>specifier==='@/lib/i18n/context'?{useI18n:()=>({locale})}:require(specifier));
  return exports.ApprovedBrochures;
}
for(const locale of ['ru','en','th'])test(`DEMO component preserves all sixteen image URLs and labels in ${locale}`,()=>{
  const Component=component(locale),seen=[];
  for(const [productId,stems] of Object.entries(products)){
    const markup=renderToStaticMarkup(createElement(Component,{productId}));
    assert.match(markup,/DEMO:/);
    assert.doesNotMatch(markup,/A-Time/);
    const links=[...markup.matchAll(/href="([^"]+)"/g)].map(item=>item[1]);
    assert.deepEqual(links,stems.flatMap(stem=>[`/media/atime-${stem}.jpg`,`/media/atime-${stem}1.jpg`]));
    for(const link of links)assert.ok(existsSync('public'+link),link);
    assert.equal((markup.match(/rel="noreferrer"/g)||[]).length,links.length);
    seen.push(...links);
  }
  assert.equal(new Set(seen).size,16);
});
test('DEMO component does not add brochures for unrelated or unknown products',()=>{
  for(const locale of ['ru','en','th']){
    const Component=component(locale);
    assert.equal(renderToStaticMarkup(createElement(Component,{productId:'synthetic-unknown'})),'');
  }
});
