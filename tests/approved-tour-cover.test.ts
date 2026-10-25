import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {approvedTourCover} from '../lib/public/tour-cover';
import {responsiveMedia} from '../lib/public/media';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {catalog,product} from '../lib/server/catalog';

const approved={id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise'};
test('Approved illustration is scoped to both canonical product ID and slug',()=>{
  const cover=approvedTourCover(approved);assert(cover);assert.equal(cover.kind,'illustration');assert(cover.alt.startsWith('Иллюстрация'));
  assert.equal(approvedTourCover({...approved,id:'another'}),null);
  assert.equal(approvedTourCover({...approved,slug:'another'}),null);
  assert.equal(approvedTourCover({id:'another',slug:'another'}),null);
});

test('Illustrated cover keeps approved source masters and lightweight responsive assets',()=>{
  const cover=approvedTourCover(approved)!;
  assert.deepEqual([responsiveMedia[cover.src].width,responsiveMedia[cover.src].height],[1600,1067]);
  for(const width of [480,960,1600]){
    const path=`/media/covers/phi-phi-catamaran-approved-${width}.webp`;
    assert(responsiveMedia[cover.src].srcSet.includes(`${path} ${width}w`));
    assert(existsSync('public'+path));assert(statSync('public'+path).size<200_000);
  }
  assert(existsSync('docs/identity/elysiam-phi-phi-approved.svg'));
  assert(existsSync('docs/identity/elysiam-phi-phi-approved.png'));
  const component=readFileSync('app/components/TourImage.tsx','utf8');
  assert(component.includes("objectFit:'contain'"));assert(component.includes("transform:'none'"));
  assert(!readFileSync('app/components/CompactTourDetail.tsx','utf8').includes('Иллюстрация направления.'));
  assert(readFileSync('app/components/CompactTourDetail.module.css','utf8').includes('aspect-ratio: 3 / 2'));
});

test('Presentation override preserves all source photos, catalog facts, rates and program identities',async()=>{
  const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const release=await stageImport(db,packet,'approved-cover-test');await publishRelease(db,release.id,0,'approved-cover-test');
  const all=await catalog(db,{limit:48});assert.equal(all.total,43);
  assert.equal(all.items.filter(item=>approvedTourCover(item)).length,43);
  const result=await product(db,approved.slug);assert(result);
  const before=JSON.stringify(result.tour);const cover=approvedTourCover(result.tour);assert(cover);
  assert.equal(JSON.stringify(result.tour),before);assert.equal(result.tour.image,'/media/maya-bay-project.webp');
  assert(existsSync('public'+result.tour.image));assert.equal(result.tour.variants[0].rates.length,0);
  assert.equal(result.tour.variants[0].itinerary.length,9);
});

test('Each approved Bond program has its own exact cover',()=>{
  const target={id:'p_94abb867f3935f649b93980e',slug:'james-bond-catamaran'};
  const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('james-bond-catamaran-approved'));
  for(const tour of [
    {id:'p_5d1b6411a63e5abfa796fa5d',slug:'james-bond-yao'},
    {id:'p_69deff34bc235a65b68b2bec',slug:'james-bond-cave'},
    {id:'p_0f509fda2ef15b11a629c83a',slug:'glowing-plankton'},
    {...target,id:'other'}, {...target,slug:'other'},
  ]){const other=approvedTourCover(tour);if(tour.id==='other'||tour.slug==='other')assert.equal(other,null);else {assert(other);assert.notEqual(other.src,cover.src);}}
});

test('Every unapproved tour gets the same honest neutral placeholder, including no-photo tours',async()=>{
  const {tourCover}=await import('../lib/public/tour-cover');
  assert.equal(tourCover(approved).src,approvedTourCover(approved)!.src);
  const placeholder=tourCover({id:'other',slug:'other'});
  assert(placeholder.src.includes('illustration-coming-soon'));assert(placeholder.alt.includes('готовится'));
  assert(!placeholder.alt.includes('генерируется'));assert.equal(placeholder.kind,'illustration');
  const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const release=await stageImport(db,packet,'cover-placeholder-test');await publishRelease(db,release.id,0,'cover-placeholder-test');
  const all=await catalog(db,{limit:48});const before=JSON.stringify(all.items);
  assert.equal(all.items.filter(item=>tourCover(item).src===placeholder.src).length,0);
  const missing=all.items.filter(item=>!item.image);assert(missing.length>0);
  assert(missing.every(item=>tourCover(item).kind==='illustration'));assert.equal(JSON.stringify(all.items),before);
  const host=readFileSync('app/components/CatalogUI.tsx','utf8');assert(host.includes('{tourCover(tour)?<figure>'));assert(host.includes('Иллюстрация экскурсии готовится.'));
  assert(readFileSync('app/globals.css','utf8').includes('.tour-hero img[data-media-kind="illustration"]{height:auto;aspect-ratio:3/2;object-fit:contain}'));
  for(const prefix of ['james-bond-catamaran-approved','illustration-coming-soon'])for(const width of [480,960,1600]){
    const path=`/media/covers/${prefix}-${width}.webp`;assert(existsSync('public'+path));assert(statSync('public'+path).size<160_000);
    assert(responsiveMedia[`/media/covers/${prefix}-1600.webp`].srcSet.includes(`${path} ${width}w`));
  }
});


