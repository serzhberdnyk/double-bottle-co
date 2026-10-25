import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Locale} from '../lib/i18n/core';
import {translateUi} from '../lib/i18n/ui-copy';
import {localizedPriceText,localizedPriceUnit} from '../app/components/localized-price';
import {bottleAmount} from '../lib/public/bottle-discount';
import {priceLabel,type Rate} from '../lib/public/types';
import {renderCard,cardCases} from './card-presentation-fixture';

const locales:Locale[]=['ru','en','th'];
function paired(){
 const tour=structuredClone(cardCases.adult);
 const adult=tour.variants[0].rates[0];
 tour.variants[0].rates.push({...adult,id:'child',audience:'child',amountMinor:220000,unit:'за ребёнка'});
 return tour;
}
const childAmount=(amount:number,locale:Locale)=>localizedPriceText(priceLabel([{...paired().variants[0].rates[0],amountMinor:amount}], '2026-10-12'),locale);

test('The screenshot pricing cases use the same real-card price slot, with age details below the sums',()=>{
 const phi=paired(),james=paired(),racha=paired(),request=structuredClone(cardCases.request);
 james.title='Джеймс Бонд | на катамаране';james.variants[0].rates[1].amountMinor=210000;
 racha.title='Рача и Корал';racha.variants[0].rates[0].amountMinor=120000;racha.variants[0].rates[1].amountMinor=100000;racha.variants[0].rates[1].unit='за ребёнка 3–10 лет';
 for(const locale of locales){
  for(const tour of [phi,james,racha,request]){
   const html=renderCard(tour,false,false,{locale});
   assert.match(html,/<div class="price" data-price-state="(?:known|request)"><div class="adultPrice"><strong>/);
   assert(html.indexOf('class="price"')>html.indexOf('</h3>'));
   assert(html.indexOf('class="price"')<html.indexOf('class="cardMeta"'));
  }
  const phiHtml=renderCard(phi,false,false,{locale});
  assert(phiHtml.indexOf(childAmount(220000,locale))<phiHtml.indexOf(translateUi('Возрастные условия уточняются',locale)));
  assert(!renderCard(racha,false,false,{locale}).includes(translateUi('Возрастные условия уточняются',locale)));
 }
});

test('Discounted current adult and child amounts precede their independent old-price/badge slots in every locale',()=>{
 for(const locale of locales){
  const tour=paired(),before=JSON.stringify(tour),html=renderCard(tour,false,false,{locale,discount:true});
  assert.equal((html.match(/data-price-layout="card"/g)||[]).length,2);
  for(const rate of tour.variants[0].rates){
   const label=priceLabel([{...rate,audience:'adult'}],'2026-10-12');
   const amount=localizedPriceText(label,locale,bottleAmount(rate.amountMinor));
   assert(html.includes('>'+amount+'</span><span class="savings"><del'));
   assert(html.includes(localizedPriceUnit(rate.unit,locale)));
  }
  assert.equal((html.match(/>−3%<\/small>/g)||[]).length,2);
  assert.equal(JSON.stringify(tour),before);
 }
});

test('Inactive discounts, unavailable prices and unknown children never fabricate discounted or zero prices',()=>{
 for(const locale of locales){
  const regular=renderCard(paired(),false,false,{locale});
  assert(!regular.includes('data-bottle-price'));
  const request=renderCard(cardCases.request,false,false,{locale,discount:true});
  assert(request.includes('data-price-state="request"'));
  assert(!request.includes('data-bottle-price'));
  assert(!request.includes('data-card-child-prices'));
  const unknown=renderCard(cardCases.adult,false,false,{locale,discount:true});
  assert(unknown.includes(translateUi('Детская цена уточняется',locale)));
  assert.equal((unknown.match(/data-price-layout="card"/g)||[]).length,1);
  assert(!unknown.includes('>'+childAmount(0,locale)+'<'));
 }
});

