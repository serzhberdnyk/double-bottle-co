import type {Locale} from '@/lib/i18n/core';

/** Copy for the supplied illustration only; no geographic or commercial data. */
export const cheowLanMapCopy = {
  ru: {
    title: 'Чео Лан',
    description: 'Иллюстрированная карта Чео Лан.',
    open: 'Открыть карту Чео Лан',
    back: 'К основной карте',
    map: 'Карта Чео Лан',
    alt: 'Иллюстрированная карта Чео Лан: озеро, горы и побережье',
    zoomIn: 'Увеличить карту',
    zoomOut: 'Уменьшить карту',
    reset: 'Целиком',
    resetLabel: 'Показать карту целиком',
    zoom: 'Масштаб',
    hint: 'Увеличьте карту и прокручивайте её, чтобы рассмотреть детали. Для возврата к полному виду нажмите «Целиком».',
    note: 'Художественная иллюстрация, не навигационная карта.',
  },
  en: {
    title: 'Cheow Lan',
    description: 'An illustrated map of Cheow Lan.',
    open: 'Open the Cheow Lan map',
    back: 'Back to the main map',
    map: 'Cheow Lan map',
    alt: 'Illustrated map of Cheow Lan: the lake, mountains and coast',
    zoomIn: 'Zoom in on the map',
    zoomOut: 'Zoom out of the map',
    reset: 'Fit map',
    resetLabel: 'Show the entire map',
    zoom: 'Zoom',
    hint: 'Zoom in and scroll to explore the details. Select “Fit map” to return to the full view.',
    note: 'An artistic illustration, not a navigation map.',
  },
  th: {
    title: 'เชี่ยวหลาน',
    description: 'แผนที่ภาพวาดเชี่ยวหลาน',
    open: 'เปิดแผนที่เชี่ยวหลาน',
    back: 'กลับไปยังแผนที่หลัก',
    map: 'แผนที่เชี่ยวหลาน',
    alt: 'แผนที่ภาพวาดเชี่ยวหลาน แสดงทะเลสาบ ภูเขา และชายฝั่ง',
    zoomIn: 'ขยายแผนที่',
    zoomOut: 'ย่อแผนที่',
    reset: 'ดูทั้งแผนที่',
    resetLabel: 'แสดงแผนที่ทั้งหมด',
    zoom: 'ระดับการขยาย',
    hint: 'ขยายและเลื่อนแผนที่เพื่อดูรายละเอียด กด “ดูทั้งแผนที่” เพื่อกลับไปยังมุมมองเต็ม',
    note: 'ภาพประกอบเชิงศิลปะ ไม่ใช่แผนที่สำหรับการนำทาง',
  },
} satisfies Record<Locale, Record<string, string>>;

export const cheowLanMapPath = '/cheow-lan';
