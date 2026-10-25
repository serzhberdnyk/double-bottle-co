'use client';
import {useI18n} from '@/lib/i18n/context';
const sources:Record<string,string[]>={
 'p_at_ks_1d':['cheo1d'],'p_at_city_ab':['citytour'],'p_at_kl_safari_1d':['khaolak'],'p_at_ttoa_1d':['ttoa'],
 'p_e340acb314a559f4b49a6e22':['ohosky','ohovip'],'p_1cdc3b7fc1625ada979ad010':['4pearl'],'p_dd70e1051d36596481a18438':['simila'],
};
const labels={ru:['DEMO: синтетические образцы','образец 1','образец 2'],en:['DEMO: synthetic placeholders','sample 1','sample 2'],th:['DEMO: ภาพตัวอย่างจำลอง','ตัวอย่าง 1','ตัวอย่าง 2']};
export function ApprovedBrochures({productId}:{productId:string}){const {locale}=useI18n(),items=sources[productId];if(!items)return null;const text=labels[locale];return <p className="approved-brochure-links">{items.map(stem=><span key={stem}>{text[0]}: <a href={'/media/atime-'+stem+'.jpg'} target="_blank" rel="noreferrer">{text[1]}</a>{' · '}<a href={'/media/atime-'+stem+'1.jpg'} target="_blank" rel="noreferrer">{text[2]}</a>{' '}</span>)}</p>;}
