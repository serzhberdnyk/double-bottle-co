import {z} from 'zod';

const text=z.string().max(10000), label=z.string().min(1).max(500);
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const slug=z.string().min(1).max(150).regex(/^[a-z0-9-]+$/);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
 const n=Date.parse(s);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s;
},'Несуществующая дата');
const image=z.string().regex(/^\/(?:media\/[a-z0-9_-]+\.(?:webp|avif|png|jpe?g)|api\/catalog-media\/[a-f0-9]{64})$/).nullable();
const status=z.enum(['on_request','temporarily_unavailable']);
const lines=z.array(text).max(200);
const rate=z.object({id,optionKey:id.optional(),amountMinor:z.number().int().positive().max(1000000000),
 currency:z.string().regex(/^[A-Z]{3}$/),unit:label,audience:z.enum(['adult','child','group','all']),
 validFrom:date,validUntil:date.nullable(),conditions:text,supplements:lines}).strict();
const stop=z.object({destinationId:id,sequence:z.number().int().positive(),
 visitType:z.enum(['landing','snorkeling','boat_view','water_stop','passage','optional','conditional']),
 required:z.boolean(),note:text,name:z.string().optional(),lat:z.number().optional(),lng:z.number().optional()}).strict();
const priceOption=z.object({key:id,label,serviceDateFrom:date.nullable(),serviceDateUntil:date.nullable(),conditions:lines,supplements:lines}).strict();
const variant=z.object({id,revisionId:z.string(),name:label,description:text,duration:label,
 days:z.number().int().min(1).max(365),transport:label,format:label,status,
 stops:z.array(stop).max(200),itinerary:lines,includes:lines,extras:lines,conditions:lines,
 rates:z.array(rate).max(100),priceOptions:z.array(priceOption).max(100).optional(),earliestDate:date.nullable()}).strict();
const destination=z.object({id,slug,name:label,lat:z.number().min(-90).max(90),
 lng:z.number().min(-180).max(180),region:label,description:text,image}).strict();
const product=z.object({id,slug,title:label,description:text,category:label,image,imageAlt:text,status,
 descriptionEdited:z.boolean().optional(),featuredRank:z.number().int(),variants:z.array(variant).min(1).max(100),
 publicationStatus:z.enum(['draft','published','archived']),
 provenance:z.object({sourceId:id,source:label,checkedAt:label,hash:label}).strict(),
 supplier:z.object({id,name:label,offerId:id,raw:z.unknown(),rates:z.array(z.object({
  id,amountMinor:z.number().int().nonnegative().nullable(),currency:label,kind:label,unit:label,
  validFrom:date.nullable(),validUntil:date.nullable(),sourceText:text,
 }).strict()).optional()}).strict()}).strict();
const schema=z.object({schemaVersion:z.literal(1),complete:z.literal(true),source:label,checkedAt:label,
 products:z.array(product).min(1).max(5000),destinations:z.array(destination).max(1000),
 media:z.array(z.object({id,path:image.refine(Boolean),license:label,attribution:label,sourceUrl:label}).passthrough()).max(5000),
}).strict();

export function validateImportShape(value:unknown){
 const result=schema.safeParse(value);
 if(!result.success)throw new Error('VALIDATION: '+result.error.issues.slice(0,30)
  .map(i=>i.path.join('.')+': '+i.message).join('; '));
}
