import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {catalog} from '../lib/server/catalog';
import {catalogFilterOptions} from '../app/reference-preview/catalog-filter-options';
import {createReferenceCatalogController} from '../app/reference-preview/reference-feed';

async function published(){const db=testDatabase();const release=await stageImport(db,JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket,'simple-search');await publishRelease(db,release.id,0,'simple-search');return db;}
test('Unicode search covers all published programmes, destination names and punctuation',async()=>{
 const db=await published();try{
  const all=await catalog(db,{limit:48});assert.equal(all.items.length,43);
  const lower=await catalog(db,{q:'пхи пхи',limit:48});const upper=await catalog(db,{q:'ПХИ-ПХИ',limit:48});
  assert(lower.total>4);assert.deepEqual(lower.items,upper.items);
  assert(lower.items.some(tour=>!all.items.slice(0,4).some(first=>first.id===tour.id)));
  const folded=await catalog(db,{q:'ночевкой',limit:48});assert(folded.total>0);assert(folded.items.some(tour=>tour.title.includes('ночёвкой')));
  assert((await catalog(db,{q:'рача',limit:48})).total>0);
  assert.equal((await catalog(db,{q:'несуществующийпоиск'})).total,0);
  const category=await catalog(db,{category:'sea',q:'пхи пхи',limit:48});assert(category.items.every(item=>item.category==='sea'));assert(category.total>0);
  const feed=createReferenceCatalogController(all,next=>catalog(db,next));await feed.updateFilters({q:'пхи пхи',category:'sea'});
  assert(feed.getSnapshot().data!.items.length<=4);while(feed.getSnapshot().hasMore)await feed.loadMore();
  assert.deepEqual(feed.getSnapshot().data!.items,category.items);
  assert.deepEqual(catalogFilterOptions(all.facets).map(item=>item.id),['sea','nature','adventure','culture','evening','beyond']);
  assert.equal(all.facets.categories.reduce((sum,item)=>sum+item.count,0),43);
 }finally{db.sqlite.close();}
});
test('The compact catalogue removes the old visible section heading and technical form',()=>{
 const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
 assert(!home.includes('copy.selectionEyebrow'));assert(!home.includes('copy.selectionTitle'));assert(!home.includes('copy.selectionIntroduction'));
 assert(home.includes('id="selected"'));assert(home.includes('id="selection-heading" className={styles.visuallyHidden}'));
 const source=readFileSync('app/reference-preview/HomeCatalogFilters.tsx','utf8');
 assert(!source.includes('<details'));assert(!source.includes('<summary'));assert(!source.includes('name="days"'));assert(!source.includes('name="sort"'));
 assert(source.includes('onCompositionEnd'));assert(source.includes("event.key === 'Escape'"));assert(source.includes("'popstate'"));
 assert.equal((source.match(/<select /g)||[]).length,1);
});


test('Tactile submit preserves native search semantics, keyboard submission and reduced motion',()=>{
 const source=readFileSync('app/reference-preview/HomeCatalogFilters.tsx','utf8');
 assert(source.includes('onSubmit={submit}'));assert(source.includes('type="submit" className={styles.catalogSubmit}'));
 assert(source.includes('event.preventDefault(); apply(search)'));assert(source.includes('timer.current = setTimeout'));
 const css=readFileSync('app/reference-preview/reference.module.css','utf8');
 assert(css.includes('.catalogSubmit:active'));assert(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert(css.includes('min-width:46px;height:46px'));assert(css.includes('.catalogSubmit>span'));
});