test('Multiple child age bands, genuine zero and confirmation notes remain complete in the aligned layout',()=>{
 const tour=paired(),adult=tour.variants[0].rates[0];
 tour.variants[0].rates=[adult,
  {...adult,id:'young',audience:'child',amountMinor:0,unit:'за ребёнка 0–3 лет',ageRule:{min:0,max:3,requiresConfirmation:false}},
  {...adult,id:'older',audience:'child',amountMinor:220000,unit:'за ребёнка 4–10 лет',ageRule:{min:4,max:10,requiresConfirmation:false}},
  {...adult,id:'teen',audience:'child',amountMinor:240000,unit:'за ребёнка 11–13 лет',ageRule:{min:11,max:13,requiresConfirmation:true}},
 ];
 for(const locale of locales){
  for(const discount of [false,true]){
   const html=renderCard(tour,false,false,{locale,discount});
   assert.equal((html.match(/class="amount"/g)||[]).length,3);
   assert(html.includes('>'+childAmount(0,locale)+'<'));
   for(const rate of tour.variants[0].rates)assert(html.includes(localizedPriceUnit(rate.unit,locale)));
   assert(html.includes(translateUi('Возрастные условия уточняются',locale)));
  }
 }
});

test('Whole-group and vehicle prices omit child cells and preserve every financial amount/unit',()=>{
 for(const locale of locales){
  for(const [audience,unit] of [['group','за группу'],['vehicle','per vehicle'],['craft','за катер'],['adult','per group']]){
   const tour=paired();Object.assign(tour.variants[0].rates[0],{audience,unit});
   const html=renderCard(tour,false,false,{locale});
   assert(!html.includes('data-card-child-prices'));
   assert(html.includes(childAmount(260000,locale)));
   assert(html.includes(localizedPriceUnit(unit,locale)));
  }
 }
});

test('Long titles and variable availability are retained, not replaced by clipping or title placeholders',()=>{
 for(const locale of locales){
  for(const title of ['One line','A longer excursion name over two lines','A very long excursion title with enough details to exceed three lines at narrow widths','ภาษาไทยชื่อทัวร์ที่ยาวและมีรายละเอียดหลายบรรทัด']){
   const tour=paired();tour.title=title;tour.status='temporarily_unavailable';
   const html=renderCard(tour,true,false,{locale});
   assert(html.includes('<h3>'+title+'</h3>'));
   assert(html.includes(translateUi('Доступность уточняется',locale)));
   assert(html.includes('aria-pressed="true"'));
   assert(html.includes('/tour/'+tour.slug+'?variant='+tour.variants[0].id));
  }
 }
});

test('Expired/mismatched child rates remain unknown, and future/from quotes remain truthful with discount active',()=>{
 for(const locale of locales){
  for(const change of [{validUntil:'2026-10-01'},{currency:'USD'},{optionKey:'not-the-adult-option'},{validFrom:'2027-04-01'}] as Partial<Rate>[]){
   const tour=paired();Object.assign(tour.variants[0].rates[1],change);
   assert(renderCard(tour,false,false,{locale,discount:true}).includes(translateUi('Детская цена уточняется',locale)));
  }
  for(const tour of [cardCases.from,cardCases.future]){
   const before=JSON.stringify(tour),html=renderCard(tour,false,false,{locale,discount:true});
   const price=priceLabel(tour.variants[0].rates,'2026-10-12');
   assert(html.includes(localizedPriceText(price,locale,bottleAmount(price.rate!.amountMinor))));
   assert(html.includes(localizedPriceUnit(price.unit,locale)));
   assert.equal(JSON.stringify(tour),before);
  }
 }
});

test('Card discount styles allow wrapping without changing the default inline presentation',()=>{
 const css=readFileSync('app/components/BottlePrice.module.css','utf8');
 const source=readFileSync('app/components/BottlePrice.tsx','utf8');
 assert(source.includes("layout='inline'"));
 assert(source.includes("if(layout==='card')return"));
 assert(source.includes('<span className={styles.prices} data-bottle-price>'));
 assert(css.includes('.cardPrices {display:grid;grid-template-columns:minmax(0,1fr)'));
 assert(css.includes('.cardPrices .savings {display:flex;align-items:baseline;flex-wrap:wrap'));
 assert(!/\.cardPrices \.(?:current|savings)[^{]*\{[^}]*(?:line-clamp|text-overflow:ellipsis|white-space:nowrap)/.test(css));
});
