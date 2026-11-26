import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@fontsource-variable/manrope';
import './globals.css';
import { AppTheme } from '@/components/theme';

export const metadata: Metadata = {
  title: { default: 'FourStar | Hotel & Indian Kitchen', template: '%s | FourStar' },
  description: 'Book a stay in Kataka and order from FourStar’s Indian kitchen.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppTheme>{children}</AppTheme></body></html>;
}
