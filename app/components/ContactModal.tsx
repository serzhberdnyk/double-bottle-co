'use client';

import type {ReactNode} from 'react';
import {Dialog} from 'radix-ui';
import {ArrowUpRight, MessageCircle, X} from 'lucide-react';
import {useI18n} from '@/lib/i18n/context';
import {businessContacts} from '@/lib/public/business-contacts';
import styles from './ContactModal.module.css';

/** Contact navigation only. Radix handles focus trapping/return, Escape and scroll locking. */
export function ContactModal({children,className}:{children:ReactNode;className?:string}) {
  const {locale,t}=useI18n();
  return <Dialog.Root modal>
    <Dialog.Trigger asChild><button type="button" className={className}>{children}</button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.panel} lang={locale}>
        <span className={styles.brand}>Double Bottle Co’</span>
        <Dialog.Title className={styles.title}>{t('Напишите нам')}</Dialog.Title>
        <Dialog.Description className={styles.description}>{t('Выберите удобный способ связи.')}</Dialog.Description>
        <div className={styles.contacts}>
          {businessContacts.map(contact=><a key={contact.service} className={styles.contact} href={contact.href} target="_blank" rel="noopener noreferrer" aria-label={t('Написать Double Bottle Co’ в {0} (откроется в новой вкладке)').replace('{0}',contact.label)}>
            <MessageCircle size={22} aria-hidden="true"/>
            <span>{contact.label}</span>
            <ArrowUpRight size={20} aria-hidden="true"/>
          </a>)}
        </div>
        <Dialog.Close className={styles.close} aria-label={t('Закрыть')}><X size={22} aria-hidden="true"/></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
