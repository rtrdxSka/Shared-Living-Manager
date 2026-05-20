import { createContext } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeProviderContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeProviderContext = createContext<
  ThemeProviderContextValue | undefined
>(undefined);
