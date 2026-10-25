import test from 'node:test';
import assert from 'node:assert/strict';
import type {CatalogQuery, CatalogResponse, Tour} from '../lib/public/types';
import {createReferenceCatalogController, type ReferenceCatalogRequest} from '../app/reference-preview/reference-feed';
import {createReferenceNavigation, type HistoryPort} from '../app/reference-preview/reference-navigation';

const origin = 'https://example.invalid';

function tour(id: string): Tour {
  return {id, slug: id, title: id, description: '', category: 'sea', image: null, imageAlt: '', status: 'on_request', featuredRank: 1, variants: []};
}

function page(number = 1, total = 43, itemIds?: string[]): CatalogResponse {
  const ids = itemIds ?? Array.from({length: Math.max(0, Math.min(4, total - (number - 1) * 4))}, (_, index) => `tour-${(number - 1) * 4 + index + 1}`);
  return {releaseId: 'published-release', generation: 1, items: ids.map(tour), total, page: number, pages: Math.ceil(total / 4), count: 43, destinations: [], facets: {categories: [], durations: [], transports: [], formats: []}};
}

type Entry = {url: string; state: Record<string, unknown>};
function historyPort(href = '/#selected') {
  const entries: Entry[] = [{url: new URL(href, origin).href, state: {framework: 'preserved'}}];
  const listeners = new Set<() => void>();
  let index = 0;
  const port: HistoryPort = {
    url: () => entries[index].url,
    state: () => structuredClone(entries[index].state),
    push(state, href) {
      entries.splice(index + 1);
      entries.push({state: structuredClone(state), url: new URL(href, entries[index].url).href});
      index++;
    },
    replace(state, href) {
      entries[index] = {state: structuredClone(state), url: new URL(href, entries[index].url).href};
    },
    onPop(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  function move(delta: number) {
    assert(index + delta >= 0 && index + delta < entries.length, 'Requested history entry exists');
    index += delta;
    for (const listener of listeners) listener();
  }
  return {port, entries, back: () => move(-1), forward: () => move(1), url: () => new URL(port.url())};
}

function harness(initial = page(), query: CatalogQuery = {}, href = '/#selected', onlyFavorites = false) {
  const calls: {query: CatalogQuery; signal: AbortSignal; resolve: (data: CatalogResponse) => void; reject: (error: Error) => void}[] = [];
  const request: ReferenceCatalogRequest = (query, signal) => new Promise((resolve, reject) => calls.push({query, signal, resolve, reject}));
  const feed = createReferenceCatalogController(initial, request, query);
  const history = historyPort(href);
  const navigation = createReferenceNavigation(feed, history.port, onlyFavorites);
  const stop = navigation.start();
  return {feed, history, navigation, calls, stop};
}

function stored(entry: Entry) {
  return entry.state.elysiamCatalog as {key: string; data: CatalogResponse; filters: CatalogQuery; firstPage: number};
}

test('Live filtering resets a later page only after success and preserves the source history entry', async () => {
  const initial = page(3);
  const {feed, history, navigation, calls, stop} = harness(initial, {category: 'sea', days: '1', page: 3}, '/?category=sea&days=1&page=3#selected');
  try {
    assert.equal(calls.length, 0, 'Hydration reuses the server result');
    const changing = navigation.navigate({q: 'Рача'});
    assert.equal(history.url().searchParams.get('page'), '3');
    assert.deepEqual(feed.getSnapshot().data, initial);
    assert.equal(feed.getSnapshot().busy, true);
    assert.deepEqual(calls[0].query, {category: 'sea', days: '1', q: 'Рача', page: 1, limit: 4, release: 'published-release'});
    calls[0].resolve(page(1, 2, ['racha-1', 'racha-2']));
    assert.equal(await changing, true);
    assert.equal(history.url().searchParams.get('q'), 'Рача');
    assert.equal(history.url().searchParams.has('page'), false);
    assert.equal(history.entries.length, 2);
    assert.deepEqual(stored(history.entries[0]).data, initial);
    assert.equal(stored(history.entries[0]).firstPage, 3);
    assert(history.entries.every(entry => entry.state.framework === 'preserved'));
    history.back();
    assert.equal(feed.getSnapshot().firstPage, 3);
    assert.deepEqual(feed.getSnapshot().data, initial);
    history.forward();
    assert.equal(feed.getSnapshot().filters.q, 'Рача');
    assert.equal(feed.getSnapshot().data?.total, 2);
    assert.equal(calls.length, 1, 'Both history entries restore without network requests');
  } finally { stop(); }
});

test('Expanded 24-card history survives Back and Forward and resumes the remaining nineteen', async () => {
  const calls: CatalogQuery[] = [];
  const feed = createReferenceCatalogController(page(), async query => {
    calls.push(query);
    return query.q ? page(query.page, 2, ['matched-1', 'matched-2']) : page(query.page);
  });
  const history = historyPort();
  const navigation = createReferenceNavigation(feed, history.port);
  const stop = navigation.start();
  try {
    await feed.loadMore();
    assert.equal(feed.getSnapshot().data?.items.length, 24);
    assert.equal(history.url().searchParams.has('page'), false);
    await navigation.navigate({q: 'match'});
    const requests = calls.length;
    history.back();
    assert.equal(feed.getSnapshot().data?.items.length, 24);
    assert.equal(feed.getSnapshot().firstPage, 1);
    assert.equal(feed.getSnapshot().lastAppend, null);
    history.forward();
    assert.equal(feed.getSnapshot().data?.items.length, 2);
    assert.equal(feed.getSnapshot().filters.q, 'match');
    assert.equal(calls.length, requests);
    history.back();
    await feed.loadMore();
    const items = feed.getSnapshot().data!.items;
    assert.equal(items.length, 43);
    assert.equal(new Set(items.map(item => item.id)).size, 43);
    assert.equal(feed.getSnapshot().lastAppend?.addedCount, 19);
    assert.equal(feed.getSnapshot().hasMore, false);
  } finally { stop(); }
});

test('An empty successful result restores from history without a request or stale cards', async () => {
  const {feed, history, navigation, calls, stop} = harness();
  try {
    const search = navigation.navigate({q: 'no-results'});
    calls[0].resolve(page(1, 0));
    await search;
    assert.equal(feed.getSnapshot().data?.items.length, 0);
    history.back();
    assert.equal(feed.getSnapshot().data?.items.length, 4);
    history.forward();
    assert.equal(feed.getSnapshot().data?.items.length, 0);
    assert.equal(feed.getSnapshot().filters.q, 'no-results');
    assert.equal(feed.getSnapshot().busy, false);
    assert.equal(feed.getSnapshot().hasMore, false);
    assert.equal(calls.length, 1);
  } finally { stop(); }
});

test('A canceled first search push retains the original entry when the newer search asks to replace', async () => {
  const {feed, history, navigation, calls, stop} = harness();
  try {
    const first = navigation.navigate({q: 'r'}, 'push');
    const second = navigation.navigate({q: 'racha'}, 'replace');
    assert.equal(calls[0].signal.aborted, true);
    calls[1].resolve(page(1, 1, ['racha']));
    assert.equal(await second, true);
    calls[0].resolve(page(1, 3, ['stale-1', 'stale-2', 'stale-3']));
    assert.equal(await first, false);
    assert.equal(history.entries.length, 2);
    assert.equal(new URL(history.entries[0].url).search, '');
    assert.equal(history.url().searchParams.get('q'), 'racha');
    const third = navigation.navigate({q: 'racha coral'}, 'replace');
    calls[2].resolve(page(1, 1, ['coral']));
    await third;
    assert.equal(history.entries.length, 2, 'Further edits replace the already committed search entry');
    history.back();
    assert.equal(feed.getSnapshot().data?.items.length, 4);
    assert.equal(feed.getSnapshot().filters.q, undefined);
  } finally { stop(); }
});

test('An unchanged page-three filter can fail and retry at page one without corrupting either URL or cached page', async () => {
  const initial = page(3);
  const {feed, history, navigation, calls, stop} = harness(initial, {q: 'same', page: 3}, '/?q=same&page=3#selected');
  try {
    const changing = navigation.navigate({q: 'same'});
    calls[0].reject(Error('temporary'));
    assert.equal(await changing, false);
    assert.equal(history.url().searchParams.get('page'), '3');
    assert.deepEqual(feed.getSnapshot().data, initial);
    const retrying = navigation.retry();
    assert.equal(calls[1].query.page, 1);
    calls[1].resolve(page());
    assert.equal(await retrying, true);
    assert.equal(history.url().searchParams.has('page'), false);
    assert.equal(history.url().searchParams.get('q'), 'same');
    assert.equal(feed.getSnapshot().firstPage, 1);
    assert.equal(stored(history.entries[0]).firstPage, 3);
    assert.deepEqual(stored(history.entries[0]).data, initial);
    history.back();
    assert.equal(history.url().searchParams.get('page'), '3');
    assert.equal(feed.getSnapshot().firstPage, 3);
    assert.deepEqual(feed.getSnapshot().data, initial);
    assert.equal(calls.length, 2);
  } finally { stop(); }
});

test('A favorites response during live navigation preserves search intent, favorite mode, and private IDs', async () => {
  const {feed, history, navigation, calls, stop} = harness(page(1, 2, ['kept', 'removed']), {ids: ['kept', 'removed']}, '/?favorites=1#selected', true);
  try {
    const search = navigation.navigate({q: 'island'});
    const favorites = navigation.refreshIds(['kept']);
    assert.equal(calls[0].signal.aborted, true);
    assert.equal(calls[1].query.q, 'island');
    assert.deepEqual(calls[1].query.ids, ['kept']);
    calls[1].resolve(page(1, 1, ['kept']));
    await favorites;
    calls[0].resolve(page(1, 2, ['kept', 'removed']));
    assert.equal(await search, false);
    assert.equal(history.url().searchParams.get('q'), 'island');
    assert.equal(history.url().searchParams.get('favorites'), '1');
    assert.equal(history.url().searchParams.has('ids'), false);
    assert.deepEqual(feed.getSnapshot().filters.ids, ['kept']);
    assert.equal(history.entries.length, 2);
  } finally { stop(); }
});

test('Back rejects an outdated favorites cache and reloads with currently saved IDs', async () => {
  const {feed, history, navigation, calls, stop} = harness(page(1, 2, ['kept', 'removed']), {ids: ['kept', 'removed']}, '/?favorites=1#selected', true);
  try {
    const search = navigation.navigate({q: 'island'});
    calls[0].resolve(page(1, 2, ['kept', 'removed']));
    await search;
    const removal = navigation.refreshIds(['kept']);
    calls[1].resolve(page(1, 1, ['kept']));
    await removal;
    history.back();
    assert.equal(calls.length, 3, 'Old IDs must invalidate the old history snapshot');
    assert.equal(calls[2].query.q, undefined);
    assert.deepEqual(calls[2].query.ids, ['kept']);
    assert(!feed.getSnapshot().data?.items.some(item => item.id === 'removed'));
    calls[2].resolve(page(1, 1, ['kept']));
    await Promise.resolve();
    assert.equal(feed.getSnapshot().filters.q, undefined);
    assert.deepEqual(feed.getSnapshot().data?.items.map(item => item.id), ['kept']);
    history.forward();
    assert.equal(feed.getSnapshot().filters.q, 'island');
    assert.deepEqual(feed.getSnapshot().filters.ids, ['kept']);
    assert.equal(calls.length, 3);
  } finally { stop(); }
});

test('Empty favorites remain restricted and never serialize their sentinel into the URL', async () => {
  const {feed, history, navigation, calls, stop} = harness(page(1, 1, ['kept']), {ids: ['kept']}, '/?favorites=1#selected', true);
  try {
    const clearing = navigation.refreshIds([]);
    assert.deepEqual(calls[0].query.ids, ['__empty__']);
    calls[0].resolve(page(1, 0));
    await clearing;
    const search = navigation.navigate({q: 'island'});
    assert.deepEqual(calls[1].query.ids, ['__empty__']);
    calls[1].resolve(page(1, 0));
    await search;
    assert.equal(feed.getSnapshot().data?.items.length, 0);
    assert.equal(history.url().searchParams.get('favorites'), '1');
    assert.equal(history.url().searchParams.has('ids'), false);
    assert(!history.port.url().includes('__empty__'));
  } finally { stop(); }
});

test('A stale failure cannot overwrite the latest result or its committed URL', async () => {
  const {feed, history, navigation, calls, stop} = harness();
  try {
    const first = navigation.navigate({q: 'old'});
    const second = navigation.navigate({q: 'new', category: 'nature'});
    calls[1].resolve(page(1, 1, ['new-result']));
    await second;
    const latest = feed.getSnapshot();
    const url = history.port.url();
    calls[0].reject(Error('late stale failure'));
    assert.equal(await first, false);
    assert.equal(feed.getSnapshot(), latest);
    assert.equal(feed.getSnapshot().error, '');
    assert.equal(history.port.url(), url);
    assert.equal(history.url().searchParams.get('category'), 'nature');
  } finally { stop(); }
});

test('Repeated identical navigation reuses the committed result without duplicate history entries', async () => {
  const {feed, history, navigation, calls, stop} = harness();
  try {
    const search = navigation.navigate({q: 'same'});
    calls[0].resolve(page(1, 1, ['same-result']));
    await search;
    const result = feed.getSnapshot().data;
    assert.equal(await navigation.navigate({q: 'same'}), true);
    assert.equal(await navigation.navigate({q: 'same'}, 'replace'), true);
    assert.equal(calls.length, 1);
    assert.equal(history.entries.length, 2);
    assert.equal(feed.getSnapshot().data, result);
    assert.equal(history.url().searchParams.get('q'), 'same');
  } finally { stop(); }
});

test('Back cancels an in-flight live request and a late success cannot navigate forward again', async () => {
  const {feed, history, navigation, calls, stop} = harness();
  try {
    const first = navigation.navigate({q: 'first'});
    calls[0].resolve(page(1, 1, ['first-result']));
    await first;
    const second = navigation.navigate({q: 'second'}, 'replace');
    history.back();
    assert.equal(calls[1].signal.aborted, true);
    assert.equal(feed.getSnapshot().filters.q, undefined);
    assert.equal(feed.getSnapshot().data?.items.length, 4);
    calls[1].resolve(page(1, 1, ['stale-result']));
    assert.equal(await second, false);
    assert.equal(history.url().search, '');
    assert.equal(feed.getSnapshot().filters.q, undefined);
    assert.equal(feed.getSnapshot().busy, false);
  } finally { stop(); }
});
