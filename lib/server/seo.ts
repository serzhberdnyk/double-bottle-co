import {headers} from 'next/headers';
import {configuration,database} from './db';
import {indexingPolicy,seoMetadata,type PageSeo} from '../public/seo-policy';
import {currentLocale} from '../i18n/server';
import {localePath,type Locale} from '../i18n/core';
import {equivalentLocales} from './catalog';
export async function currentIndexingPolicy(){return indexingPolicy(configuration(),(await headers()).get('host'));}
export async function pageMetadata(page:PageSeo){const locale=await currentLocale(),policy=await currentIndexingPolicy();let available:Locale[]=['ru','en','th'];if(/^\/(tour|destination)\//.test(page.path))available=await equivalentLocales(database(),page.path);return seoMetadata(policy,{...page,path:localePath(page.path,locale),locale,alternates:available.map(value=>({locale:value,path:localePath(page.path,value)}))});}
export async function canonicalPageUrl(path:string){const policy=await currentIndexingPolicy();return policy.enabled&&policy.origin?new URL(localePath(path,await currentLocale()),policy.origin).href:undefined;}
