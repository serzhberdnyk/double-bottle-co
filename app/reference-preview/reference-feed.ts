import type {CatalogQuery, CatalogResponse, Tour} from '../../lib/public/types';

export const REFERENCE_PAGE_SIZE = 4;
export const REFERENCE_APPEND_SIZE = 20;

export type ReferenceLoadingKind = 'replace' | 'append' | null;
export type ReferenceCatalogRequest = (query: CatalogQuery, signal: AbortSignal) => Promise<CatalogResponse>;

export interface ReferenceAppend {
  firstNewId: string;
  addedCount: number;
  sequence: number;
}

export interface ReferenceCatalogSnapshot {
  data: CatalogResponse | null;
  firstPage: number;
  filters: CatalogQuery;
  appliedFilters: CatalogQuery;
  busy: boolean;
  loadingMore: boolean;
  loadingKind: ReferenceLoadingKind;
  error: string;
  moreError: string;
  hasMore: boolean;
  lastAppend: ReferenceAppend | null;
}

interface PendingRequest {
  id: number;
  kind: Exclude<ReferenceLoadingKind, null>;
  filters: CatalogQuery;
  page: number;
  controller: AbortController;
}

const replaceError = 'Не удалось обновить подборку. Попробуйте ещё раз.';
const appendError = 'Не удалось загрузить ещё экскурсии. Попробуйте ещё раз.';

// Pagination and release belong to the feed, never to a filter control.
function onlyFilters(query: CatalogQuery): CatalogQuery {
  const filters = {...query};
  delete filters.page;
  delete filters.limit;
  delete filters.release;
  delete filters.featured;
  if (filters.ids) filters.ids = [...filters.ids];
  return filters;
}

function filterKey(filters: CatalogQuery): string {
  return JSON.stringify(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '').sort(([a], [b]) => a.localeCompare(b)));
}

function uniqueTours(items: Tour[], existing: Tour[] = []): Tour[] {
  const seen = new Set(existing.map(tour => tour.id));
  return items.filter(tour => {
    if (seen.has(tour.id)) return false;
    seen.add(tour.id);
    return true;
  });
}

function canAppend(data: CatalogResponse | null): boolean {
  return !!data && data.items.length > 0 && data.page < data.pages && data.items.length < data.total;
}

/**
 * Small external store, independent of React so races are tested with real
 * deferred requests. Request ownership is set synchronously before any await.
 */
