'use client';

import type { ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/Stack';
import { themes, defaultThemeSlug } from '../src/astryx-themes';

export function AppTheme({ children }: { children: ReactNode }) {
  return <Theme theme={themes[defaultThemeSlug]} mode="dark">
    <VStack className="app-theme">{children}</VStack>
  </Theme>;
}
