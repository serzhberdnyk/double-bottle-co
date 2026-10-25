import {z} from 'zod';

/** Existing artwork anchors and native sizes are unchanged. Percentages are
 * coordinates in the supplied illustration, never GPS coordinates. */
export const legacyMapObjects=[
 {id:'yona-boarding',title:'YONA · посадка',image:'/media/reference/yona-user-icon.webp',x:410/1280*100,y:332/1083*100,size:66},
 {id:'phuket-airport',title:'Аэропорт Пхукета',image:'/media/reference/airport-plane-cutout.png',x:257/1280*100,y:226/1083*100,size:48},
 {id:'big-buddha',title:'Биг Будда',image:'/media/reference/big-buddha-cutout.png',x:263/1280*100,y:430/1083*100,size:40},
 {id:'diving',title:'Лодка дайвинга',image:'/media/reference/diving-user-boat.webp',x:469.304/1280*100,y:462.014/1083*100,size:64},
] as const;
export const busMapObject={id:'cheow-lan-bus',title:'Чео Лан — автобус',image:'/media/reference/cheow-lan-user-minibus.png',x:25.7,y:10.34,size:83.2} as const;
export const mapObjects=[...legacyMapObjects,busMapObject] as const;
export type BuiltinMapObjectId=typeof mapObjects[number]['id'];
export type MapObjectId=string;
export const mapSizePresets=['small','medium','large'] as const;
export type MapSizePreset=typeof mapSizePresets[number];
export type MapPlacement={id:MapObjectId;x:number;y:number;image:string;title?:string;description?:string;photos?:string[];sizePreset?:MapSizePreset;sizePx?:number|null};
export type MapLayout=MapPlacement[];
export type MapRoutePoint={x:number;y:number};
export type MapRoute={id:string;title:string;points:MapRoutePoint[];color:'sea'|'land';style:'solid'|'dashed'};
export type MapDocument={version:2;placements:MapLayout;routes:MapRoute[]};
export const smallBusImage='/media/reference/cheow-lan-minibus-small.png';
/** Keep stored image identities intact, using the approved compact rendering
 * only for the original built-in bus. User-uploaded replacements are retained. */
export function mapPlacementDisplayImage(placement:MapPlacement){return placement.id===busMapObject.id&&placement.image===busMapObject.image?smallBusImage:placement.image;}

// One source-art coordinate plane for both landmarks and routes.
export const mapEditingBounds={x:{min:0,max:100},y:{min:0,max:100}} as const;
export const defaultMapLayout:MapLayout=legacyMapObjects.map(({id,x,y,image})=>({id,x,y,image}));
export const defaultMapDocument:MapDocument={version:2,placements:mapObjects.map(({id,x,y,image})=>({id,x,y,image})),routes:[]};
const builtinIds=new Set<string>(mapObjects.map(item=>item.id));
const builtinImages=new Set<string>([...mapObjects.map(item=>item.image),'/media/reference/map-landmark-placeholder.svg']);
export function isBuiltinMapObjectId(id:string):id is BuiltinMapObjectId{return builtinIds.has(id);}
export function isApprovedMapImage(path:string){return builtinImages.has(path)||/^\/api\/catalog-media\/[a-f0-9]{64}$/.test(path);}
export function mapPlacementTitle(placement:MapPlacement){return placement.title||mapObjects.find(item=>item.id===placement.id)?.title||'Новый значок';}
export function mapPlacementImageSize(placement:MapPlacement){
 const native=mapObjects.find(item=>item.id===placement.id)?.size||48;
 if(placement.sizePx!=null)return placement.sizePx;
 return placement.sizePreset?{small:36,medium:48,large:65}[placement.sizePreset]:native;
}

const id=z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/);
const image=z.string().max(200).refine(isApprovedMapImage,'INVALID_MAP_IMAGE');
const placementShape={
 id,
 x:z.number().finite().min(mapEditingBounds.x.min).max(mapEditingBounds.x.max),
 y:z.number().finite().min(mapEditingBounds.y.min).max(mapEditingBounds.y.max),
 image,
};
const placement=z.object({...placementShape,
 title:z.string().trim().min(1).max(120).optional(),
 description:z.string().trim().max(2000).optional(),
 photos:z.array(image).max(8).refine(items=>new Set(items).size===items.length,'DUPLICATE_MAP_PHOTOS').optional(),
 sizePreset:z.enum(mapSizePresets).optional(),
 sizePx:z.number().finite().min(16).max(240).nullable().optional(),
}).strict().superRefine((item,ctx)=>{
 if(!isBuiltinMapObjectId(item.id)&&!item.title)ctx.addIssue({code:'custom',message:'MAP_TITLE_REQUIRED'});
});
// The extra slot preserves all 100 objects allowed by older editors when the
// new built-in bus is introduced. Never drop an existing custom landmark.
export const mapLayoutSchema=z.array(placement).min(legacyMapObjects.length).max(101).superRefine((items,ctx)=>{
 if(new Set(items.map(item=>item.id)).size!==items.length||legacyMapObjects.some(original=>!items.some(item=>item.id===original.id)))ctx.addIssue({code:'custom',message:'INVALID_MAP_OBJECTS'});
});

