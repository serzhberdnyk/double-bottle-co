import type {CatalogQuery} from '../../lib/public/types';
import {catalogHref, catalogQueryFromSearch} from '../../lib/public/catalog-navigation';
import type {createReferenceCatalogController} from './reference-feed';

type Feed = ReturnType<typeof createReferenceCatalogController>;
export type HistoryPort = {
  url: () => string;
  state: () => Record<string, unknown> | null;
  push: (state: Record<string, unknown>, url: string) => void;
  replace: (state: Record<string, unknown>, url: string) => void;
  onPop: (listener: () => void) => () => void;
};
const key = (url: URL) => url.pathname + url.search;
const filterKey = (query: CatalogQuery) => catalogHref({...query, page: 1}, {anchor: false});

/** Keep URL, successful feed and expanded cards together, without router internals. */
export function createReferenceNavigation(feed: Feed, port: HistoryPort, onlyFavorites = false, localHref: (path:string)=>string = path=>path) {
  let sequence = 0;
  let lastMode: 'push' | 'replace' = 'push';
  let pendingNavigation = false;
  const queryAtUrl = () => catalogQueryFromSearch(Object.fromEntries(new URL(port.url()).searchParams));
  function entry() {
    const state = feed.getSnapshot();
    return {key: key(new URL(port.url())), data: state.data, filters: state.appliedFilters, firstPage: state.firstPage};
  }
  function remember() {
    const state = feed.getSnapshot();
    if (pendingNavigation || !state.data || state.loadingKind || state.error || filterKey(queryAtUrl()) !== filterKey(state.appliedFilters)) return;
    port.replace({...port.state(), elysiamCatalog: entry()}, port.url());
  }
  async function navigate(patch: CatalogQuery, mode: 'push' | 'replace' = 'push') {
    const request = ++sequence;
    if (pendingNavigation && lastMode === 'push') mode = 'push';
    lastMode = mode;
    pendingNavigation = true;
    const filters = {...feed.getSnapshot().filters, ...patch};
    const href = localHref(catalogHref(filters, {favorites: onlyFavorites}));
    const current = new URL(port.url());
    const same = current.pathname + current.search + current.hash === href;
    remember();
    const ok = await feed.restoreFilters(filters, 1, true);
    if (!ok || request !== sequence) return false;
    pendingNavigation = false;
    const next = new URL(href, port.url());
    const state = {...port.state(), elysiamCatalog: {...entry(), key: key(next)}};
    if (same || mode === 'replace') port.replace(state, href);
    else port.push(state, href);
    return true;
  }
  function restore() {
    ++sequence;
    pendingNavigation = true;
    feed.cancel();
    const query = {...queryAtUrl(), ids: feed.getSnapshot().filters.ids};
    const saved = port.state()?.elysiamCatalog as Parameters<Feed['restoreHistory']>[0] & {key?: string};
    if (saved?.key === key(new URL(port.url())) && feed.restoreHistory(saved, query, true)) {
      pendingNavigation = false; remember(); return;
    }
    const restoring = feed.restoreFilters(query, query.page || 1);
    pendingNavigation = false;
    void restoring;
  }
  function start() {
    const saved = port.state()?.elysiamCatalog as Parameters<Feed['restoreHistory']>[0] & {key?: string};
    if (saved?.key === key(new URL(port.url()))) feed.restoreHistory(saved);
    remember();
    const unsubscribe = feed.subscribe(remember);
    const offPop = port.onPop(restore);
    return () => { ++sequence; unsubscribe(); offPop(); feed.cancel(); };
  }
  function refreshIds(ids: string[]) {
    const state = feed.getSnapshot();
    const filters = {...state.filters, ids: ids.length ? ids : ['__empty__']};
    if (pendingNavigation || filterKey(queryAtUrl()) !== filterKey(filters)) return navigate(filters, lastMode);
    return feed.restoreFilters(filters, state.busy ? 1 : state.firstPage, true);
  }
  function retry() {
    if (pendingNavigation || filterKey(queryAtUrl()) !== filterKey(feed.getSnapshot().filters)) return navigate(feed.getSnapshot().filters, lastMode);
    return feed.retry();
  }
  return {start, navigate, refreshIds, retry};
}
