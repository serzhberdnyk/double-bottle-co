import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {validatePacket, stageImport, publishRelease, type ImportPacket} from '../lib/server/management';
import {mergeApprovedEight, prepareApprovedEight} from '../lib/server/approved-eight-import';
import {catalog} from '../lib/server/catalog';
import {translationSeed, publishedTranslations, translationReadiness} from '../lib/server/localization';
import {catalogDictionary, translateCatalog} from '../lib/i18n/catalog';
import {validateSplitLocales} from '../lib/server/khaosok-split-locales';
import type {Tour, Destination} from '../lib/public/types';

const read = (path:string) => JSON.parse(readFileSync(path, 'utf8'));
const packet = ():ImportPacket => read('tests/fixtures/sanitized-import-packet.json');
async function fixture() {
  const db = testDatabase();
  const staged = await stageImport(db, packet(), 'synthetic-validator');
  await publishRelease(db, staged.id, 0, 'synthetic-validator');
  return db;
}

test('export contains no private datasets, live identity or populated env files', () => {
  assert.equal(read('.openai/hosting.json').project_id, null);
  for (const path of ['private-import', '.env', '.dev.vars', '.git']) assert.equal(existsSync(path), false, path);
  for (const path of ['content/approved-eight/copy.json','content/catalog-backfill-gen76.json']) assert.deepEqual(read(path), {en:{}, th:{}});
});

test('synthetic public catalog preserves DTO shape, totals, references and import invariants', () => {
  const data = read('tests/fixtures/public-catalog-generation3.json');
  assert.equal(data.total, data.tours.length);
  assert.equal(data.total, 43);
  const p:ImportPacket = {
    schemaVersion:1, complete:true, source:'Synthetic contract test', checkedAt:'2026-01-01', media:[],
    destinations:data.destinations.map((destination:Destination) => {const result={...destination}; delete result.count; return result;}),
    products:data.tours.map((tour:Tour, index:number) => ({...tour, publicationStatus:'published',
      provenance:{sourceId:'synthetic-'+index, source:'Synthetic fixture', checkedAt:'2026-01-01', hash:'synthetic-hash-'+index},
      supplier:{id:'synthetic-supplier', name:'Synthetic supplier', offerId:'synthetic-offer-'+index, raw:{synthetic:true}},
    })),
  };
  assert.equal(validatePacket(p).products, data.total);
  assert.equal(new Set(data.tours.map((tour:Tour) => tour.id)).size, data.total);
  assert.equal(data.facets.categories.reduce((sum:number, row:{count:number}) => sum+row.count, 0), data.total);
});

test('synthetic approved programs use recognized structural keys and retained image files', () => {
  const programs = read('content/approved-eight/programs.json');
  assert.deepEqual(new Set(programs.map((p:{id:string})=>p.id)), new Set(['AT-KS-1D','AT-CITY-AB','AT-KL-SAFARI-1D','AT-TTOA-1D','AT-PNG-SKY','AT-PNG-VIP','AT-SIM-1D','AT-4P-DLX-2D1N']));
  const before = packet(), original = structuredClone(before), result = mergeApprovedEight(before);
  assert.deepEqual(before, original);
  assert.equal(result.packet.products.length, 7);
  assert.equal(result.mapping.length, 9);
  for (const media of result.packet.media) assert.ok(existsSync('public'+media.path), media.path);
  for (const old of before.products) for (const variant of old.variants) {
    assert.deepEqual(result.packet.products.find(p=>p.id===old.id)!.variants.find(v=>v.id===variant.id)!.rates, variant.rates);
  }
});

test('exact provider identity guard rejects a mismatched synthetic source', () => {
  const p = packet(); p.products[0].supplier.id = 'wrong-synthetic-supplier';
  assert.throws(()=>mergeApprovedEight(p), /EXACT_PROVIDER_VARIANT_MISMATCH/);
});

test('synthetic import stages, publishes and repeats without duplicate products or lost variants', async t => {
  const db = await fixture(); t.after(()=>db.sqlite.close());
  const prepared = await prepareApprovedEight(db);
  assert.equal(validatePacket(prepared.packet).products, 7);
  const next = await stageImport(db, prepared.packet, 'synthetic-validator');
  const result = await publishRelease(db, next.id, 1, 'synthetic-validator');
  assert.equal(result.generation, 2);
  const repeated = await prepareApprovedEight(db);
  assert.equal(repeated.packet.products.length, 7);
  assert.equal(repeated.alreadyImported, true);
  assert.equal(new Set(repeated.packet.products.flatMap(p=>p.variants.map(v=>v.id))).size, 9);
  const dto = await catalog(db);
  assert.equal(dto.total, 7);
  assert.ok(!JSON.stringify(dto).includes('Synthetic supplier'));
  assert.ok(dto.items.every(tour=>!('supplier' in tour)&&!('provenance' in tour)));
});

