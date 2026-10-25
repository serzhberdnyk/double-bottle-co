const merc=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;
// One spherical Mercator transform for coastlines, markers and route schematics.
export function project(lng:number,lat:number):[number,number]{return [430+(lng-98.38)*605,350-(merc(lat)-merc(8.04))*605];}
export function geometryPath(geometry:{type:string;coordinates:any}):string{const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];return polygons.map((poly:number[][][])=>poly.map(ring=>ring.map(([lng,lat],i)=>{const [x,y]=project(lng,lat);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join('')+'Z').join('')).join('');}
