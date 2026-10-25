import {currentLocale} from '@/lib/i18n/server';
import {pageMetadata} from '@/lib/server/seo';
import {cheowLanMapCopy, cheowLanMapPath} from '@/lib/public/cheow-lan-map';
import {CheowLanMapPage} from './CheowLanMapPage';

export async function generateMetadata() {
  const text = cheowLanMapCopy[await currentLocale()];
  return pageMetadata({title:text.map, description:text.description, path:cheowLanMapPath});
}

export default function CheowLan() {
  return <CheowLanMapPage/>;
}
