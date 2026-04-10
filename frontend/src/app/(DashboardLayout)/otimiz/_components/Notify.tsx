'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

// ─── Context ─────────────────────────────────────────────────────────────────
interface NotifyCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const Ctx = createContext<NotifyCtx>({
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────
export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('success');

  const show = useCallback((msg: string, sev: AlertColor) => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const value: NotifyCtx = useMemo(() => ({
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
    warning: (msg: string) => show(msg, 'warning'),
  }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useNotify() {
  return useContext(Ctx);
}