export function createReferenceCatalogController(initial: CatalogResponse | null, request: ReferenceCatalogRequest, initialQuery: CatalogQuery = {}) {
  const data = initial ? {...initial, items: uniqueTours(initial.items)} : null;
  let snapshot: ReferenceCatalogSnapshot = {
    data, firstPage: data?.page||initialQuery.page||1, filters: onlyFilters(initialQuery), appliedFilters: onlyFilters(initialQuery), busy: false, loadingMore: false,
    loadingKind: null, error: '', moreError: '', hasMore: canAppend(data), lastAppend: null,
  };
  let releaseId = initial?.releaseId;
  let replacementPage = initialQuery.page||1;
  let nextRequestId = 0;
  let appendSequence = 0;
  let pending: PendingRequest | null = null;
  const listeners = new Set<() => void>();

  function publish(change: Partial<ReferenceCatalogSnapshot>) {
    snapshot = {...snapshot, ...change};
    for (const listener of listeners) listener();
  }

  function cancelPending() {
    const previous = pending;
    pending = null;
    previous?.controller.abort();
  }

  function isCurrent(operation: PendingRequest) {
    return pending?.id === operation.id && !operation.controller.signal.aborted;
  }

  async function run(operation: PendingRequest): Promise<boolean> {
    try {
      const previousItems = operation.kind === 'append' ? snapshot.data?.items ?? [] : [];
      const added: Tour[] = [];
      let next: CatalogResponse;
      let lastPageAdded = 0;
      // Fetch the existing four-card pages concurrently, then consume them in
      // catalogue order. Keep the batch atomic so errors/retries cannot skip cards.
      const batchPages = operation.kind === 'append'
        ? Math.min(REFERENCE_APPEND_SIZE / REFERENCE_PAGE_SIZE, snapshot.data!.pages - operation.page + 1)
        : 1;
      const responses = Array.from({length: batchPages}, (_, index) => request({
        ...operation.filters, page: operation.page + index, limit: REFERENCE_PAGE_SIZE, release: releaseId,
      }, operation.controller.signal).then(
        response => ({response}),
        failure => ({failure}),
      ));
      for (let index = 0; index < responses.length; index++) {
        const result = await responses[index];
        if (!isCurrent(operation)) return false;
        if ('failure' in result) throw result.failure;
        next = result.response;
        const page = operation.page + index;
        // A response from a newer/older release must never enter this feed.
        if (!next.releaseId || (releaseId && next.releaseId !== releaseId)) {
          throw new Error('Каталог изменился. Обновите страницу и попробуйте ещё раз.');
        }
        if (operation.kind === 'append' && next.page !== page) throw new Error(appendError);
        const pageItems = uniqueTours(next.items, [...previousItems, ...added]);
        added.push(...pageItems);
        lastPageAdded = pageItems.length;
        if (!lastPageAdded || next.page >= next.pages || previousItems.length + added.length >= next.total) break;
      }
      const combined = {...next!, items: [...previousItems, ...added]};
      releaseId ??= next!.releaseId;
      pending = null;
      operation.controller.abort();
      publish({
        data: combined,
        firstPage: operation.kind === 'replace' ? next!.page : snapshot.firstPage,
        appliedFilters: operation.filters,
        busy: false, loadingMore: false, loadingKind: null, error: '', moreError: '',
        // Empty/duplicate-only pages stop safely instead of inviting endless clicks.
        hasMore: lastPageAdded > 0 && canAppend(combined),
        lastAppend: operation.kind === 'append' && added.length > 0
          ? {firstNewId: added[0].id, addedCount: added.length, sequence: ++appendSequence}
          : null,
      });
      return true;
    } catch (failure) {
      if (!isCurrent(operation)) return false;
      pending = null;
      operation.controller.abort();
      const fallback = operation.kind === 'append' ? appendError : replaceError;
      const message = failure instanceof Error && failure.message ? failure.message : fallback;
      publish({
        busy: false, loadingMore: false, loadingKind: null,
        error: operation.kind === 'replace' ? message : '',
        moreError: operation.kind === 'append' ? message : '',
      });
      return false;
    }
  }

  function replace(filters: CatalogQuery, page = 1): Promise<boolean> {
    cancelPending();
    replacementPage = page;
    const operation: PendingRequest = {
      id: ++nextRequestId, kind: 'replace', filters: onlyFilters(filters),
      page, controller: new AbortController(),
    };
    pending = operation;
    publish({
      filters: operation.filters, busy: true, loadingMore: false, loadingKind: 'replace',
      error: '', moreError: '', lastAppend: null,
    });
    return run(operation);
  }

  function loadMore(): Promise<boolean> {
    if (pending || snapshot.error || !snapshot.hasMore || !snapshot.data ||
      filterKey(snapshot.filters) !== filterKey(snapshot.appliedFilters)) return Promise.resolve(false);
    const operation: PendingRequest = {
      id: ++nextRequestId, kind: 'append', filters: onlyFilters(snapshot.appliedFilters),
      page: snapshot.data.page + 1, controller: new AbortController(),
    };
    pending = operation;
    publish({loadingMore: true, loadingKind: 'append', moreError: '', lastAppend: null});
    return run(operation);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    updateFilters: (next: CatalogQuery) => replace({...snapshot.filters, ...next}),
    restoreFilters: (next: CatalogQuery, page = 1, preserveExpanded = false) => {
      if(preserveExpanded&&!pending&&!snapshot.error&&snapshot.data&&page===snapshot.firstPage&&filterKey(onlyFilters(next))===filterKey(snapshot.appliedFilters))return Promise.resolve(true);
      return replace(next, page);
    },
    restoreHistory(saved: {data:CatalogResponse;filters:CatalogQuery;firstPage:number}, expectedQuery:CatalogQuery = initialQuery, strictIds = false) {
      if((strictIds&&JSON.stringify(saved?.filters?.ids||[])!==JSON.stringify(expectedQuery.ids||[]))||pending||!saved?.data||!Array.isArray(saved.data.items)||
        saved.data.releaseId!==releaseId||saved.firstPage<1||saved.firstPage>(expectedQuery.page||initial?.page||1)||saved.data.page<saved.firstPage||
        filterKey(onlyFilters({...saved.filters,ids:expectedQuery.ids}))!==filterKey(onlyFilters(expectedQuery)))return false;
      publish({data:saved.data,filters:onlyFilters(saved.filters),appliedFilters:onlyFilters(saved.filters),
        firstPage:saved.firstPage,hasMore:canAppend(saved.data),lastAppend:null,busy:false,loadingMore:false,loadingKind:null,error:'',moreError:''});
      return true;
    },
    resetFilters: () => replace({}),
    retry: () => replace(snapshot.filters,replacementPage),
    loadMore,
    cancel() {
      cancelPending();
      if (snapshot.loadingKind) publish({busy: false, loadingMore: false, loadingKind: null});
    },
  };
}
