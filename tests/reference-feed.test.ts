import test from 'node:test';
import assert from 'node:assert/strict';
import type {CatalogQuery, CatalogResponse, Tour} from '../lib/public/types';
import {createReferenceCatalogController, REFERENCE_PAGE_SIZE, REFERENCE_APPEND_SIZE} from '../app/reference-preview/reference-feed';

function tour(id: number): Tour {
  return {id:`tour-${id}`,slug:`excursion-${id}`,title:`Excursion ${id}`,description:'',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:id,variants:[]};
}
function page(number=1,total=43,ids?:number[],releaseId='published-release'):CatalogResponse {
  const numbers=ids??Array.from({length:Math.max(0,Math.min(REFERENCE_PAGE_SIZE,total-(number-1)*REFERENCE_PAGE_SIZE))},(_,index)=>(number-1)*REFERENCE_PAGE_SIZE+index+1);
  return {releaseId,generation:7,items:numbers.map(tour),total,page:number,pages:Math.ceil(total/REFERENCE_PAGE_SIZE),count:43,destinations:[],facets:{categories:[],durations:[],transports:[],formats:[]}};
}
function deferred<T>() {
  let resolve!:(value:T)=>void, reject!:(reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function harness(initial:CatalogResponse|null=page(),initialQuery:CatalogQuery={}) {
  const calls:{query:CatalogQuery;signal:AbortSignal;response:ReturnType<typeof deferred<CatalogResponse>>}[]=[];
  const feed=createReferenceCatalogController(initial,(query,signal)=>{const response=deferred<CatalogResponse>();calls.push({query,signal,response});return response.promise;},initialQuery);
  return {feed,calls};
}
const ids=(data:CatalogResponse|null)=>data?.items.map(item=>item.id);
async function resolvePages(calls:ReturnType<typeof harness>['calls'],start:number,count:number,total=43) {
  for(let i=start;i<start+count;i++) {
    assert(calls[i],`Missing request ${i}`);
    calls[i].response.resolve(page(calls[i].query.page,total,undefined,calls[i].query.release));
    await Promise.resolve();
  }
}

test('Starts at four, reveals exactly twenty more, then the remaining nineteen without duplicates',async()=>{
  const {feed,calls}=harness(),initial=feed.getSnapshot().data;
  assert.equal(REFERENCE_PAGE_SIZE,4);assert.equal(REFERENCE_APPEND_SIZE,20);
  assert.equal(initial?.items.length,4);assert.equal(calls.length,0);
  const first=feed.loadMore();
  assert.equal(feed.getSnapshot().loadingMore,true);assert.equal(feed.getSnapshot().busy,false);
  assert.equal(feed.getSnapshot().data,initial);
  await resolvePages(calls,0,5);assert.equal(await first,true);
  assert.equal(feed.getSnapshot().data?.items.length,24);assert.equal(feed.getSnapshot().data?.page,6);
  assert.equal(feed.getSnapshot().data?.items[0],initial?.items[0]);
  assert.deepEqual(feed.getSnapshot().lastAppend,{firstNewId:'tour-5',addedCount:20,sequence:1});
  assert.equal(feed.getSnapshot().hasMore,true);
  const second=feed.loadMore();await resolvePages(calls,5,5);assert.equal(await second,true);
  assert.equal(feed.getSnapshot().data?.items.length,43);assert.equal(feed.getSnapshot().data?.page,11);
  assert.deepEqual(feed.getSnapshot().lastAppend,{firstNewId:'tour-25',addedCount:19,sequence:2});
  assert.equal(new Set(ids(feed.getSnapshot().data)).size,43);
  assert.deepEqual(ids(feed.getSnapshot().data),Array.from({length:43},(_,i)=>`tour-${i+1}`));
  assert.equal(feed.getSnapshot().hasMore,false);assert.equal(await feed.loadMore(),false);assert.equal(calls.length,10);
  for(const [i,call] of calls.entries())assert.deepEqual(call.query,{page:i+2,limit:4,release:'published-release'});
});

test('Repeated clicks cannot start a second batch or expose partial pages',async()=>{
  const {feed,calls}=harness(),initial=feed.getSnapshot().data;
  const loading=feed.loadMore();assert.equal(await feed.loadMore(),false);
  await resolvePages(calls,0,2);
  assert.equal(feed.getSnapshot().data,initial);assert.equal(await feed.loadMore(),false);
  assert.equal(calls.length,5);
  await resolvePages(calls,2,3);await loading;
  assert.equal(calls.length,5);assert.equal(feed.getSnapshot().data?.items.length,24);
});

test('All totals use min(total,current+20), preserving the four-card initial state and sorted order',async()=>{
  for(const total of [0,1,4,5,8,12,20,24,25,43,44,45,64,65,100]){
    let requests=0;const feed=createReferenceCatalogController(page(1,total),async query=>{requests++;return page(query.page,total);});
    let shown=Math.min(4,total);assert.equal(feed.getSnapshot().data?.items.length,shown);
    while(feed.getSnapshot().hasMore){await feed.loadMore();shown=Math.min(total,shown+20);assert.equal(feed.getSnapshot().data?.items.length,shown);assert.equal(new Set(ids(feed.getSnapshot().data)).size,shown);}
    assert.equal(shown,total);assert.equal(requests,Math.max(0,Math.ceil(total/4)-1));
    assert.equal(await feed.loadMore(),false);
  }
});

test('A later server-page start appends twenty and preserves its previous-page navigation anchor',async()=>{
  const calls:CatalogQuery[]=[];const query={page:3,category:'sea',sort:'title'};
  const feed=createReferenceCatalogController(page(3,43),async next=>{calls.push(next);return page(next.page,43);},query);
  await feed.loadMore();assert.equal(feed.getSnapshot().firstPage,3);assert.equal(feed.getSnapshot().data?.page,8);
  assert.deepEqual(ids(feed.getSnapshot().data),Array.from({length:24},(_,i)=>`tour-${i+9}`));
  assert(calls.every(call=>call.category==='sea'&&call.sort==='title'&&call.limit===4));
  await feed.loadMore();assert.equal(feed.getSnapshot().data?.items.length,35);assert.equal(feed.getSnapshot().hasMore,false);
});

test('Filter changes abort the whole batch and ignore a late response, then restart at four',async()=>{
  const {feed,calls}=harness(),initial=feed.getSnapshot().data;
  const append=feed.loadMore();await resolvePages(calls,0,2);
  const replace=feed.updateFilters({category:'nature'});
  assert.equal(calls[2].signal.aborted,true);assert.equal(feed.getSnapshot().data,initial);
  assert.equal(feed.getSnapshot().busy,true);assert.equal(feed.getSnapshot().loadingMore,false);
  assert.equal(await feed.loadMore(),false);
  assert.deepEqual(calls[5].query,{category:'nature',page:1,limit:4,release:'published-release'});
  calls[5].response.resolve(page(1,8,[21,22,23,24]));await replace;const applied=feed.getSnapshot();
  calls[2].response.resolve(page(4));assert.equal(await append,false);assert.equal(feed.getSnapshot(),applied);
  assert.deepEqual(ids(applied.data),['tour-21','tour-22','tour-23','tour-24']);assert.equal(applied.lastAppend,null);
  const more=feed.loadMore();assert.equal(calls[6].query.category,'nature');calls[6].response.resolve(page(2,8,[25,26,27,28]));await more;
  assert.equal(feed.getSnapshot().data?.items.length,8);assert.equal(feed.getSnapshot().hasMore,false);
});

test('Filtering after a full expansion resets to four and applies every filter to all following pages',async()=>{
  const calls:CatalogQuery[]=[];
  const feed=createReferenceCatalogController(page(),async query=>{calls.push(query);return page(query.page,query.category?29:43);});
  await feed.loadMore();await feed.loadMore();assert.equal(feed.getSnapshot().data?.items.length,43);
  const filters={category:'sea',destination:'coral',sort:'title',q:'Island',days:'1',transport:'Boat',format:'Group'};
  await feed.updateFilters(filters);assert.equal(feed.getSnapshot().data?.items.length,4);
  await feed.loadMore();assert.equal(feed.getSnapshot().data?.items.length,24);
  assert(calls.slice(10).every(query=>Object.entries(filters).every(([key,value])=>query[key as keyof CatalogQuery]===value)));
  await feed.loadMore();assert.equal(feed.getSnapshot().data?.items.length,29);
  await feed.resetFilters();assert.equal(feed.getSnapshot().data?.items.length,4);assert.deepEqual(feed.getSnapshot().appliedFilters,{});
});

test('A failure in the middle of a batch preserves every card and retry restarts the same batch',async()=>{
  const {feed,calls}=harness(),initial=feed.getSnapshot().data;
  const failed=feed.loadMore();await resolvePages(calls,0,2);calls[2].response.reject(Error('Temporary network error'));
  assert.equal(await failed,false);assert.equal(feed.getSnapshot().data,initial);
  assert.equal(feed.getSnapshot().error,'');assert.equal(feed.getSnapshot().moreError,'Temporary network error');assert.equal(feed.getSnapshot().hasMore,true);
  assert(calls.every(call=>call.signal.aborted));
  const retry=feed.loadMore();assert.deepEqual(calls[5].query,calls[0].query);
  await resolvePages(calls,5,5);assert.equal(await retry,true);
  assert.equal(feed.getSnapshot().data?.items.length,24);assert.equal(new Set(ids(feed.getSnapshot().data)).size,24);
});

test('Stale filter failure cannot overwrite a newer selection; failed filter retry restores four',async()=>{
  const {feed,calls}=harness();
  const first=feed.updateFilters({category:'sea'}),second=feed.updateFilters({category:'nature',destination:'khao-sok'});
  assert.equal(calls[0].signal.aborted,true);calls[1].response.resolve(page(1,2,[21,22]));await second;
  const newest=feed.getSnapshot();calls[0].response.reject(Error('Late failure'));assert.equal(await first,false);assert.equal(feed.getSnapshot(),newest);
  const change=feed.updateFilters({category:'culture'});calls[2].response.reject(Error('Filter failed'));await change;
  assert.equal(feed.getSnapshot().data,newest.data);assert.equal(feed.getSnapshot().error,'Filter failed');assert.equal(await feed.loadMore(),false);
  const retry=feed.retry();assert.deepEqual(calls[3].query,calls[2].query);calls[3].response.resolve(page(1,6,[31,32,33,34]));await retry;
  assert.equal(feed.getSnapshot().data?.items.length,4);assert.equal(feed.getSnapshot().error,'');assert.equal(feed.getSnapshot().lastAppend,null);
});

test('Reset cancels an active batch and unsubscribed listeners receive no further updates',async()=>{
  const {feed,calls}=harness();let updates=0;const unsubscribe=feed.subscribe(()=>updates++);
  const loading=feed.loadMore();const resetting=feed.resetFilters();assert.equal(calls[0].signal.aborted,true);
  calls[0].response.resolve(page(2));await loading;assert.equal(feed.getSnapshot().busy,true);
  calls[5].response.resolve(page());await resetting;assert.equal(feed.getSnapshot().data?.items.length,4);
  unsubscribe();const count=updates;const more=feed.loadMore();await resolvePages(calls,6,5);await more;assert.equal(updates,count);
});

test('Empty and duplicate-only responses stop; duplicate IDs within a batch never repeat cards',async()=>{
  const empty=harness(page(1,0));assert.equal(await empty.feed.loadMore(),false);assert.equal(empty.calls.length,0);
  for(const numbers of [[],[1,2,3,4]]){
    const {feed,calls}=harness();const loading=feed.loadMore();calls[0].response.resolve(page(2,43,numbers));await loading;
    assert.equal(feed.getSnapshot().data?.items.length,4);assert.equal(feed.getSnapshot().hasMore,false);assert.equal(feed.getSnapshot().lastAppend,null);assert.equal(calls.length,5);assert(calls.every(call=>call.signal.aborted));
  }
  const {feed,calls}=harness(page(1,12));const loading=feed.loadMore();calls[0].response.resolve(page(2,12,[4,5,5,6]));await Promise.resolve();
  calls[1].response.resolve(page(3,12,[6,7,7,8]));await loading;
  assert.deepEqual(ids(feed.getSnapshot().data),Array.from({length:8},(_,i)=>`tour-${i+1}`));assert.equal(feed.getSnapshot().hasMore,false);
});

test('Every page is release-pinned and wrong release/page at any point rejects the entire batch',async()=>{
  for(const bad of [page(3,43,undefined,'another-release'),page(1)]){
    const {feed,calls}=harness(),initial=feed.getSnapshot().data;const loading=feed.loadMore();await resolvePages(calls,0,1);
    calls[1].response.resolve(bad);assert.equal(await loading,false);assert.equal(feed.getSnapshot().data,initial);assert(feed.getSnapshot().moreError);
  }
  const {feed,calls}=harness();const replacement=feed.updateFilters({category:'sea',release:'wrong-release',page:42,limit:48,featured:true});
  assert.deepEqual(calls[0].query,{category:'sea',page:1,limit:4,release:'published-release'});calls[0].response.resolve(page());await replacement;
  assert.deepEqual(feed.getSnapshot().filters,{category:'sea'});
});

test('Missing initial data can retry, pin its first release, and then append twenty',async()=>{
  const {feed,calls}=harness(null);assert.equal(feed.getSnapshot().data,null);assert.equal(await feed.loadMore(),false);
  const first=feed.retry();assert.equal(calls[0].query.release,undefined);calls[0].response.resolve(page(1,43,undefined,'new-release'));await first;
  const next=feed.loadMore();assert.equal(calls[1].query.release,'new-release');await resolvePages(calls,1,5);await next;
  assert.equal(feed.getSnapshot().data?.items.length,24);assert.equal(feed.getSnapshot().data?.releaseId,'new-release');
});

test('Cancellation ignores late pages and effect cleanup can resume the same batch',async()=>{
  const {feed,calls}=harness();const canceled=feed.loadMore();await resolvePages(calls,0,1);feed.cancel();
  assert.equal(calls[1].signal.aborted,true);assert.equal(feed.getSnapshot().loadingKind,null);
  const resumed=feed.loadMore();assert.equal(calls[5].query.page,2);calls[1].response.resolve(page(3));assert.equal(await canceled,false);
  assert.equal(feed.getSnapshot().loadingMore,true);await resolvePages(calls,5,5);await resumed;assert.equal(feed.getSnapshot().data?.items.length,24);
});

test('Starts all five pages without a response and preserves order when the last page arrives first',async()=>{
  const {feed,calls}=harness(),initial=feed.getSnapshot().data;
  const loading=feed.loadMore();
  assert.deepEqual(calls.map(call=>call.query.page),[2,3,4,5,6]);
  for(const index of [4,3,2,1])calls[index].response.resolve(page(calls[index].query.page));
  await Promise.resolve();assert.equal(feed.getSnapshot().data,initial);
  calls[0].response.resolve(page(2));assert.equal(await loading,true);
  assert.deepEqual(ids(feed.getSnapshot().data),Array.from({length:24},(_,i)=>`tour-${i+1}`));
});
