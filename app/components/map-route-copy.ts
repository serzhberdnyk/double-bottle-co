import type {Locale} from '@/lib/i18n/core';

/** Interface copy only. Editorial route and point names remain exactly as saved. */
export const mapRouteCopy: Record<Locale, {
  routes: string; tourMap: string; point: string; closed: string;
  openTour: string;
}> = {
  ru: {
    routes: 'Маршруты на карте', tourMap: 'Маршрут экскурсии на карте', closed: 'Замкнутый маршрут',
    point: 'Точка', openTour: 'Экскурсия',
  },
  en: {
    routes: 'Routes on the map', tourMap: 'Tour route on the map', closed: 'Closed-loop route',
    point: 'Point', openTour: 'Tour',
  },
  th: {
    routes: 'เส้นทางบนแผนที่', tourMap: 'เส้นทางทัวร์บนแผนที่', closed: 'เส้นทางแบบวงรอบ',
    point: 'จุด', openTour: 'ทัวร์',
  },
};
