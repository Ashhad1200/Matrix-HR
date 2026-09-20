import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const description =
  'Run payroll, attendance, leave, hiring and performance from one multi-tenant platform built for South Asia and the Middle East.';

export const metadata: Metadata = {
  title: { default: 'MatrixHR | HR and payroll in one system', template: '%s | MatrixHR' },
  description,
  applicationName: 'MatrixHR',
  openGraph: { title: 'MatrixHR | HR and payroll in one system', description, type: 'website', siteName: 'MatrixHR' },
  twitter: { card: 'summary_large_image', title: 'MatrixHR | HR and payroll in one system', description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6faf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1211' },
  ],
};

// Stored choice wins; otherwise follow the OS setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} font-sans`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
