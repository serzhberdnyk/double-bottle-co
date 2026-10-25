// Admin-only presentation of the immutable snapshots returned by /api/admin.
// Never import this data flow into a public page or persist it in browser storage.
export type Inquiry = {
  id: string;
  createdAt: string;
  status: string;
  product: string;
  variant: string;
  options: string[];
  name: string;
  contact: string;
  date: string;
  adults: string;
  children: string;
  childrenAges: string;
  note: string;
  incomplete: boolean;
};

const missing = 'Не указано';
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : missing;
}
function count(value: unknown): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : missing;
}
function snapshot(value: unknown): {data: Record<string, unknown>; valid: boolean} {
  try {
    const data: unknown = typeof value === 'string' ? JSON.parse(value) : null;
    return record(data) ? {data, valid: true} : {data: {}, valid: false};
  } catch {
    return {data: {}, valid: false};
  }
}

export function inquiryRows(value: unknown): Inquiry[] {
  if (!record(value) || !Array.isArray(value.inquiries)) throw Error('Не удалось прочитать список заявок.');
  return value.inquiries.map((row: unknown) => {
    if (!record(row) || typeof row.id !== 'string' || !row.id) throw Error('Не удалось прочитать список заявок.');
    const saved = snapshot(row.snapshot_json), contact = snapshot(row.contact_json);
    const s = saved.data, c = contact.data;
    return {
      id: row.id,
      createdAt: text(row.created_at),
      status: text(row.status),
      product: text(s.productTitle),
      variant: text(s.variantName),
      options: Array.isArray(s.selectedOptions)
        ? s.selectedOptions.filter(record).map(option => text(option.label)).filter(label => label !== missing) : [],
      name: text(c.name),
      contact: text(c.contact),
      date: text(s.date),
      adults: count(s.adults),
      children: count(s.children),
      childrenAges: text(s.childrenAges),
      note: text(c.note),
      incomplete: !saved.valid || !contact.valid,
    };
  });
}

export function bangkokTimestamp(value: string): string {
  const stamp = new Date(value);
  if (!Number.isFinite(stamp.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(stamp);
}

export function travelDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Не указана';
  const stamp = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0, 10) !== value) return 'Не указана';
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

export function inquiryStatus(value: string): string {
  // The current database stores "new". Preserve any future status verbatim.
  return value === 'new' ? 'Новая' : value;
}

export async function loadInquiries(signal: AbortSignal): Promise<Inquiry[]> {
  const response = await fetch('/api/admin', {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
  });
  if (response.status === 401 || response.status === 403) throw Error('Доступ закрыт. Войдите в аккаунт администратора и обновите страницу.');
  if (!response.ok) throw Error('Не удалось загрузить заявки. Попробуйте обновить список.');
  return inquiryRows(await response.json());
}
