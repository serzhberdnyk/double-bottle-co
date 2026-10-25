import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {availablePriceOptions,selectPriceOption,displayRates,todayInThailand} from '../lib/public/pricing';
import {priceLabel,type PriceOption,type Variant} from '../lib/public/types';
import {bottlePriceText} from '../lib/public/bottle-discount';

const option=(key:string,extra:Record<string,unknown>={}):PriceOption=>({key,label:key,serviceDateFrom:null,serviceDateUntil:null,conditions:[],supplements:[],...extra});
const variant=(options:PriceOption[]):Variant=>({id:'test',revisionId:'test',name:'Test',description:'',duration:'',days:1,transport:'',format:'',status:'on_request',stops:[],itinerary:[],includes:[],extras:[],conditions:[],rates:options.map(o=>({id:o.key,optionKey:o.key,amountMinor:260000,currency:'THB',unit:'за взрослого',audience:'adult',validFrom:'2026-01-01',validUntil:null,conditions:'',supplements:[]})),priceOptions:options,earliestDate:null});

// Render the actual production selector, with only its module imports supplied here.
const source=ts.createSourceFile('PriceOptions.tsx',readFileSync('app/components/PriceOptions.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PriceOptionSelector')!;
const compiled=ts.transpileModule(declaration.getText(source).replace('export function','function'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const Selector=new Function('React','availablePriceOptions','priceLabel','displayRates','todayInThailand','useBottleDiscount','bottlePriceText',compiled+'\nreturn PriceOptionSelector;')(React,availablePriceOptions,priceLabel,displayRates,todayInThailand,()=>false,bottlePriceText);
const render=(v:Variant,value?:string)=>renderToStaticMarkup(React.createElement(Selector,{variant:v,value,onChange:()=>{}}));

test('One real tariff renders no selector or label and is selected with its original rates',()=>{
 const v=variant([option('only')]),before=structuredClone(v);
 assert.equal(render(v),'');assert.equal(selectPriceOption(v).option?.key,'only');
 assert.deepEqual(selectPriceOption(v).variant.rates,v.rates);assert.deepEqual(v,before);
});

test('Disabled and unavailable entries do not create a second choice or become the default',()=>{
 const v=variant([option('disabled',{disabled:true}),option('closed',{status:'temporarily_unavailable'}),option('expired',{serviceDateUntil:'2020-01-01'}),option('only')]);
 assert.equal(render(v),'');assert.deepEqual(availablePriceOptions(v).map(o=>o.key),['only']);
 assert.equal(selectPriceOption(v).option?.key,'only');assert.equal(selectPriceOption(v).variant.rates[0].optionKey,'only');
 assert.equal(selectPriceOption(v,'disabled').option?.key,'only');assert.equal(selectPriceOption(v,'disabled').variant.rates[0].optionKey,'only');
 assert.equal(selectPriceOption(v,'unknown').option,null);assert.deepEqual(selectPriceOption(v,'unknown').variant.rates,[]);
});

test('Multiple real choices stay selectable and explicit selection keeps only matching rates',()=>{
 const v=variant([option('standard'),option('comfort'),option('disabled',{disabled:true})]);
 const html=render(v,'comfort');assert(html.includes('<select'));assert(html.includes('Тариф и условия'));
 assert(html.includes('value="standard"'));assert(html.includes('value="comfort" selected'));
 assert(!html.includes('value="disabled"'));assert.equal(selectPriceOption(v,'comfort').variant.rates[0].optionKey,'comfort');
 assert.equal(selectPriceOption(v,'unknown').option,null);
});

test('Future and on-request tariffs remain choices; an impossible or finished service window does not',()=>{
 const v=variant([option('future',{serviceDateFrom:'2090-01-01',serviceDateUntil:'2090-12-31'}),option('request'),option('impossible',{serviceDateFrom:'2030-01-01',serviceDateUntil:'2029-01-01'})]);
 v.rates=[];assert.deepEqual(availablePriceOptions(v,'2026-10-15').map(o=>o.key),['future','request']);
 const closed=variant([option('old',{serviceDateUntil:'2020-01-01'})]);
 assert.equal(render(closed),'');assert.equal(selectPriceOption(closed).option,null);assert.deepEqual(selectPriceOption(closed).variant.rates,[]);
 const legacy=variant([]);assert.deepEqual(selectPriceOption(legacy).variant,legacy);
});
