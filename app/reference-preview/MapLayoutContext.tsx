'use client';
import {createContext,useContext,type ReactNode} from 'react';
import {defaultMapDocument,type MapDocument,type MapLayout} from '@/lib/public/map-layout';
const MapContext=createContext<MapDocument>(defaultMapDocument);
export function MapLayoutProvider({layout,document,children}:{layout?:MapLayout;document?:MapDocument;children:ReactNode}){return <MapContext.Provider value={document||{version:2,placements:layout||defaultMapDocument.placements,routes:[]}}>{children}</MapContext.Provider>;}
export function useMapDocument(){return useContext(MapContext);}
export function useMapPlacement(id:string){return useMapDocument().placements.find(o=>o.id===id);}
