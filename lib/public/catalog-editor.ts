import {z} from 'zod';
import {programmeItemsSchema} from './programme-items';
import type {Tour} from './types';
import {newSellingRateSchema,previewSellingRates} from './selling-price-editor';
import {variantImagePathSchema} from './variant-image';

export const editorPayloadSchema=z.object({
 visible:z.boolean().optional(),
 title:z.string().trim().min(1).max(500),description:z.string().max(10000),
 image:z.string().regex(/^\/(?:media\/[a-zA-Z0-9_./-]+\.(?:webp|avif|png|jpe?g)|api\/catalog-media\/[a-f0-9]{64})$/).nullable(),
 imageAlt:z.string().max(1000),
 variants:z.array(z.object({image:variantImagePathSchema.nullable().optional(),imageAlt:z.string().max(1000).optional(),visible:z.boolean().optional(),name:z.string().trim().min(1).max(500).optional(),id:z.string().min(1).max(100),description:z.string().max(10000),itinerary:programmeItemsSchema.optional(),
  rates:z.array(z.object({id:z.string().min(1).max(500),amountMinor:z.number().int().positive().max(1000000000).nullable()}).strict()).max(100),newRates:z.array(newSellingRateSchema).max(20).optional().transform(v=>v?.length?v:undefined),
 }).strict()).min(1).max(100),
}).strict();
export type EditorPayload=z.infer<typeof editorPayloadSchema>;
export interface EditorDraft {id:string;productId:string;baseReleaseId:string;baseGeneration:number;revision:number;status:string;payload:EditorPayload;updatedAt:string;publishedReleaseId:string|null}
export function editorPayload(tour:Tour):EditorPayload{return {visible:!tour.hidden,title:tour.title,description:tour.description,image:tour.image,imageAlt:tour.imageAlt,variants:tour.variants.map(v=>({id:v.id,image:v.image??null,imageAlt:v.imageAlt||'',name:v.name,visible:v.visible!==false,description:v.description,...(v.itinerary.length?{itinerary:[...v.itinerary]}:{}),rates:v.rates.map(r=>({id:r.id,amountMinor:r.amountMinor}))}))};}
export function editorPreview(tour:Tour,payload:EditorPayload):Tour{return {...tour,hidden:payload.visible===false||(payload.visible===undefined&&!!tour.hidden),title:payload.title,description:payload.description,descriptionEdited:tour.descriptionEdited||payload.description!==tour.description,image:payload.image,imageAlt:payload.imageAlt,variants:tour.variants.map(v=>{const edit=payload.variants.find(x=>x.id===v.id);return edit?{...v,image:edit.image===undefined?v.image:edit.image,imageAlt:edit.image===null?'':edit.imageAlt??v.imageAlt,name:edit.name??v.name,visible:edit.visible??(v.visible!==false),description:edit.description,itinerary:edit.itinerary??v.itinerary,rates:previewSellingRates(v,edit)}:v;})};}
export function canEditCatalogIdentity(email:string|null|undefined,userId:string|null|undefined,admins:string|undefined,editors:string|undefined){
 return !!userId&&!!email&&[admins,editors].some(list=>(list||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean).includes(email.toLowerCase()));
}
