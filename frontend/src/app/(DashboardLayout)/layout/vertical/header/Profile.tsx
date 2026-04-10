'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Menu,
  Avatar,
  Typography,
  Divider,
  Button,
  IconButton,
} from '@mui/material';
import { IconMail, IconUser, IconSettings, IconPower } from '@tabler/icons-react';
import { Stack } from '@mui/system';
import { getSessionUser, clearSession, type SessionUser } from '@/lib/api';
import Link from 'next/link';

const Profile = () => {
  const [anchorEl2, setAnchorEl2] = useState(null);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser(u);
  }, []);

  const handleClick2 = (event: any) => {
    setAnchorEl2(event.currentTarget);
  };
  const handleClose2 = () => {
    setAnchorEl2(null);
  };
  const handleLogout = () => {
    clearSession();
    window.location.href = '/auth/auth1/login';
  };

  const initials = (user?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <Box>
      <IconButton
        size="large"
        aria-label="perfil do usuário"
        color="inherit"
        aria-controls="msgs-menu"
        aria-haspopup="true"
        sx={{
          ...(typeof anchorEl2 === 'object' && {
            color: 'primary.main',
          }),
        }}
        onClick={handleClick2}
      >
        <Avatar
          sx={{ width: 35, height: 35, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}
        >
          {initials}
        </Avatar>
      </IconButton>
      <Menu
        id="msgs-menu"
        anchorEl={anchorEl2}
        keepMounted
        open={Boolean(anchorEl2)}
        onClose={handleClose2}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        sx={{
          '& .MuiMenu-paper': {
            width: '280px',
            p: 3,
          },
        }}
      >
        <Typography variant="h5" mb={1}>Meu Perfil</Typography>
        <Stack direction="row" py={2} spacing={2} alignItems="center">
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 22, fontWeight: 700 }}>
            {initials}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {user?.name ?? 'Usuário'}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'company_admin' ? 'Administrador' : user?.role === 'analyst' ? 'Analista' : 'Operador'}
            </Typography>
            {user?.email && (
              <Typography variant="caption" color="textSecondary" display="flex" alignItems="center" gap={0.5}>
                <IconMail width={14} height={14} />
                {user.email}
              </Typography>
            )}
          </Box>
        </Stack>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ py: 1 }}>
          <Button
            component={Link}
            href="/otimiz/settings"
            startIcon={<IconSettings size={18} />}
            fullWidth
            sx={{ justifyContent: 'flex-start', textTransform: 'none', color: 'text.primary' }}
            onClick={handleClose2}
          >
            Configurações
          </Button>
        </Box>
        <Box mt={1}>
          <Button
            onClick={handleLogout}
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={<IconPower size={18} />}
          >
            Sair
          </Button>
        </Box>
      </Menu>
    </Box>
  );
};

export default Profile;
