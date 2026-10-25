import styles from './LicenseBadge.module.css';

/** Supplied emblem and owner-confirmed wording; no independent validity assertion. */
export function LicenseBadge() {
  return <div className={styles.badge} aria-label="TAT LICENSE 32/02104">
    <span className={styles.emblem} aria-hidden="true">
      {/* The source is preserved intact; CSS exposes only the supplied emblem. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/reference/tat-badge-user-reference.png" alt="" width="1000" height="1000" loading="lazy" decoding="async"/>
    </span>
    <span className={styles.words}><span>TAT LICENSE</span><strong>32/02104</strong></span>
  </div>;
}
