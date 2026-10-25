import {readFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {Clock, Heart, Users} from 'lucide-react';
import {categoryNames, priceLabel, type Rate, type Tour} from '../lib/public/types';
import {displayRates} from '../lib/public/pricing';
import {bottlePriceText} from '../lib/public/bottle-discount';

// Exercise the actual local card functions without loading the full map, router or browser.
// Only CSS module names, the image wrapper and the clock date are substituted for SSR.
const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
const source=ts.createSourceFile('ReferenceHome.tsx',home,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&['CatalogPrice','ReferenceCard'].includes(node.name?.text||''));
if(functions.length!==2)throw new Error('Expected the production card and price functions');
const code=ts.transpileModule(functions.map(node=>node.getText(source)).join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const styles=new Proxy({}, {get:(_target,key)=>String(key)});
const priceSource=ts.createSourceFile('BottlePrice.tsx',readFileSync('app/components/BottlePrice.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const priceFunction=priceSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='BottlePrice')!;
const priceCode=ts.transpileModule(priceFunction.getText(priceSource).replace('export function','function'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const BottlePrice=new Function('React','useBottleDiscount','bottlePriceText','styles',priceCode+'\nreturn BottlePrice;')(React,()=>false,bottlePriceText,styles);
const Card=new Function('React','useState','useEffect','todayInThailand','priceLabel','displayRates','categoryNames','styles','TourImage','Clock','Heart','Users','BottlePrice',code+'\nreturn ReferenceCard;')(
  React,React.useState,React.useEffect,()=> '2026-10-12',priceLabel,displayRates,categoryNames,styles,
  ({src,alt,fallback}:{src?:string;alt:string;fallback:React.ReactNode})=>src?React.createElement('img',{src,alt}):fallback,Clock,Heart,Users,BottlePrice,
) as React.ComponentType<{tour:Tour;saved:boolean;busy:boolean;revealed:boolean;onFavorite:(id:string)=>void}>;

export function renderCard(tour:Tour, saved=false, busy=false){
  return renderToStaticMarkup(React.createElement(Card,{tour,saved,busy,revealed:false,onFavorite:()=>{}}));
}
const rate=(overrides:Partial<Rate>={}):Rate=>({id:'fixture-rate',amountMinor:260000,currency:'THB',unit:'за взрослого',audience:'adult',validFrom:'2026-01-01',validUntil:null,conditions:'',supplements:[],...overrides});
const tour=(id:string,title:string,rates:Rate[],format='Групповая'):Tour=>({
  id,slug:id,title,description:'Fixture description',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:0,
  variants:[{id:id+'-variant',revisionId:'fixture',name:'Fixture',description:'',duration:'1 день',days:1,transport:'',format,status:'on_request',stops:[],itinerary:[],includes:[],extras:[],conditions:[],rates,earliestDate:null}],
});
// Synthetic values solely for regression cases. These never enter the public catalogue.
export const cardCases={
  adult:tour('adult','Короткое название',[rate()]),
  from:tour('from','Длинное название программы с несколькими вариантами и дополнительной строкой',[rate({optionKey:'one'}),rate({id:'second-rate',optionKey:'two',amountMinor:320000})]),
  craft:tour('craft','Гидроциклы',[rate({unit:'за гидроцикл (1–2 человека)',audience:'craft',amountMinor:790000})]),
  person:tour('person','Программа на человека',[rate({unit:'за человека'})]),
  request:tour('request','Индивидуальная программа',[],'По запросу'),
  future:tour('future','Будущий тариф',[rate({validFrom:'2027-01-15',unit:'за взрослого · трансфер оплачивается отдельно'})]),
  long:tour('long','Оченьдлинноеназваниебезпробеловдляпроверкиузкогоэкрана',[rate({unit:'за индивидуальную программу для небольшой группы участников'})],'Индивидуальная программа для небольшой группы участников'),
};
