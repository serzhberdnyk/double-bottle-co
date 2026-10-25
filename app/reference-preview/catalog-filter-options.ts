import type {Facets} from '../../lib/public/types';

// Keep the catalogue's real category IDs. Labels describe the programmes that
// exist today; category membership, routes and commercial data are unchanged.
const categories = [
  ['sea', 'Острова и море'],
  ['nature', 'Природа и парки'],
  ['adventure', 'Активный отдых'],
  ['culture', 'Обзорные экскурсии'],
  ['evening', 'Шоу и вечерние программы'],
  ['beyond', 'Поездки из Пхукета'],
] as const;

export function catalogFilterOptions(facets?: Facets) {
  return categories.filter(([id]) => facets?.categories.some(item => item.id === id && item.count > 0))
    .map(([id, name]) => ({id, name}));
}
