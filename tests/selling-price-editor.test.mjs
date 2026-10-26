import test from 'node:test';import assert from 'node:assert/strict';import {sellingMinorUnits,newSellingRateSchema,resolveNewSellingRate,previewSellingRates} from '../lib/public/selling-price-editor.ts';
import {validRates} from '../lib/public/types.ts';
import {displayRates,publicQuote} from '../lib/public/pricing.ts';
test('empty means on request, zero is invalid and decimal parsing is exact',()=>{assert.equal(sellingMinorUnits(' '),null);assert.equal(sellingMinorUnits('123,45'),12345);assert.equal(sellingMinorUnits('1.01'),101);for(const s of ['0','0.00','-1','1e3','1.001','NaN'])assert.throws(()=>sellingMinorUnits(s));});
test('new prices require metadata and real ordered dates',()=>{const r={audience:'child',amountMinor:100,currency:'THB',unit:'child, age confirmed',validFrom:'2026-01-01',validUntil:null,conditions:''};assert(newSellingRateSchema.safeParse(r).success);for(const x of [{validFrom:'2026-02-30'},{validUntil:'2025-12-31'},{unit:''},{amountMinor:0},{currency:'USD'}])assert(!newSellingRateSchema.safeParse({...r,...x}).success);});
test('ordinary selling prices need no date input and have no expiry',()=>{
 const input={audience:'adult',amountMinor:123456,currency:'THB',unit:'per adult',conditions:''};
 const parsed=newSellingRateSchema.parse(input),rate={...resolveNewSellingRate(parsed,'2026-10-25'),id:'new',supplements:[]};
 assert.equal(parsed.validFrom,undefined);assert.equal(rate.validFrom,'2026-10-25');assert.equal(rate.validUntil,null);
 assert.equal(validRates([rate],'2026-10-24').length,0);
 assert.equal(publicQuote([rate],'2026-10-25',2,0).totalMinor,246912);
 assert.equal(publicQuote([rate],'2036-10-25',1,0).totalMinor,123456);
 assert(!newSellingRateSchema.safeParse({...input,validUntil:'2026-12-31'}).success);
});
test('editing a price does not activate future or expired legacy rates, or change service dates',()=>{
 const base={id:'future',audience:'adult',amountMinor:100,currency:'THB',unit:'person',conditions:'',supplements:[],validFrom:'2027-01-01',validUntil:null};
 const expired={...base,id:'expired',validFrom:'2026-01-01',validUntil:'2026-01-31'};
 const variant={rates:[base,expired]};
 const rates=previewSellingRates(variant,{rates:[{id:'future',amountMinor:200},{id:'expired',amountMinor:300}]});
 assert.deepEqual(rates.map(r=>[r.validFrom,r.validUntil]),[['2027-01-01',null],['2026-01-01','2026-01-31']]);
 assert.equal(validRates(rates,'2026-10-25').length,0);
 assert.deepEqual(resolveNewSellingRate(expired,'2026-10-25'),expired);
 const dated={...variant,rates:[{...base,optionKey:'season',validFrom:'2026-10-25'}],priceOptions:[{key:'season',serviceDateFrom:'2027-01-01',serviceDateUntil:'2027-01-31'}]};
 assert.equal(validRates(displayRates(dated),'2026-10-25').length,0);
 assert.equal(validRates(displayRates(dated),'2027-02-01').length,0);
});

import {translateCatalog} from '../lib/i18n/catalog.ts';
test('RU EN TH share the same numeric price and identities',()=>{const rate={id:'public-rate',audience:'adult',amountMinor:123456,currency:'THB',unit:'за взрослого',conditions:'',supplements:[]};for(const locale of ['ru','en','th']){const translated=translateCatalog(rate,locale,{'за взрослого':locale==='en'?'per adult':'ต่อผู้ใหญ่'}).value;assert.equal(translated.amountMinor,123456);assert.equal(translated.id,rate.id);assert.equal(translated.currency,'THB');}});
