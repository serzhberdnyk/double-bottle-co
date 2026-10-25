'use client';
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {localePath,type Locale} from './core';
import {translateUi} from './ui-copy';
const Context=createContext<Locale>('ru');
export function LocaleProvider({locale,children}:{locale:Locale;children:ReactNode}) { return <Context.Provider value={locale}>{children}</Context.Provider>; }
export function useI18n() { const locale=useContext(Context); return useMemo(()=>({locale,t:(source:string)=>translateUi(source,locale),href:(path:string)=>localePath(path,locale)}),[locale]); }
