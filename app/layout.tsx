import type { Metadata } from "next";
import {pageMetadata} from '@/lib/server/seo';
import "./globals.css";
import {currentLocale} from "@/lib/i18n/server";
import {LocaleProvider} from "@/lib/i18n/context";

export async function generateMetadata():Promise<Metadata> {return {
  ...await pageMetadata({title:'Double Bottle Co’ — экскурсии на Пхукете и в Таиланде',description:'Острова, природа и культура Таиланда. Выбирайте экскурсии и направления, сравнивайте варианты программ и запрашивайте условия на вашу дату.',path:'/'}),
  alternates:{canonical:null},
  title: { default: 'Double Bottle Co’ — экскурсии на Пхукете и в Таиланде', template: '%s · Double Bottle Co’' },
  icons: {
    icon: [{url:"/brand/favicon-v1.ico",sizes:"any"},{url:"/brand/favicon-32-v1.png",sizes:"32x32",type:"image/png"}],
    shortcut: "/brand/favicon-v1.ico",
    apple: "/brand/apple-touch-icon-v1.png",
  },
};}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale=await currentLocale();
  return (
    <html lang={locale}>
      <body><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
