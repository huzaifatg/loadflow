import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://loadflow-one.vercel.app'),
  title: 'LoadFlow | Logistics Management',
  description:
    'Streamline your logistics operations with LoadFlow — intelligent load planning, fleet management, and delivery tracking.',
  openGraph: {
    title: 'LoadFlow | Logistics Management',
    description:
      'Streamline your logistics operations with LoadFlow — intelligent load planning, fleet management, and delivery tracking.',
    url: 'https://loadflow-one.vercel.app/',
    siteName: 'LoadFlow',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LoadFlow — Logistics execution, reimagined.',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LoadFlow | Logistics Management',
    description:
      'Streamline your logistics operations with LoadFlow — intelligent load planning, fleet management, and delivery tracking.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LoadFlow — Logistics execution, reimagined.',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={inter.variable}>
      <body className={`${inter.className} antialiased transition-colors duration-200`}>
        {children}
        <Toaster richColors position="top-right" theme="light" />
      </body>
    </html>
  );
}
