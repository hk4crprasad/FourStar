// The tamarind theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in tamarind.settings.json and the generated tamarind.settings.ts;
// change them with `astryx experimental theme editor set tamarind ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {tamarindSettings} from './tamarind.settings';

export const tamarindTheme = defineTheme({
  extends: tamarindSettings,
  name: 'tamarind',
  tokens: {
    '--color-background-card': ['#ffffff', '#252925'],
  },
  localTokens: {
    '--phirmy-accent': 'var(--color-accent)',
    '--phirmy-card': 'var(--color-background-card)',
    '--phirmy-checkout': '#ff8500',
    '--phirmy-orange-light': '#ffac54',
    '--phirmy-lime-text': '#a8df60',
    '--phirmy-dark': '#101211',
    '--phirmy-mode': '#151815',
    '--phirmy-border': '#2c322c',
    '--phirmy-border-strong': '#3e473e',
    '--phirmy-danger': '#ff938a',
    '--phirmy-hero-muted': '#d4d4cc',
  },
});
