import {currentLocale} from '@/lib/i18n/server';
import {localePath} from '@/lib/i18n/core';
import {permanentRedirect} from 'next/navigation';
import {legacyCatalogHref,type CatalogSearch} from '@/lib/public/catalog-navigation';

export const dynamic='force-dynamic';
// The home gallery is the sole general catalogue. Old links remain usable.
export default async function CatalogRedirect({searchParams}:{searchParams:Promise<CatalogSearch>}) {
  permanentRedirect(localePath(legacyCatalogHref(await searchParams),await currentLocale()));
}
