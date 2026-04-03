'use client';
import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeSettings } from '@/utils/theme/Theme';
import { useSelector } from '@/store/hooks';
import { AppState } from '@/store/store';
// Inicializa o i18n no lado do cliente
import '@/utils/i18n';

export default function MyApp({ children }: { children: React.ReactNode }) {
  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);

  useEffect(() => {
    document.dir = customizer.activeDir ?? 'ltr';
  }, [customizer.activeDir]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
