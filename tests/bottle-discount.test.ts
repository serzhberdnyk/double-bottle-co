import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleAmount,bottlePriceText,bottleInquiryText} from '../lib/public/bottle-discount';
import {priceLabel,type Rate,type Variant} from '../lib/public/types';
import {rateSelection} from '../lib/public/pricing';

const adult:Rate={id:'adult',amountMinor:125000,currency:'THB',audience:'adult',unit:'за взрослого',validFrom:'2026-01-01',validUntil:'2027-01-01',conditions:'',supplements:['Трансфер — по запросу']};
const child:Rate={...adult,id:'child',amountMinor:110000,audience:'child',unit:'за ребёнка 3–10 лет'};
const variant={rates:[adult,child],priceOptions:[],earliestDate:null,status:'on_request'} as unknown as Variant;
const plain=(text:string)=>text.replace(/\u00a0|\u202f/g,' ');

test('3% uses original minor units, including fractional baht; rendering is repeatable',()=>{
  assert.deepEqual([260000,250000,125000,700000,1001,1].map(bottleAmount),[252200,242500,121250,679000,971,1]);
  const before=JSON.stringify(variant),selection=rateSelection(variant.rates,'2026-10-24');
  const price=priceLabel(variant.rates,'2026-10-24');
  assert.equal(plain(bottlePriceText(price)),'1 212,5 ฿');
  assert.equal(bottlePriceText(price),bottlePriceText(price));
  assert.equal(JSON.stringify(variant),before);
  assert.deepEqual(rateSelection(variant.rates,'2026-10-24'),selection);
});

test('from, future season and currency remain intact; missing prices stay on request',()=>{
  const rates=[adult,{...adult,id:'other',amountMinor:250000}];
  const p=priceLabel(rates,'2026-10-24');
  assert.equal(plain(bottlePriceText(p)),'от 1 212,5 ฿');
  const future=priceLabel([{...adult,validFrom:'2027-01-01',validUntil:null,currency:'USD'}],'2026-10-24');
  assert.equal(plain(bottlePriceText(future)),'1 212,5 USD');
  assert.match(future.unit,/^с 01\.01\.2027/);
  assert.equal(bottlePriceText(priceLabel([],'2026-10-24')),'По запросу');
});

test('request text uses discounted adult and child units without guessing ages or supplements',()=>{
  const note=plain(bottleInquiryText(variant,null,'2026-10-24',2,1,'7'));
  assert.match(note,/1 250 ฿ → 1 212,5 ฿ · за взрослого/);
  assert.match(note,/1 100 ฿ → 1 067 ฿ · за ребёнка/);
  assert.match(note,/Стоимость группы: 3 600 ฿ → 3 492 ฿/);
  assert.match(note,/Доплаты не включены/);
  assert.match(bottleInquiryText(variant,null,'2026-10-24',2,1,''),/стоимость группы — по запросу/);
  assert.match(bottleInquiryText({...variant,rates:[]},null,'2026-10-24',2,1,'7'),/по запросу/);
  assert.doesNotMatch(bottleInquiryText({...variant,rates:[]},null,'2026-10-24',2,1,'7'),/0 ฿|→/);
  assert.match(bottleInquiryText(variant,null,'2027-02-01',2,0,''),/по запросу/);
  assert.equal(adult.supplements[0],'Трансфер — по запросу');
});
