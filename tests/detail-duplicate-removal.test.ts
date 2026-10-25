import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import * as React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ts from 'typescript';
import {ArrowRight,Check,Heart,Plus} from 'lucide-react';
import {compactTourModel} from '../lib/public/compact-tour';
import {priceLabel,categoryNames,visitNames,type Tour,type Variant} from '../lib/public/types';
import {displayRates} from '../lib/public/pricing';
import {localizedPriceText,localizedPriceUnit} from '../app/components/localized-price';
import {translateUi} from '../lib/i18n/ui-copy';import type {Locale} from '../lib/i18n/core';
function extract(path:string,names:string[]){const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);return ts.transpileModule(source.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text||'')).map(n=>n.getText(source).replace('export function','function')).join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;}
const styles=new Proxy({},{get:(_,key)=>String(key)}),today='2026-10-22';
const variant:Variant={id:'v',revisionId:'rev',name:'Катамаран',description:'Проверенная программа',duration:'1 день',days:1,transport:'Катамаран',format:'',status:'on_request',stops:[],itinerary:['Первый остров'],includes:['Обед'],extras:['Трансфер'],conditions:['Минимум группы: 25 пассажиров'],earliestDate:null,rates:[{id:'adult',audience:'adult',amountMinor:230000,currency:'THB',unit:'за взрослого',validFrom:'2026-10-19',validUntil:null,conditions:'RATE_CONFIRMATION_PARAGRAPH',supplements:['SUPPLEMENT_PRESERVED']},{id:'child',audience:'child',amountMinor:190000,currency:'THB',unit:'за ребёнка 4–10 лет',validFrom:'2026-10-19',validUntil:null,conditions:'RATE_CONFIRMATION_PARAGRAPH',supplements:['SUPPLEMENT_PRESERVED']}]};
const tour:Tour={id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise',title:'Пхи-Пхи',description:'Описание',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:1,variants:[variant]};
test('actual compact detail has one primary request, one adult price and footer in RU/EN/TH',()=>{
 const before=JSON.stringify(tour);
 for(const locale of ['ru','en','th'] as Locale[]){
  const useI18n=()=>({locale,t:(s:string)=>translateUi(s,locale),href:(s:string)=>s});
  const BottlePrice=({price}:{price:ReturnType<typeof priceLabel>})=>React.createElement('span',null,localizedPriceText(price,locale));
  const ChildPriceLines=new Function('React','useI18n','todayInThailand','displayRates','priceLabel','BottlePrice','localizedPriceUnit',extract('app/components/PriceOptions.tsx',['ChildPriceLines'])+'\nreturn ChildPriceLines;')(React,useI18n,()=>today,displayRates,priceLabel,BottlePrice,localizedPriceUnit);
  const Compact=new Function('React','useI18n','compactTourModel','approvedTourCover','isApprovedReviewTour','categoryNames','visitNames','Header','Footer','TourImage','ArrowRight','Check','Heart','Plus','styles','ApprovedBrochures',extract('app/components/CompactTourDetail.tsx',['CompactTourDetail'])+'\nreturn CompactTourDetail;')(React,useI18n,compactTourModel,()=>null,()=>false,categoryNames,visitNames,()=>React.createElement('header'),()=>React.createElement('footer',null,'FOOTER_PRESERVED'),()=>React.createElement('div',null,'PHOTO'),ArrowRight,Check,Heart,Plus,styles,()=>null);
  const html=renderToStaticMarkup(React.createElement(Compact,{tour,variant,price:React.createElement('div',{'data-adult-price':true},'2300 THB'),childPrices:React.createElement(ChildPriceLines,{variant,option:null,date:today,showConditions:false}),inquiryDialog:React.createElement('div',null,'INQUIRY_PRESERVED'),onRequest:()=>{},onFavorite:()=>{},saved:false}));
  assert.equal((html.match(/class="requestButton"/g)||[]).length,1);assert.equal((html.match(/data-adult-price/g)||[]).length,1);
  assert(!html.includes('bottomRequest'));assert(!html.includes('RATE_CONFIRMATION_PARAGRAPH'));assert(!html.includes('public-price-conditions'));
  assert(html.includes('FOOTER_PRESERVED'));assert(html.includes('INQUIRY_PRESERVED'));assert(html.includes('Минимум группы: 25 пассажиров'));
  assert(html.includes(localizedPriceUnit('за ребёнка 4–10 лет',locale)));
 }
 assert.equal(JSON.stringify(tour),before);assert.equal(variant.rates[1].conditions,'RATE_CONFIRMATION_PARAGRAPH');assert.deepEqual(variant.rates[1].supplements,['SUPPLEMENT_PRESERVED']);
});
test('both public detail surfaces hide tariff disclosure; shared data/conditions component remains available',()=>{
 const host=readFileSync('app/components/CatalogUI.tsx','utf8'),options=readFileSync('app/components/PriceOptions.tsx','utf8');
 assert(!host.includes('<PublicPriceConditions'));assert.equal((host.match(/showConditions=\{false\}/g)||[]).length,2);
 assert(host.includes('onRequest={trigger=>{compactRequestTrigger.current=trigger;setOpen(true);}}'));
 assert(host.includes('<InquiryForm tour={tour} variant={v} releaseId={releaseId}'));assert(options.includes('export function PublicPriceConditions'));assert(options.includes('publicRateNotes(variant,option)'));
 assert(options.includes('showConditions=true'));assert(options.includes('showConditions&&<small>{r.conditions}</small>'));
});
