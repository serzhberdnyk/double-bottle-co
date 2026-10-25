import type {Locale} from '@/lib/i18n/core';

/** Interface copy only. Editorial route and point names remain exactly as saved. */
export const mapRouteCopy: Record<Locale, {
  routes: string; tourMap: string; schematic: string; point: string; closed: string;
  openTour: string; region: string; regionNotice: string; regionAlt: string; regionCaption: string;
}> = {
  ru: {
    routes: 'Маршруты на карте', tourMap: 'Маршрут экскурсии на карте', closed: 'Замкнутый маршрут',
    schematic: 'Схематичный маршрут на иллюстрации, не GPS-навигация. Программа экскурсии и порядок остановок уточняются отдельно.',
    point: 'Точка', openTour: 'Экскурсия', region: 'Регион поездки на карте',
    regionNotice: 'Схематичный обзор региона. Расположение мест показано условно; это не маршрут поездки.',
    regionAlt: 'Схематичная карта Андаманского региона для общего знакомства с местностью', regionCaption: 'Региональный ориентир',
  },
  en: {
    routes: 'Routes on the map', tourMap: 'Tour route on the map', closed: 'Closed-loop route',
    schematic: 'Schematic route on an illustration, not GPS navigation. The tour programme and order of stops are confirmed separately.',
    point: 'Point', openTour: 'Tour', region: 'Tour region on the map',
    regionNotice: 'An overview of the region. Locations are approximate; this is not the tour route.',
    regionAlt: 'Schematic map of the Andaman region for a general overview', regionCaption: 'Regional reference',
  },
  th: {
    routes: 'เส้นทางบนแผนที่', tourMap: 'เส้นทางทัวร์บนแผนที่', closed: 'เส้นทางแบบวงรอบ',
    schematic: 'เส้นทางโดยสังเขปบนภาพ ไม่ใช่ระบบนำทาง GPS โปรแกรมทัวร์และลำดับจุดแวะจะยืนยันแยกต่างหาก',
    point: 'จุด', openTour: 'ทัวร์', region: 'พื้นที่ท่องเที่ยวบนแผนที่',
    regionNotice: 'ภาพรวมของภูมิภาค ตำแหน่งสถานที่เป็นเพียงโดยประมาณ ไม่ใช่เส้นทางทัวร์',
    regionAlt: 'แผนที่โดยสังเขปของภูมิภาคอันดามันเพื่อดูภาพรวม', regionCaption: 'ภาพรวมภูมิภาค',
  },
};
