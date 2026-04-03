'use client';

import { Card, CardContent, Typography, Stack, Box, Skeleton } from '@mui/material';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;   // Percentual de variação (positivo/negativo)
  loading?: boolean;
}

export default function KpiCard({ title, value, subtitle, icon, color, trend, loading }: Props) {
  const trendPositive = trend !== undefined && trend > 0;
  const trendNeutral  = trend === undefined || trend === 0;

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: '20px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
              {title}
            </Typography>

            {loading ? (
              <Skeleton variant="text" width={80} height={40} sx={{ mt: 0.5 }} />
            ) : (
              <Typography variant="h3" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}

            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}

            {trend !== undefined && !loading && (
              <Stack direction="row" alignItems="center" gap={0.5} mt={1}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: trendNeutral ? 'text.secondary' : trendPositive ? 'success.main' : 'error.main',
                  }}
                >
                  {trendNeutral ? (
                    <IconMinus size={14} />
                  ) : trendPositive ? (
                    <IconTrendingUp size={14} />
                  ) : (
                    <IconTrendingDown size={14} />
                  )}
                  <Typography variant="caption" fontWeight={600} ml={0.3}>
                    {Math.abs(trend)}%
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  vs. mês anterior
                </Typography>
              </Stack>
            )}
          </Box>

          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              bgcolor: `${color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
