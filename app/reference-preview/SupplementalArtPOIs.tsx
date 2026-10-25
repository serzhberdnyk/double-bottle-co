'use client';

import {MapPOI} from './MapPOI';
import {supplementaryPOIs} from './supplementary-pois';
import {schematicPlacementNotice,supplementalArtAnchorFor} from './reference-art-anchors';
import {YonaBoardingPOI} from './YonaBoardingPOI';
import {MapBoat} from './MapBoat';
import {CustomMapPlaces} from './CustomMapContent';

/** Existing landmarks plus the explicitly labelled YONA boarding point. */
export function SupplementalArtPOIs() {
  return <><CustomMapPlaces placement="art"/>{supplementaryPOIs.map(item=>{
    const anchor=supplementalArtAnchorFor(item.id);
    return anchor?<MapPOI key={item.id} item={item} placement="art" anchor={anchor}
      placementNotice={schematicPlacementNotice}/>:null;
  })}<YonaBoardingPOI/><MapBoat kind="diving"/></>;
}
