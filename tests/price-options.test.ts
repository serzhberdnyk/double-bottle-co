import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,promiseFingerprint,compatibility,type ImportPacket} from '../lib/server/management';
import {product} from '../lib/server/catalog';
import {saveInquiry} from '../lib/server/inquiries';
import {selectPriceOption,publicQuote,displayRates,rateSelection,publicRateNotes} from '../lib/public/pricing';
import {priceLabel,type Rate,type Variant,type PriceOption} from '../lib/public/types';
import {exportBackup,validatedBackupTables} from '../lib/server/backup';
const date='2026-10-20';
const option:PriceOption={key:'standard',label:'Стандарт',serviceDateFrom:'2026-10-15',serviceDateUntil:'2027-05-15',conditions:['Выезды в сезон'],supplements:['Трансфер по запросу']};
const adult:Rate={id:'adult',optionKey:'standard',amountMinor:200000,currency:'THB',unit:'за взрослого',audience:'adult',validFrom:'2026-10-15',validUntil:'2027-10-14',conditions:'',supplements:[]};
const child:Rate={...adult,id:'child',audience:'child',amountMinor:150000,unit:'за ребёнка 4–11 лет'};
const fresh=()=>JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
function variant(){return {...fresh().products.find(p=>p.slug==='racha-coral')!.variants[0],priceOptions:[option,{...option,key:'comfort',label:'Комфорт'}],rates:[adult,child,{...adult,id:'comfort-adult',optionKey:'comfort',amountMinor:250000}]} as Variant;}
test('Explicit invalid option is empty; selected options never pool commercial rates',()=>{
 const v=variant();assert.equal(selectPriceOption(v).option?.key,'standard');assert.equal(selectPriceOption(v,'bogus').option,null);assert.equal(selectPriceOption(v,'bogus').variant.rates.length,0);
 assert.equal(selectPriceOption(v,'comfort').variant.rates.length,1);assert.equal(publicQuote(v.rates,date,2,0).totalMinor,null);
 const selected=selectPriceOption(v,'standard');assert.equal(publicQuote(selected.variant.rates,date,2,0,'',selected.option).totalMinor,400000);
});
test('Child totals require exact eligible ages; unknown, height and diving admission stay on request',()=>{
 const quote=(ages:string,rate=child,count=1)=>publicQuote([adult,rate],date,2,count,ages,option).totalMinor;
 assert.equal(quote('5'),550000);assert.equal(quote('5 и 9 лет',child,2),700000);
 for(const ages of ['', '3','12','5.9','5 9','пять','5,9'])assert.equal(quote(ages),null,ages);
 assert.equal(quote('5',{...child,unit:'за ребёнка'}),null);
 assert.equal(quote('5',{...child,unit:'за ребёнка ростом 101–140 см'}),null);
 assert.equal(quote('5',{...child,conditions:'Допуск к погружениям согласуется отдельно'}),null);
});
test('Craft, role and season cannot produce passenger-multiplied or summer totals',()=>{
 for(const audience of ['group','all'])for(const adults of [1,2,8])assert.equal(publicQuote([{...adult,audience}],date,adults,0,'',option).totalMinor,null);
 assert.equal(publicQuote([adult], '2027-06-01',2,0,'',option).totalMinor,null);
 assert.equal(publicQuote([adult], '2026-10-14',2,0,'',option).totalMinor,null);
 const v=selectPriceOption(variant(),'standard').variant;
 assert.equal(displayRates(v)[0].validUntil,'2027-05-15');assert.equal(priceLabel(displayRates(v),'2027-06-01').text,'По запросу');
 assert(priceLabel(displayRates(v),'2026-10-12').unit.startsWith('с 15.10.2026'));
 assert(publicRateNotes(v,option).supplements.includes('Трансфер по запросу'));
});
test('Price option promises include conditions, supplements and service dates',()=>{
 const v=variant(),promised=promiseFingerprint(v);for(const field of ['conditions','supplements','serviceDateUntil'] as const){const changed=structuredClone(v);(changed.priceOptions![0] as any)[field]=field==='serviceDateUntil'?'2027-04-01':['Изменено'];assert.equal(compatibility(promised,promiseFingerprint(changed)).compatible,false);}
 const legacy=variant();delete legacy.priceOptions;assert.equal(compatibility(promiseFingerprint(legacy),promiseFingerprint(legacy)).compatible,true);
});
test('Legacy backup accepts only additive nullable option_key, rejecting duplicate tables or unknown fields',async()=>{
 const db=testDatabase();try{const backup=await exportBackup(db);assert.equal(validatedBackupTables(backup).length,backup.tables.length);
 const legacy=structuredClone(backup),table=legacy.tables.find(t=>t.name==='catalog_public_rates')!;table.columns=table.columns.filter(c=>c!=='option_key');table.rows=[Object.fromEntries(table.columns.map(c=>[c,null]))] as any;
 assert.equal(validatedBackupTables(legacy).find((t:any)=>t.name==='catalog_public_rates').rows[0].option_key,null);
 const broken=structuredClone(legacy);broken.tables[0]=broken.tables[1];assert.throws(()=>validatedBackupTables(broken),/INVALID_BACKUP_TABLE/);
 table.columns.push('unexpected');assert.throws(()=>validatedBackupTables(legacy),/INVALID_BACKUP_TABLE/);
 }finally{db.sqlite.close();}
});
test('Inquiry validates option and service season and records selected public terms',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-19T00:00:00Z')});
 const db=testDatabase();try{const packet=fresh(),target=packet.products.find(p=>p.slug==='racha-coral')!;target.variants[0]=variant();const staged=await stageImport(db,packet,'price-option-test');await publishRelease(db,staged.id,0,'price-option-test');
 const data=(await product(db,'racha-coral'))!,v=data.tour.variants[0],selected=selectPriceOption(v,'standard');
 const body={productId:data.tour.id,variantId:v.id,revisionId:v.revisionId,releaseId:data.releaseId,priceOptionKey:'standard',date,adults:2,children:1,childrenAges:'5',name:'QA',contact:'qa@example.invalid',note:'',consent:true,expectedRates:rateSelection(selected.variant.rates,date)};
 for(const key of [undefined,'bogus'])await assert.rejects(saveInquiry(db,{...body,priceOptionKey:key},'test-owner','invalid-'+String(key),'ip'),/INVALID_PRICE_OPTION/);
 await assert.rejects(saveInquiry(db,{...body,date:'2027-06-01'},'test-owner','wrong-season','ip'),/INVALID_DATE/);
 const saved=await saveInquiry(db,body,'test-owner','valid-option','ip');const row=db.sqlite.prepare('SELECT snapshot_json FROM operations_inquiries WHERE id=?').get(saved.id) as any;const snapshot=JSON.parse(row.snapshot_json);
 assert.equal(snapshot.publicTotalMinor,550000);assert.equal(snapshot.selectedOptions[0].key,'standard');assert.equal(snapshot.selectedOptions[0].serviceDateUntil,'2027-05-15');assert.deepEqual(snapshot.selectedOptions[0].supplements,option.supplements);
 }finally{db.sqlite.close();}
});
