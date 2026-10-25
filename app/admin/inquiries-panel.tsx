'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {bangkokTimestamp, inquiryStatus, loadInquiries, travelDate, type Inquiry} from './inquiries-data';
import styles from './inquiries-panel.module.css';
import {unseenInquiryIds} from '@/lib/public/inquiry-notifications';

type ListProps = {rows: Inquiry[] | null; loading: boolean; error: string; onRefresh: () => void};

export function InquiriesList({rows, loading, error, onRefresh}: ListProps) {
  return <section className={`admin-section ${styles.panel}`} aria-labelledby="admin-inquiries-title" aria-busy={loading}>
    <div className={styles.heading}>
      <h2 id="admin-inquiries-title">Заявки</h2>
      <button type="button" onClick={onRefresh} disabled={loading}>Обновить заявки</button>
    </div>
    <p className={styles.hint}>Последние 50 заявок, сначала новые. Дата получения — Бангкок (UTC+7). Только просмотр.</p>
    {loading && <p role="status">{rows ? 'Обновление заявок…' : 'Загрузка заявок…'}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!loading && !error && rows?.length === 0 && <p role="status">Заявок пока нет.</p>}
    {rows && rows.length > 0 && <ol className={styles.list}>
      {rows.map(row => <li key={row.id} className={styles.card}>
        <div className={styles.cardHeading}>
          <div><span className={styles.label}>Получена · Бангкок (UTC+7)</span><p>{bangkokTimestamp(row.createdAt)}</p></div>
          <span className={styles.status}>Статус: {inquiryStatus(row.status)}</span>
        </div>
        <p className={styles.id}>Номер: {row.id}</p>
        <dl className={styles.fields}>
          <div><dt>Программа / вариант</dt><dd><strong>{row.product}</strong><br/>{row.variant}{row.options.map((option, index) => <p key={index}>{option}</p>)}</dd></div>
          <div><dt>Имя / контакт</dt><dd><strong>{row.name}</strong><br/>{row.contact}</dd></div>
          <div><dt>Желаемая дата поездки</dt><dd>{travelDate(row.date)}</dd></div>
          <div><dt>Состав гостей</dt><dd>Взрослые: {row.adults} · Дети: {row.children}{row.childrenAges !== 'Не указано' && <p>Возраст детей: {row.childrenAges}</p>}</dd></div>
          <div className={styles.comment}><dt>Комментарий</dt><dd>{row.note}</dd></div>
        </dl>
        {row.incomplete && <p className={styles.error}>Часть сохранённых данных не удалось прочитать.</p>}
      </li>)}
    </ol>}
  </section>;
}

export function InquiriesPanel() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const seen=useRef<Set<string>|null>(null),open=useRef(false);
  const [unread,setUnread]=useState(0),[toast,setToast]=useState(0);

  const receive = useCallback((signal: AbortSignal) => {
    void loadInquiries(signal).then(next => {
      if (!signal.aborted) {const added=unseenInquiryIds(seen.current,next);seen.current=new Set([...(seen.current||[]),...next.map(row=>row.id)].slice(-1000));if(added.length){if(!open.current)setUnread(n=>n+added.length);setToast(n=>n+added.length);}setRows(next); setError(''); setLoading(false);}
    }, () => {
      if (!signal.aborted) {
        // Clear personal data on any failed refresh, including expired access.
        setRows(null);
        setError('Не удалось загрузить заявки. Проверьте вход в аккаунт администратора и обновите список.');
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const request = new AbortController();
    pending.current = request;
    void receive(request.signal);
    const timer=setInterval(()=>{if(document.hidden)return;const next=new AbortController();pending.current?.abort();pending.current=next;void receive(next.signal);},30000);
    return () => {clearInterval(timer);pending.current?.abort();};
  }, [receive]);

  function refresh() {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    setError('');
    void receive(request.signal);
  }

  return <><details className={styles.window} onToggle={event=>{open.current=event.currentTarget.open;if(open.current)setUnread(0);}}><summary>Заявки {unread>0&&<span className={styles.badge} aria-label={'Новых заявок: '+unread}>{unread}</span>}</summary><div className={styles.popup}><InquiriesList rows={rows} loading={loading} error={error} onRefresh={refresh}/></div></details>{toast>0&&<div className={styles.toast} role="status" aria-live="polite">Новые заявки: {toast}<button type="button" onClick={()=>setToast(0)} aria-label="Закрыть уведомление о новых заявках">×</button></div>}</>;
}
