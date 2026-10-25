import {readFileSync} from 'node:fs';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {Clock, Heart, Users} from 'lucide-react';
import {categoryNames, priceLabel, type Rate, type Tour} from '../lib/public/types';
import {displayRates} from '../lib/public/pricing';
import {bottleAmount} from '../lib/public/bottle-discount';
import {cardChildPrices} from '../lib/public/card-child-prices';
import {localizedPriceText,localizedPriceUnit} from '../app/components/localized-price';
import {translateUi} from '../lib/i18n/ui-copy';
import type {Locale} from '../lib/i18n/core';

// Render the production card/price functions, not a reimplemented fixture UI.
// Substitute only browser context, CSS-module names, artwork and a stable date.
function extract(path:string,names:string[]){
 const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const functions=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text||''));
 if(functions.length!==names.length)throw new Error('Expected production functions: '+names.join(', '));
 return ts.transpileModule(functions.map(node=>node.getText(source).replace('export function','function')).join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
}
const styles=new Proxy({}, {get:(_target,key)=>String(key)});
export function renderCard(tour:Tour,saved=false,busy=false,options:{locale?:Locale;discount?:boolean}={}){
 const locale=options.locale||'ru';
 const useI18n=()=>({locale,t:(text:string)=>translateUi(text,locale),href:(href:string)=>locale==='ru'?href:'/'+locale+href});
 const BottlePrice=new Function('React','useI18n','useBottleDiscount','localizedPriceText','bottleAmount','styles',extract('app/components/BottlePrice.tsx',['BottlePrice'])+'\nreturn BottlePrice;')(React,useI18n,()=>!!options.discount,localizedPriceText,bottleAmount,styles);
 const CardChildPrices=new Function('React','useI18n','cardChildPrices','BottlePrice','localizedPriceUnit','styles',extract('app/components/CardChildPrices.tsx',['CardChildPrices'])+'\nreturn CardChildPrices;')(React,useI18n,cardChildPrices,BottlePrice,localizedPriceUnit,styles);
 const Card=new Function('React','useState','useEffect','todayInThailand','useI18n','priceLabel','displayRates','categoryNames','styles','TourImage','Clock','Heart','Users','BottlePrice','localizedPriceUnit','CardChildPrices',extract('app/reference-preview/ReferenceHome.tsx',['CatalogPrice','ReferenceCard'])+'\nreturn ReferenceCard;')(
  React,React.useState,React.useEffect,()=> '2026-10-12',useI18n,priceLabel,displayRates,categoryNames,styles,
  ({src,alt,fallback}:{src?:string;alt:string;fallback:React.ReactNode})=>src?React.createElement('img',{src,alt}):fallback,Clock,Heart,Users,BottlePrice,localizedPriceUnit,CardChildPrices,
 ) as React.ComponentType<{tour:Tour;saved:boolean;busy:boolean;revealed:boolean;onFavorite:(id:string)=>void}>;
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
