import {phuketAirport} from './airport-landmark';
import {bigBuddha} from './reference-landmarks';

/** Supplemental places only. Catalogue destinations keep their own interaction. */
export type MapPOIItem = {
  readonly id:string;
  readonly kind:'airport'|'landmark';
  readonly title:string;
  readonly shortLabel:string;
  readonly category:string;
  readonly image:string;
  /** Visible artwork size in CSS pixels; independent of the native hit target. */
  readonly imageSize:number;
  readonly descriptions:readonly string[];
  readonly notice?:string;
  readonly caution?:string;
  readonly link?:{readonly href:string;readonly label:string};
};

/** Pixels in the original artwork, never longitude/latitude or engine coordinates. */
export type ArtAnchor = {readonly x:number;readonly y:number};
export const SOURCE_ART_SIZE = {width:1280,height:1083} as const;

/** The containing layer must match the full artwork's box, including any crop. */
export function artAnchorPosition(anchor:ArtAnchor):{left:string;top:string} {
  if(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y)||
    anchor.x<0||anchor.x>SOURCE_ART_SIZE.width||anchor.y<0||anchor.y>SOURCE_ART_SIZE.height) {
    throw new RangeError('MapPOI anchor must be within the 1280 × 1083 source artwork.');
  }
  return {
    left:`${anchor.x/SOURCE_ART_SIZE.width*100}%`,
    top:`${anchor.y/SOURCE_ART_SIZE.height*100}%`,
  };
}

export const phuketAirportPOI = {
  id:phuketAirport.id,
  kind:'airport',
  title:phuketAirport.name,
  shortLabel:'Аэропорт',
  category:'Аэропорт',
  image:'/media/reference/airport-plane-cutout.png',
  imageSize:48,
  descriptions:[phuketAirport.placeholder],
} as const satisfies MapPOIItem;

export const bigBuddhaPOI = {
  id:bigBuddha.id,
  kind:'landmark',
  title:bigBuddha.name,
  shortLabel:bigBuddha.name,
  category:'Достопримечательность',
  image:bigBuddha.image,
  imageSize:40,
  descriptions:[bigBuddha.description],
  notice:'Программы с подтверждённой остановкой здесь пока не привязаны в каталоге.',
  caution:'Возможность посещения и режим работы нужно уточнять отдельно.',
  link:{href:'/#selected',label:'Посмотреть все экскурсии'},
} as const satisfies MapPOIItem;

// Intentionally no art anchors: placement must be reviewed separately.
export const supplementaryPOIs = [phuketAirportPOI,bigBuddhaPOI] as const;