test('Racha Coral cover is distinct from the Racha Coral Maiton itinerary',()=>{
  const cover=approvedTourCover({id:'p_da928396eab85462af9e1007',slug:'racha-coral'});assert(cover);assert(cover.src.includes('racha-coral-approved'));
  assert.notEqual(approvedTourCover({id:'p_60be3126924352e2a4e4c2e4',slug:'racha-coral-maiton'})?.src,cover.src);
  assert.equal(approvedTourCover({id:'p_da928396eab85462af9e1007',slug:'racha-coral-maiton'}),null);
  for(const w of [480,960,1600])assert(existsSync(`public/media/covers/racha-coral-approved-${w}.webp`));
});


test('Cover manifest contains 43 unique canonical programs with bounded responsive assets',()=>{
 const manifest=JSON.parse(readFileSync('docs/identity/cover-manifest.json','utf8'));
 assert.equal(manifest.covers.length,43);assert.equal(new Set(manifest.covers.map((x:any)=>x.slug)).size,43);
 for(const item of manifest.covers){
  const cover=approvedTourCover({id:item.productId,slug:item.slug});assert(cover);assert(cover.alt.startsWith('Иллюстрация'));
  assert.equal(approvedTourCover({id:item.productId,slug:'wrong'}),null);
  assert.equal(approvedTourCover({id:'wrong',slug:item.slug}),null);
  assert(existsSync(item.sourcePng));assert(existsSync(item.sourceSvg));
  for(const asset of item.webAssets){assert(existsSync(asset.path));assert(statSync(asset.path).size<200_000);}
  assert(responsiveMedia[cover.src].srcSet.includes('480w'));
 }
});


test('Approved Elephant Beach uses the reviewed replacement, not withdrawn artwork',()=>{
 assert(approvedTourCover({id:'p_e10dd111dbf35714b2b24e05',slug:'elephant-spa'})?.src.includes('elephant-spa-option-b-approved'));
});


test('Only individually approved artworks remain mapped; withdrawn revisions stay unused',()=>{
 const manifest=JSON.parse(readFileSync('docs/identity/cover-manifest.json','utf8'));
 for(const slug of ['eleven-islands','james-bond-catamaran','jet-ski-south','khao-sok','krabi-sunset','phi-phi-fishing','phi-phi-paradise','phi-phi-racha-party','phi-phi-sunrise','racha-coral','rafting-atv','similan-early'])assert(manifest.covers.some((x:any)=>x.slug===slug));
 assert.equal(manifest.withdrawnCovers.length,5);
 for(const item of manifest.withdrawnCovers){const cover=approvedTourCover({id:item.productId,slug:item.slug});if(['similan-early','khao-sok','jet-ski-south','rafting-atv'].includes(item.slug))assert(cover?.src.includes('approved-v2'));else assert(cover?.src.includes('elephant-spa-option-b-approved'));assert(!item.webAssets.some((a:any)=>a.path==='public'+cover?.src));}
});


test('Similan revision2 is scoped to the individually approved canonical program',()=>{
 const target={id:'p_dd70e1051d36596481a18438',slug:'similan-early'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('similan-early-approved-v2'));
 assert(cover.alt.includes('снорклинга'));
 for(const slug of ['similan-lazy','similan-diving','other'])assert.equal(approvedTourCover({...target,slug}),null);
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
});


test('Khao Sok revision2 is scoped to the approved canonical program, not Cheow Lan day',()=>{
 const target={id:'p_f60658ace81d54048d0d6a8a',slug:'khao-sok'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('khao-sok-approved-v2'));
 assert(cover.alt.includes('плавучие бунгало'));
 assert.equal(approvedTourCover({...target,slug:'cheow-lan-day'}),null);
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
});


test('Jet Ski South revision2 is scoped to the approved southern program only',()=>{
 const target={id:'p_bb216414a1755c4f8b80c6b3',slug:'jet-ski-south'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('jet-ski-south-approved-v2'));
 assert(cover.alt.includes('мангровый берег'));
 assert.equal(approvedTourCover({...target,slug:'jet-ski-north'}),null);
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
});


test('Rafting ATV revision2 is scoped only to its individually approved canonical program',()=>{
 const target={id:'p_584a6bc1fa8c52f38ed26287',slug:'rafting-atv'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('rafting-atv-approved-v2'));
 assert(cover.alt.includes('шлемах'));
 assert.equal(approvedTourCover({...target,slug:'khao-lak-safari'}),null);
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
});


test('Eleven Islands approval is scoped to its exact canonical tour',()=>{
 const target={id:'p_9a4bfa93f43f5a378632d1ff',slug:'eleven-islands'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('eleven-islands-approved'));
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
 assert.equal(approvedTourCover({...target,slug:'wrong'}),null);
});


test('Krabi Sunset approval is scoped to its exact canonical tour',()=>{
 const target={id:'p_0344572d0f9b559aa69f76a3',slug:'krabi-sunset'};
 const cover=approvedTourCover(target);assert(cover);assert(cover.src.includes('krabi-sunset-approved'));
 assert.equal(approvedTourCover({...target,id:'wrong'}),null);
 assert.equal(approvedTourCover({...target,slug:'wrong'}),null);
});
