import type {MapRoute} from './map-layout';

/** A stable product ID, never a title or mutable slug, owns the association. */
export function routesForTour(routes:MapRoute[],tourId:string):MapRoute[]{
  return routes.filter(route=>route.tourId===tourId);
}
