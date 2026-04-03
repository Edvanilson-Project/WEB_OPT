"use client"
import { Grid, Box, Stack, Typography, Chip } from '@mui/material';
import PageContainer from '@/app/components/container/PageContainer';
import AuthLogin from '../../authForms/AuthLogin';

export default function Login() {
  return (
    <PageContainer title="OTIMIZ — Login" description="Plataforma de Otimização de Transporte Público">
      <Grid container sx={{ minHeight: '100vh' }}>
        {/* ── Painel esquerdo — branding ────────────────────────────────── */}
        <Grid
          item
          xs={false}
          lg={6}
          xl={7}
          sx={{
            background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 40%, #01579B 100%)',
            position: 'relative',
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            p: 6,
          }}
        >
          {/* Círculos decorativos */}
          {[
            { size: 420, top: -100, right: -100, opacity: 0.08 },
            { size: 280, bottom: -60, left: -60, opacity: 0.07 },
            { size: 180, top: '40%', left: '10%', opacity: 0.05 },
          ].map((c, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: c.size,
                height: c.size,
                borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.6)',
                top: c.top,
                bottom: c.bottom,
                left: c.left,
                right: c.right,
                opacity: c.opacity,
              }}
            />
          ))}

          {/* Conteúdo */}
          <Box sx={{ position: 'relative', textAlign: 'center', maxWidth: 480 }}>
            {/* Logo / ícone */}
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                <path d="M8 28L14 16L20 22L26 10L34 28H8Z" fill="white" opacity="0.9"/>
                <circle cx="34" cy="14" r="5" fill="white" opacity="0.6"/>
              </svg>
            </Box>

            <Typography
              variant="h2"
              fontWeight={800}
              color="white"
              letterSpacing="-0.5px"
              gutterBottom
            >
              OTIMIZ
            </Typography>

            <Typography
              variant="h5"
              color="rgba(255,255,255,0.8)"
              fontWeight={400}
              mb={4}
            >
              Plataforma de Otimização de<br />Transporte Público
            </Typography>

            <Stack direction="row" gap={1.5} justifyContent="center" flexWrap="wrap">
              {[
                'Escalonamento de Veículos',
                'Otimização de Equipes',
                'Análise em Tempo Real',
                'Relatórios Avançados',
              ].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.3)',
                    border: '1px solid',
                    fontWeight: 500,
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Rodapé */}
          <Typography
            variant="caption"
            color="rgba(255,255,255,0.45)"
            sx={{ position: 'absolute', bottom: 24 }}
          >
            © {new Date().getFullYear()} OTIMIZ — Todos os direitos reservados
          </Typography>
        </Grid>

        {/* ── Painel direito — formulário ───────────────────────────────── */}
        <Grid
          item
          xs={12}
          lg={6}
          xl={5}
          display="flex"
          alignItems="center"
          justifyContent="center"
          sx={{ bgcolor: 'background.default' }}
        >
          <Box sx={{ width: '100%', maxWidth: 420, px: { xs: 3, sm: 5 }, py: 6 }}>
            {/* Logo mobile */}
            <Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={800} color="primary">OTIMIZ</Typography>
            </Box>

            <AuthLogin
              title="Bem-vindo de volta"
              subtext={
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Faça login para acessar a plataforma de otimização.
                </Typography>
              }
              subtitle={
                <Box mt={3} textAlign="center">
                  <Typography variant="caption" color="text.disabled">
                    admin@otimiz.com · 123456
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
