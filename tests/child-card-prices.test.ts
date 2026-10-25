import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {Clock,Heart,Users} from 'lucide-react';
import {priceLabel,categoryNames,type Tour,type Rate,type Variant} from '../lib/public/types';
import {displayRates} from '../lib/public/pricing';
import {cardChildPrices} from '../lib/public/card-child-prices';
import {localizedPriceText,localizedPriceUnit} from '../app/components/localized-price';
import {translateUi} from '../lib/i18n/ui-copy';
import type {Locale} from '../lib/i18n/core';

const rate=(override:Partial<Rate>={}):Rate=>({id:'adult',audience:'adult',amountMinor:260000,currency:'THB',unit:'за взрослого',validFrom:'2026-10-12',validUntil:null,conditions:'',supplements:[],optionKey:'one',...override});
const child=(override:Partial<Rate>={})=>rate({id:'child',audience:'child',amountMinor:220000,unit:'за ребёнка',...override});
const variant=(rates:Rate[]):Variant=>({id:'v',revisionId:'rev',name:'Катамаран',description:'',duration:'1 день',days:1,transport:'Катамаран',format:'',status:'on_request',stops:[],itinerary:[],includes:[],extras:[],conditions:[],rates,earliestDate:null});
const today='2026-10-22';
const result=(rates:Rate[])=>cardChildPrices([variant(rates)],priceLabel(rates,today),today);

test('verified Phi Phi example shows 2600 adult and 2200 child without modifying rates',()=>{
 const rates=[rate(),child()],before=JSON.stringify(rates),adult=priceLabel(rates,today),children=result(rates);
 assert.equal(adult.rate?.amountMinor,260000);assert.equal(children.status,'known');assert.equal(children.prices[0].price.rate?.amountMinor,220000);
 assert.equal(JSON.stringify(rates),before);assert.equal(children.prices[0].price.unit,'за ребёнка');
});
test('zero is displayed only from an explicit zero child rate; missing/expired data is on request',()=>{
 assert.equal(result([rate(),child({amountMinor:0})]).prices[0].price.rate?.amountMinor,0);
 for(const rates of [[rate()],[rate(),child({validUntil:'2026-10-21'})],[rate(),child({amountMinor:-1})],[rate(),child({currency:'USD'})],[rate(),child({validFrom:'2027-01-01'})]])assert.equal(result(rates).status,'unknown');
});
test('whole-group, vehicle and transport rates never imply a child tariff',()=>{
 for(const [audience,unit] of [['craft','за катер'],['group','за группу'],['vehicle','per vehicle'],['adult','за автомобиль'],['adult','per group'],['adult','per transfer'],['adult','за трансфер'],['adult','ต่อคัน'],['adult','ต่อกลุ่ม']])assert.equal(result([rate({audience,unit}),child()]).status,'not_applicable');
 assert.equal(result([]).status,'not_applicable');
});
test('variant, option, currency, season and age rules remain separate',()=>{
 assert.equal(result([rate(),child({optionKey:'two'})]).status,'unknown');
 const a=variant([rate()]),b={...variant([child()]),id:'other'};assert.equal(cardChildPrices([a,b],priceLabel(a.rates,today),today).status,'unknown');
 const free=child({amountMinor:0,unit:'за ребёнка 0-3 лет',ageRule:{min:0,max:3,requiresConfirmation:false}}),paid=child({id:'older',unit:'за ребёнка 4-10 лет',ageRule:{min:4,max:10,requiresConfirmation:false}});
 const rows=result([rate(),free,paid]);assert.equal(rows.prices.length,2);assert.deepEqual(rows.prices[0].price.rate?.ageRule,free.ageRule);assert.equal(rows.prices[0].ageConfirmation,false);
 const future=result([rate({validFrom:'2027-01-01'}),child({validFrom:'2027-01-01'})]);assert.equal(future.status,'known');assert(future.prices[0].price.unit.includes('01.01.2027'));
});

function extract(path:string,names:string[]){const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);return ts.transpileModule(source.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text||'')).map(n=>n.getText(source).replace('export function','function')).join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;}
const styles=new Proxy({},{get:(_,key)=>String(key)});
function render(locale:Locale,rates:Rate[],saved=false){
 const useI18n=()=>({locale,t:(s:string)=>translateUi(s,locale),href:(s:string)=>locale==='ru'?s:'/'+locale+s});
 const BottlePrice=new Function('React','useI18n','useBottleDiscount','localizedPriceText','styles',extract('app/components/BottlePrice.tsx',['BottlePrice'])+'\nreturn BottlePrice;')(React,useI18n,()=>false,localizedPriceText,styles);
 const CardChildPrices=new Function('React','useI18n','cardChildPrices','BottlePrice','localizedPriceUnit','styles',extract('app/components/CardChildPrices.tsx',['CardChildPrices'])+'\nreturn CardChildPrices;')(React,useI18n,cardChildPrices,BottlePrice,localizedPriceUnit,styles);
 const Card=new Function('React','useState','useEffect','todayInThailand','useI18n','priceLabel','displayRates','categoryNames','styles','TourImage','Clock','Heart','Users','BottlePrice','localizedPriceUnit','CardChildPrices',extract('app/reference-preview/ReferenceHome.tsx',['CatalogPrice','ReferenceCard'])+'\nreturn ReferenceCard;')(React,React.useState,React.useEffect,()=>today,useI18n,priceLabel,displayRates,categoryNames,styles,()=>React.createElement('div',null,'Photo'),Clock,Heart,Users,BottlePrice,localizedPriceUnit,CardChildPrices);
 const tour:Tour={id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise',title:'Пхи-Пхи | на катамаране',description:'',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:1,variants:[variant(rates)]};
 return renderToStaticMarkup(React.createElement(Card,{tour,saved,busy:false,revealed:false,onFavorite:()=>{}}));
}
test('actual card renders both prices, favorites and links in RU/EN/TH; unknown is localized',()=>{
 for(const locale of ['ru','en','th'] as Locale[]){
  const html=render(locale,[rate(),child()],true);assert.match(html,/2(?:\s|&nbsp;| |,)?600/);assert.match(html,/2(?:\s|&nbsp;| |,)?200/);assert(html.includes(localizedPriceUnit('за ребёнка',locale)));assert(html.includes('aria-pressed="true"'));assert(html.includes('/tour/phi-phi-paradise?variant=v'));assert(html.includes('1 день'));
  assert(render(locale,[rate()]).includes(translateUi('Детская цена уточняется',locale)));
  assert(!render(locale,[rate({audience:'craft',unit:'per boat'})]).includes('data-card-child-prices'));
 }
});
test('both card surfaces include the shared child-price component and preserve default adult rendering',()=>{
 const reference=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8'),catalog=readFileSync('app/components/CatalogUI.tsx','utf8');assert(reference.includes('<CardChildPrices variants={variants} adult={price}'));assert(catalog.includes('cardVariants={selectedVariant?[selectedVariant]:tour.variants}'));assert(catalog.includes('<BottlePrice price={p}/>'));
});
if(process.env.CHILD_CARD_QA_HTML){
 const css=readFileSync('app/reference-preview/reference.module.css','utf8')+'\n'+readFileSync('app/components/CardChildPrices.module.css','utf8');
 writeFileSync(process.env.CHILD_CARD_QA_HTML,'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\nbody{margin:16px;background:#fff8e7}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;max-width:1100px;margin:auto}.cardPhoto{background:#d9e2d7}</style><main class="cards">'+(['ru','en','th'] as Locale[]).flatMap(locale=>[render(locale,[rate(),child()]),render(locale,[rate()])]).join('')+'</main>');
}
