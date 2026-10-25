import {z} from 'zod';
import {programmeItemsSchema} from './programme-items';
import {editorPayloadSchema} from './catalog-editor';
const label=z.string().trim().min(1).max(500),text=z.string().trim().max(10000);
const lines=z.array(label).max(200),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const price=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('on_request')}).strict(),
 z.object({mode:z.literal('fixed'),amountMinor:z.number().int().positive().max(1000000000),currency:z.enum(['THB','USD','EUR','RUB']),unit:label,audience:z.enum(['adult','group','all']),validFrom:date,validUntil:date.nullable()}).strict(),
]).superRefine((p,ctx)=>{if(p.mode==='fixed'&&p.validUntil&&p.validUntil<p.validFrom)ctx.addIssue({code:'custom',message:'Конечная дата цены раньше начальной.'});});
export const creationPayloadSchema=z.object({
 title:label,description:text.min(1),slug:z.string().trim().max(100).regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/),category:z.enum(['sea','adventure','nature','culture','evening','beyond']),
 image:editorPayloadSchema.shape.image,imageAlt:z.string().trim().max(1000),
 variant:z.object({name:label,description:text.min(1),duration:label,days:z.number().int().min(1).max(365),transport:label,format:label,
  itinerary:programmeItemsSchema,includes:lines.min(1),extras:lines,conditions:lines,
  stops:z.array(z.object({destinationId:z.string().min(1).max(100),visitType:z.enum(['landing','snorkeling','boat_view','water_stop','passage','optional','conditional']),required:z.boolean(),note:text}).strict()).min(1).max(30),price,
 }).strict(),
}).strict().superRefine((p,ctx)=>{if(p.image&&!p.imageAlt)ctx.addIssue({code:'custom',path:['imageAlt'],message:'Добавьте описание изображения.'});if(new Set(p.variant.stops.map(s=>s.destinationId)).size!==p.variant.stops.length)ctx.addIssue({code:'custom',path:['variant','stops'],message:'Место указано дважды.'});});
export type CreationPayload=z.infer<typeof creationPayloadSchema>;
export interface CreationDraft {id:string;requestId:string;productId:string;slug:string;baseReleaseId:string;baseGeneration:number;revision:number;status:'editing'|'cancelled'|'published';payload:CreationPayload;updatedAt:string;publishedReleaseId:string|null;publishedGeneration:number|null}
export function creationErrorMessage(error:unknown){if(error instanceof z.ZodError){const p=error.issues[0]?.path.join('.')||'';const names:Record<string,string>={title:'название',description:'описание',category:'категорию',slug:'адрес карточки латиницей',imageAlt:'описание изображения','variant.name':'название программы','variant.description':'описание программы','variant.duration':'длительность','variant.days':'число дней','variant.transport':'транспорт','variant.format':'формат','variant.itinerary':'программу по пунктам','variant.includes':'что включено','variant.stops':'места и тип посещения','variant.price':'цену или вариант «по запросу»'};return 'Проверьте '+(names[p]||names[Object.keys(names).find(k=>p.startsWith(k+'.'))||'']||'обязательные поля')+'.';}return error instanceof Error?error.message:'Не удалось сохранить черновик.';}
