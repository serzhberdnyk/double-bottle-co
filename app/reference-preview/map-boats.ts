/** Approved points in the original map images, independent of viewport and zoom. */
export const mapBoats = {
  diving: {
    map: {width:1280, height:1083}, anchor: {x:469.304, y:462.014},
    source:'/media/reference/diving-user-boat.png', optimized:'/media/reference/diving-user-boat.webp',
    width:1774, height:887,
    ru:{title:'Дайвинг', action:'Дайвинг: слегка покачать лодку'},
    en:{title:'Diving', action:'Diving: gently rock the boat'},
  },
  pirate: {
    map: {width:738, height:2048}, anchor: {x:422.377, y:1340.279},
    source:'/media/reference/pirate-user-boat.png', optimized:'/media/reference/pirate-user-boat.webp',
    width:1536, height:1024,
    ru:{title:'Пиратская прогулка', action:'Пиратская прогулка: слегка покачать корабль'},
    en:{title:'Pirate boat trip', action:'Pirate boat trip: gently rock the ship'},
  },
} as const;

export function boatAnchorPosition(kind: keyof typeof mapBoats) {
  const {anchor,map} = mapBoats[kind];
  return {left:`${anchor.x/map.width*100}%`, top:`${anchor.y/map.height*100}%`};
}
