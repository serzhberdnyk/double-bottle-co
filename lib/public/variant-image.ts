import {z} from 'zod';
import type {Tour,Variant} from './types';

/** Only the existing authenticated catalog uploader can provide variant images. */
export const variantImagePathSchema=z.string().regex(/^\/api\/catalog-media\/[a-f0-9]{64}$/);

/** Missing and legacy overrides retain the exact existing common-cover behavior. */
export function variantImageTour(tour:Tour,variant:Pick<Variant,'image'|'imageAlt'|'name'>):Tour{
 return variantImagePathSchema.safeParse(variant.image).success
  ?{...tour,image:variant.image!,imageAlt:variant.imageAlt||variant.name||tour.imageAlt}
  :tour;
}
