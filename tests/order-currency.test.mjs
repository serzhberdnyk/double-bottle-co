import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {testDatabase} from './d1-adapter.ts';
import {recordOffer,amendOrder} from '../lib/server/inquiries.ts';

function fixture(t){
 const db=testDatabase();t.after(()=>db.sqlite.close());
 db.sqlite.exec("INSERT INTO catalog_products VALUES ('p','test'); INSERT INTO catalog_variants VALUES ('v','p'); INSERT INTO catalog_variant_revisions VALUES ('rev','v','hash','Test','1 day',1,'bus','group','{}'); INSERT INTO internal_suppliers VALUES ('supplier','Test supplier','{}'); INSERT INTO internal_supplier_offers VALUES ('offer','supplier','source','{}','hash','2026-01-01'); INSERT INTO internal_supply_bindings (id,revision_id,offer_id,status,priority,valid_from,compatibility_json) VALUES ('binding','rev','offer','approved',1,'2020-01-01','{}');");
 db.sqlite.prepare('INSERT INTO operations_inquiries VALUES (?,?,?,?,?,?,?,?)').run('inquiry','owner','key','hash','new','2026-01-01',JSON.stringify({revisionId:'rev',date:'2026-10-26',productTitle:'Synthetic test'}),'{}');
 return db;
}
const terms={currency:'THB',totalMinor:123456,confirmation:'Agreed',cancellation:'Agreed',consentReference:'test-consent'};
const execution={bindingId:'binding'};
const snapshot=(db,table,id)=>JSON.parse(db.sqlite.prepare(`SELECT snapshot_json FROM ${table} WHERE id=?`).get(id).snapshot_json);

test('THB order creation and repeated amendments preserve currency, amount and original history',async t=>{
 const db=fixture(t),created=await recordOffer(db,'inquiry',terms,execution,'test','confirmed_order');
 const original=snapshot(db,'operations_orders',created.id);assert.deepEqual(original.agreedTerms,terms);
 const first=await amendOrder(db,created.id,{...original.agreedTerms,confirmation:'Updated',consentReference:'next'},execution,'test');
 const saved=snapshot(db,'operations_order_events',first.id);assert.equal(saved.agreedTerms.currency,'THB');assert.equal(saved.agreedTerms.totalMinor,123456);
 const second=await amendOrder(db,created.id,{...saved.agreedTerms,confirmation:'Updated again',consentReference:'third'},execution,'test');
 assert.equal(snapshot(db,'operations_order_events',second.id).agreedTerms.currency,'THB');
 assert.deepEqual(snapshot(db,'operations_orders',created.id),original);
});

test('intentional supported order currency changes retain the entered amount without conversion',async t=>{
 const db=fixture(t),created=await recordOffer(db,'inquiry',terms,execution,'test','confirmed_order');
 for(const currency of ['USD','EUR','THB']){
  const changed={...terms,currency,consentReference:'change-'+currency};
  const amended=await amendOrder(db,created.id,changed,execution,'test');
  assert.deepEqual(snapshot(db,'operations_order_events',amended.id).agreedTerms,changed);
 }
 assert.deepEqual(snapshot(db,'operations_orders',created.id).agreedTerms,terms);
});

test('actual offer and amendment form expose the same THB USD EUR options',()=>{
 const source=ts.createSourceFile('operations.tsx',readFileSync('app/admin/operations.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='OfferForm');
 const compiled=ts.transpileModule(fn.getText(source).replace('export function','function'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 const Form=new Function('React','useState',compiled+';return OfferForm;')(React,React.useState);
 for(const orderId of [undefined,'existing-order']){
  const html=renderToStaticMarkup(React.createElement(Form,{inquiry:{id:'inquiry',snapshot_json:'{"revisionId":"rev"}'},bindings:[{id:'binding',status:'approved',revision_id:'rev',supplier_name:'Test supplier',variant_name:'Test'}],onAction:async()=>{},busy:false,orderId}));
  const currency=html.match(/<select name="currency">(.*?)<\/select>/)?.[1];
  assert.equal(currency,'<option>THB</option><option>USD</option><option>EUR</option>');
 }
});
