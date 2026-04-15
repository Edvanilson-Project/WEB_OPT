'use client';
import React, { useMemo } from 'react';
import {
  Box, Stack, Typography, Paper,
  alpha, useTheme,
} from '@mui/material';
import { IconSparkles } from '@tabler/icons-react';

interface AiCopilotInsightProps {
  /** Texto de 3 bullet points gerado pelo AI Copilot. Null = não renderiza nada. */
  insight: string | null | undefined;
}

/**
 * AiCopilotInsight — Exibe um card premium com o insight gerado pelo AI Copilot.
 *
 * Comportamento:
 * - Se `insight` for null/undefined/"": retorna null silenciosamente (sem skeleton).
 * - Se preenchido: exibe card com gradiente, ícone sparkles e bullet points formatados.
 *
 * O texto é gerado pelo Python (OpenRouter) em texto plano com hifens como bullets,
 * sem nenhum Markdown — seguro para renderizar diretamente em React.
 */
export function AiCopilotInsight({ insight }: AiCopilotInsightProps) {
  const theme = useTheme();

  // Divide o texto em bullet points, filtrando linhas vazias
  const bullets = useMemo(() => {
    if (!insight) return [];
    return insight
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [insight]);

  // Não renderiza nada se não houver insight
  if (!bullets.length) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 4,
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.25),
        background: `linear-gradient(135deg, 
          ${alpha(theme.palette.primary.main, 0.03)} 0%, 
          ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
        position: 'relative',
        animation: 'fadeIn 0.5s ease-out',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          borderRadius: '4px 0 0 4px',
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ p: 2.5, pl: 3 }}>
        {/* Ícone de IA */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.25,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
        >
          <IconSparkles size={18} color="#fff" />
        </Box>

        {/* Conteúdo */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
            <Typography
              variant="caption"
              fontWeight={800}
              sx={{
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                fontSize: '0.62rem',
                color: 'primary.main',
              }}
            >
              AI Copilot
            </Typography>
            <Box
              sx={{
                height: 4,
                width: 4,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.4),
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '0.65rem', fontWeight: 500 }}
            >
              Análise gerada por IA · OpenRouter
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            {bullets.map((bullet, idx) => (
              <Stack
                key={idx}
                direction="row"
                alignItems="flex-start"
                spacing={1.5}
              >
                {/* Indicador colorido por posição: verde → vermelho → azul */}
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    flexShrink: 0,
                    mt: 0.75,
                    bgcolor:
                      idx === 0
                        ? 'success.main'
                        : idx === 1
                        ? 'warning.main'
                        : 'primary.main',
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    lineHeight: 1.65,
                    color: 'text.primary',
                    fontWeight: idx === 0 ? 500 : 400,
                    // Remove o hífen do início se o LLM o incluir (fica redundante com o ponto colorido)
                    '&::first-letter': {},
                  }}
                >
                  {/* Remove o hífen inicial se presente (o ponto colorido já serve de bullet) */}
                  {bullet.startsWith('-') ? bullet.slice(1).trimStart() : bullet}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