test('synthetic import endpoint preserves auth, origin and optimistic generation guards', async t => {
  const db = await fixture(); t.after(()=>db.sqlite.close());
  Object.assign(globalThis,{__visibilityEnv:{DB:db, ADMIN_EMAILS:'owner@example.invalid'}});
  const route = await import('../app/api/admin/approved-programs/route');
  const url = 'https://example.invalid/api/admin/approved-programs';
  assert.equal((await route.GET(new Request(url))).status, 403);
  const headers = {'oai-authenticated-user-id':'synthetic-owner','oai-authenticated-user-email':'owner@example.invalid','content-type':'application/json'};
  assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://other.invalid'},body:'{}'}))).status,403);
  const preview = await route.GET(new Request(url,{headers})); assert.equal(preview.status,200);
  const value = await preview.json() as {state:{generation:number;release_id:string};digest:string};
  const body = {generation:value.state.generation,releaseId:value.state.release_id,digest:value.digest};
  assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://example.invalid'},body:JSON.stringify({...body,generation:99})}))).status,409);
  assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://example.invalid'},body:JSON.stringify(body)}))).status,200);
});

test('empty export translation maps retain built-in dictionaries and published DB overrides only', async t => {
  const db = testDatabase(); t.after(()=>db.sqlite.close());
  for (const locale of ['en','th'] as const) {
    assert.deepEqual(translationSeed(locale),catalogDictionary(locale));
    assert.ok(Object.keys(translationSeed(locale)).length>0);
  }
  const source = 'Уникальная синтетическая фраза 987654';
  db.sqlite.prepare('INSERT INTO catalog_localizations VALUES (?,?,?,?,?,?,?)').run('en',source,'Draft synthetic','Published synthetic',1,'2026-01-01','synthetic-validator');
  assert.equal((await publishedTranslations(db,'en'))[source],'Published synthetic');
  assert.equal((await publishedTranslations(db,'th'))[source],undefined);
});

test('missing synthetic translations remain unready instead of an implicit Russian fallback', () => {
  const value = {id:'synthetic-language-check',title:'Уникальная синтетическая фраза 987654'};
  const dictionaries = {en:translationSeed('en'), th:translationSeed('th')};
  const readiness = translationReadiness(value,dictionaries);
  assert.equal(readiness.en.ready,false); assert.equal(readiness.th.ready,false);
  assert.deepEqual(readiness.en.missing,[value.title]);
  assert.deepEqual(translateCatalog(value,'ru'),{value,missing:[]});
  assert.deepEqual(translateCatalog(value,'en',{[value.title]:'Synthetic exact translation'}).missing,[]);
});

test('invalid enum and foreign keys are rejected rather than weakening validation for fixtures', () => {
  const invalid = packet(); Object.assign(invalid.products[0],{status:'synthetic_invalid'});
  assert.throws(()=>validatePacket(invalid),/VALIDATION/);
  const missingDestination=packet(); missingDestination.products[0].variants[0].stops=[{destinationId:'absent-synthetic',sequence:1,visitType:'landing',required:false,note:''}];
  assert.throws(()=>validatePacket(missingDestination),/VALIDATION/);
});

test('synthetic split translations retain exact source hashes and required provenance enum', async () => {
  const copy = read('tests/fixtures/vip-localized-content.json');
  const input = {sourceHash:copy.sourceHashes,en:copy.en,th:copy.th,provenance:{method:copy.provenance.method,sourceReferences:copy.provenance.sourceReferences,review:copy.provenance.review}};
  await validateSplitLocales(copy.ru,input);
  await assert.rejects(()=>validateSplitLocales({...copy.ru,title:copy.ru.title+' '},input),/SPLIT_LOCALE_SOURCE_CONFLICT/);
});


test('public export imports all sixteen DEMO placeholders with truthful metadata and new-product alt text', () => {
  const before=packet(), result=mergeApprovedEight(before);
  const media=result.packet.media.filter(item=>item.path.startsWith('/media/atime-'));
  assert.equal(media.length,16);
  assert.equal(new Set(media.map(item=>item.path)).size,16);
  for(const item of media){
    assert.equal(item.license,'Synthetic DEMO placeholder for this public source export; not an operator brochure');
    assert.equal(item.attribution,'Original code-generated DEMO placeholder; contains no operator artwork');
    assert.match(item.sourceUrl,/^synthetic-demo-placeholder \/ AT-/);
    const data=readFileSync('public'+item.path);
    assert.equal(data.subarray(0,3).toString('hex'),'ffd8ff');
    assert.ok(data.length>1000);
  }
  const newProducts=result.packet.products.filter(item=>!before.products.some(old=>old.id===item.id));
  assert.equal(newProducts.length,4);
  for(const item of newProducts)assert.equal(item.imageAlt,'DEMO: синтетический образец: '+item.title);
});
