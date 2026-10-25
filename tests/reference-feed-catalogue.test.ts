import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {catalog} from '../lib/server/catalog';
import {priceLabel} from '../lib/public/types';
import {createReferenceCatalogController} from '../app/reference-preview/reference-feed';

test('Same-page feed consumes all and only 43 published catalogue products, with no invented Phi Phi price',async()=>{
  const source=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const db=testDatabase();const release=await stageImport(db,source,'feed-test');await publishRelease(db,release.id,0,'feed-test');
  const initial=await catalog(db,{limit:4});assert.equal(initial.items.length,4);assert.equal(initial.total,43);
  const feed=createReferenceCatalogController(initial,async(query)=>catalog(db,query));
  const firstIds=initial.items.map(item=>item.id);
  while(feed.getSnapshot().hasMore)await feed.loadMore();
  const result=feed.getSnapshot().data!;assert.equal(result.items.length,43);
  assert.deepEqual(result.items.slice(0,4).map(item=>item.id),firstIds);
  assert.equal(new Set(result.items.map(item=>item.id)).size,43);
  const all=await catalog(db,{limit:48});assert.deepEqual(result.items.map(item=>item.id),all.items.map(item=>item.id));
  const phi=result.items.find(item=>item.slug==='phi-phi-paradise')!;assert(phi);
  assert.equal(phi.status,'on_request');assert.equal(phi.variants[0].rates.length,0);
  assert.equal(priceLabel(phi.variants[0].rates).text,'По запросу');
  assert(!/"(?:supplier|commission|raw|sourceId)"\s*:/.test(JSON.stringify(result.items)));
});
