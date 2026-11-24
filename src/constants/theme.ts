import { Platform } from 'react-native';

export const COLORS = {
  // Exact ivory sampled from the Gratia logo (#FDF9F1) + warm parchment layers
  ivory: '#FDF9F1',
  background: '#F6F1E7',
  surface: '#FFFFFF',
  surfaceWarm: '#FDF9F1',
  surfaceAlt: '#ECE5D5',

  // Deep Sacred Cypress / Botanical Green from the Gratia "G"
  primary: '#1C342B',
  primaryMid: '#294B3E',
  primaryDark: '#12231D',
  primaryLight: '#E5EFEA',

  // Antique Liturgical Gold from the Cross inside "G"
  accent: '#C09752',
  accentDark: '#967030',
  accentLight: '#F9F0DF',

  // High-legibility warm editorial ink
  text: '#17241F',
  textSecondary: '#55635C',
  textMuted: '#87928C',
  border: '#E2DAC9',
  borderSubtle: '#EFE9DC',

  // Harmonized semantic states
  success: '#1E6F4C',
  successLight: '#E4F3EC',
  warning: '#B57018',
  warningLight: '#FDF1DF',
  danger: '#B4332A',
  dangerLight: '#FCEAE8',
  info: '#245B7A',
  infoLight: '#E6F1F7',
};

export const SERIF_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export const SHADOWS = {
  card: {
    shadowColor: '#12231D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  soft: {
    shadowColor: '#12231D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  floating: {
    shadowColor: '#12231D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const CURRENCY_OPTIONS = ['$', 'S/', 'COP$', 'MXN$', 'Bs.', '€', 'Q', 'RD$'];
