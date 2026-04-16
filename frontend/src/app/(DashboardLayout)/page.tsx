'use client'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid';
import PageContainer from '@/app/components/container/PageContainer';
import Welcome from "@/app/(DashboardLayout)/layout/shared/welcome/Welcome";
import Typography from '@mui/material/Typography';

export default function Dashboard() {
  return (
    <PageContainer title="Dashboard" description="OTIMIZ Dashboard">
      <Box mt={3}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="h4">Bem-vindo ao OTIMIZ</Typography>
            <Typography variant="body1">O motor matemático já está no ar. Utilize a barra lateral para acessar o Planejador e as Viagens.</Typography>
          </Grid>
        </Grid>
        <Welcome />
      </Box>
    </PageContainer>
  );
}
