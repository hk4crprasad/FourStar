import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@fontsource-variable/manrope';
import './globals.css';
import { AppTheme } from '@/components/theme';

export const metadata: Metadata = {
  title: { default: 'Tamarind Social | Indian Kitchen', template: '%s | Tamarind Social' },
  description: 'Order tandoor favourites, slow-cooked curries and more from Tamarind Social.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppTheme>{children}</AppTheme></body></html>;
}
