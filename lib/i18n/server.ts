import {headers} from 'next/headers';
import {isLocale,type Locale} from './core';
export async function currentLocale(): Promise<Locale> { const value=(await headers()).get('x-doublebottle-locale'); return isLocale(value) ? value : 'ru'; }
