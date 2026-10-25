import type {Metadata} from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Визуальный предпросмотр',
  robots: {index: false, follow: false},
  alternates:{canonical:null},
};

// Retain existing review links without maintaining a second home implementation.
export {default} from '../page';