/** Strict v1 input remains accepted, but is merged into the current v2 document
 * server-side so an older open editor cannot erase new content or routes. */
export const legacyMapLayoutSchema=z.array(z.object(placementShape).strict()).length(legacyMapObjects.length).superRefine((items,ctx)=>{
 if(new Set(items.map(item=>item.id)).size!==legacyMapObjects.length||items.some(item=>!legacyMapObjects.some(original=>original.id===item.id)))ctx.addIssue({code:'custom',message:'INVALID_MAP_OBJECTS'});
 for(const item of items){const original=mapObjects.find(object=>object.id===item.id);if(original&&item.image!==original.image&&!item.image.startsWith('/api/catalog-media/'))ctx.addIssue({code:'custom',message:'INVALID_MAP_IMAGE'});}
});
const point=z.object({x:z.number().finite().min(0).max(100),y:z.number().finite().min(0).max(100)}).strict();
export const mapRouteSchema=z.object({
 id,
 title:z.string().trim().min(1).max(120),
 points:z.array(point).min(2).max(100).refine(points=>points.some(p=>p.x!==points[0].x||p.y!==points[0].y),'MAP_ROUTE_NEEDS_DISTINCT_POINTS'),
 color:z.enum(['sea','land']),
 style:z.enum(['solid','dashed']),
}).strict();
export const mapDocumentSchema=z.object({version:z.literal(2),placements:mapLayoutSchema,routes:z.array(mapRouteSchema).max(50)}).strict().superRefine((document,ctx)=>{
 if(new Set(document.routes.map(route=>route.id)).size!==document.routes.length)ctx.addIssue({code:'custom',message:'DUPLICATE_MAP_ROUTES'});
});
export function parseMapDocument(input:unknown):MapDocument{
 const document=Array.isArray(input)?{version:2 as const,placements:legacyMapLayoutSchema.parse(input),routes:[]}:mapDocumentSchema.parse(input);
 return document.placements.some(item=>item.id===busMapObject.id)?document:{...document,placements:[...document.placements,{id:busMapObject.id,x:busMapObject.x,y:busMapObject.y,image:busMapObject.image}]};
}
export function mergeLegacyMapLayout(input:unknown,current:MapDocument):MapDocument{
 const placements=legacyMapLayoutSchema.parse(input),byId=new Map(placements.map(item=>[item.id,item]));
 return mapDocumentSchema.parse({...current,placements:current.placements.map(item=>({...item,...byId.get(item.id)}))});
}
/** The legacy API fields expose only the original four objects and fields.
 * New editor clients use publishedDocument/draftDocument. */
export function legacyMapLayout(document:MapDocument):MapLayout{
 return legacyMapObjects.map(original=>{const item=document.placements.find(placement=>placement.id===original.id)!;return {id:item.id,x:item.x,y:item.y,image:item.image};});
}

/** Old open v2 clients may omit newly introduced built-ins and size fields.
 * Preserve those values; an explicit null resets size to its native/preset value. */
export function mergeMapDocument(input:unknown,current:MapDocument):MapDocument{
 const incoming=mapDocumentSchema.parse(input),previous=new Map(current.placements.map(item=>[item.id,item]));
 const placements=incoming.placements.map(item=>Object.hasOwn(item,'sizePx')?item:{...item,...(previous.get(item.id)?.sizePx!==undefined?{sizePx:previous.get(item.id)!.sizePx}:{})});
 if(!placements.some(item=>item.id===busMapObject.id))placements.splice(Math.max(0,current.placements.findIndex(item=>item.id===busMapObject.id)),0,previous.get(busMapObject.id)||{id:busMapObject.id,x:busMapObject.x,y:busMapObject.y,image:busMapObject.image});
 return mapDocumentSchema.parse({...incoming,placements});
}
