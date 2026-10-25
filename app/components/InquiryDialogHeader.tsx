'use client';
import {useI18n} from '@/lib/i18n/context';


import {Dialog} from 'radix-ui';
import {X} from 'lucide-react';
import {businessContacts, type BusinessContact} from '@/lib/public/business-contacts';
import {useInquiryCopy} from './inquiry-copy';
import styles from './InquiryDialogHeader.module.css';

function ContactIcon({service}:{service:BusinessContact['service']}) {
  return service === 'telegram' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M21.6 3.1 2.9 10.3c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.5c.2.6.3.8.8.8.4 0 .6-.2.9-.5l2.4-2.3 5 3.7c.9.5 1.5.3 1.7-.8L23.2 5c.3-1.4-.5-2-1.6-1.9ZM8.3 12.9l10.9-6.8c.5-.3.9-.1.5.3l-9 8.1-.4 4.2-2-5.8Z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.2.2-.3.2-.6.1-1.2-.5-2.1-1.3-2.9-2.5-.2-.3 0-.4.1-.6l.5-.6.2-.4c.1-.2 0-.3 0-.5L10 8.2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.7.6-1 1.3-1 2.1 0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1 .4 1.8.6 2.4.4.8-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/>
    </svg>
  );
}

/** Plain navigation only: no message is sent and no form fields enter these URLs. */
export function InquiryDialogHeader() {
 const {href:localHref}=useI18n();

  const {language, copy} = useInquiryCopy();
  return <div className={styles.header} lang={language}>
    <Dialog.Title className={styles.title}>{copy.title}</Dialog.Title>
    {businessContacts.length > 0 && <section className={styles.contacts} aria-label={copy.alternative}>
      <h3 className={styles.note}>{copy.alternative}</h3>
      <p className={styles.hint}>{copy.alternativeHint}</p>
      <div className={styles.links}>
        {businessContacts.map(contact => <a key={contact.service} href={localHref(contact.href)} target="_blank" rel="noopener noreferrer" className={styles.contact} aria-label={copy.contactLabel(contact.label)}>
          <ContactIcon service={contact.service}/>
          <span>{contact.label}</span>
        </a>)}
      </div>
    </section>}
    <Dialog.Close className={styles.close} aria-label={copy.close}><X size={22} aria-hidden="true"/></Dialog.Close>
  </div>;
}
