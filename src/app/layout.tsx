import './globals.css';
import { Inter } from 'next/font/google';
import Header from '@/components/Headers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Astro Consult',
  description: 'Get answers from astrologers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Header />
        {children}
      </body>
    </html>
  );
}