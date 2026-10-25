'use client';

import {useI18n} from '@/lib/i18n/context';
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import type {CatalogResponse, CatalogQuery} from '../../lib/public/types';
import {referenceCatalogQuery} from './reference-catalog';
import {createReferenceCatalogController, type ReferenceCatalogRequest} from './reference-feed';
import {createReferenceNavigation} from './reference-navigation';

export function useReferenceCatalog(initial: CatalogResponse | null, initialQuery: CatalogQuery, onlyFavorites = false) {
  const {locale,t,href}=useI18n();
  const requestCatalog = useMemo<ReferenceCatalogRequest>(() => async (query,signal) => {
    const response=await fetch('/api/catalog?'+referenceCatalogQuery(query)+'&locale='+locale,{signal,credentials:'same-origin'});
    if(!response.ok)throw new Error(t(query.page===1?'Не удалось обновить подборку. Попробуйте ещё раз.':'Не удалось загрузить ещё экскурсии. Попробуйте ещё раз.'));
    return await response.json() as CatalogResponse;
  },[locale,t]);
  const controller = useMemo(() => createReferenceCatalogController(initial, requestCatalog, initialQuery), [initial, initialQuery,requestCatalog]);
  const navigation = useMemo(() => createReferenceNavigation(controller, {
    url: () => location.href,
    state: () => history.state,
    push: (state, url) => history.pushState(state, '', url),
    replace: (state, url) => history.replaceState(state, '', url),
    onPop: listener => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); },
  }, onlyFavorites,href), [controller, onlyFavorites,href]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => navigation.start(), [navigation]);
  const actions = useMemo(() => ({
    updateFilters: navigation.navigate,
    resetFilters: () => navigation.navigate({q: undefined, category: undefined, destination: undefined, days: undefined, transport: undefined, format: undefined, sort: undefined}),
    restoreFavorites: navigation.refreshIds,
    retry: navigation.retry,
    loadMore: controller.loadMore,
  }), [controller, navigation]);
  return {...snapshot, ...actions};
}
