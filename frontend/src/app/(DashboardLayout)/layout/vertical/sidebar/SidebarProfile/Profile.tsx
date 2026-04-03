import { Box, Avatar, Typography, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { useSelector } from '@/store/hooks';
import { IconPower } from '@tabler/icons-react';
import { AppState } from '@/store/store';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSessionUser, clearSession } from '@/lib/api';

export const Profile = () => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const lgUp = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const hideMenu = lgUp ? customizer.isCollapse && !customizer.isSidebarHover : '';
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser(u);
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/auth/auth1/login';
  };

  return (
    <Box
      display={'flex'}
      alignItems="center"
      gap={2}
      sx={{ m: 3, p: 2, bgcolor: `${'secondary.light'}`, borderRadius: 2 }}
    >
      {!hideMenu ? (
        <>
          <Avatar sx={{ height: 40, width: 40, bgcolor: 'primary.main', fontSize: 16, fontWeight: 700 }}>
            {(user?.name ?? 'U').charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="h6" noWrap>{user?.name ?? 'Usuário'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>Operador</Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Sair" placement="top">
              <IconButton
                color="primary"
                onClick={handleLogout}
                aria-label="sair"
                size="small"
              >
                <IconPower size="20" />
              </IconButton>
            </Tooltip>
          </Box>
        </>
      ) : (
        ''
      )}
    </Box>
  );
};
