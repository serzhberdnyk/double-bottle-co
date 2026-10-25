import type {MapPOIItem} from './supplementary-pois';

// Exact code-native silhouette from the approved motion mockup; the supplied raster logo remains preserved.
export const airportPlanePath='M12 1C13.1 1 13.7 2.2 13.7 3.7L13.7 8.2L22 13L22 15.7L13.7 13.1L13.7 19L17 21.1L17 23L12 21.6L7 23L7 21.1L10.3 19L10.3 13.1L2 15.7L2 13L10.3 8.2L10.3 3.7C10.3 2.2 10.9 1 12 1Z';

export function POIArtwork({item,size,className}:{item:MapPOIItem;size:number;className?:string}) {
  if(item.kind==='airport'&&item.image==='/media/reference/airport-plane.svg')return <svg className={className} width={size} height={size}
    style={{width:size,height:size}} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={airportPlanePath} fill="#fbf8ee" stroke="#0b3439" strokeWidth=".85" strokeLinejoin="round"/>
  </svg>;
  return <img className={className} src={item.image} alt="" draggable={false}
    width={size} height={size} style={{width:size,height:size}}/>;
}
