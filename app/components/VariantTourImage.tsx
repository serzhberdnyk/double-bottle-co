'use client';
import type {ComponentProps} from 'react';
import type {Tour,Variant} from '@/lib/public/types';
import {variantImageTour} from '@/lib/public/variant-image';
import {TourImage} from './TourImage';

type Props=Omit<ComponentProps<typeof TourImage>,'tour'|'src'|'alt'>&{tour:Tour;variant:Variant};

/** A broken override falls back to the existing common image, not another variant. */
export function VariantTourImage({tour,variant,...props}:Props){
 const selected=variantImageTour(tour,variant);
 const common=<TourImage {...props} tour={tour} src={tour.image} alt={tour.imageAlt}/>;
 return selected===tour?common:<TourImage {...props} key={variant.id+':'+selected.image} tour={selected} src={selected.image} alt={selected.imageAlt} fallback={common}/>;
}
