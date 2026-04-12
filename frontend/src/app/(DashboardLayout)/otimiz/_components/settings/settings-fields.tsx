import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-react';
import type { HelpFieldKey, HelpMeta } from './settings-constants';
import { EFFECT_LABEL, FIELD_HELP } from './settings-constants';

export function NumberField({
  label,
  fieldKey,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  helperText,
  dense = false,
}: {
  label: string;
  fieldKey?: HelpFieldKey;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helperText?: string;
  dense?: boolean;
}) {
  const meta = fieldKey ? FIELD_HELP[fieldKey] : undefined;
  return (
    <TextField
      label={<FieldLabel text={label} meta={meta} />}
      type="number"
      size="small"
      fullWidth
      value={Number.isFinite(value) ? String(value).replace(/^0+(?=\d)/, '') : 0}
      inputProps={{ min, max, step }}
      helperText={helperText}
      onChange={(e) => onChange(Number(e.target.value))}
      InputProps={unit ? {
        endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
      } : undefined}
      sx={dense ? { '& .MuiInputBase-input': { py: '8px' } } : undefined}
    />
  );
}

export function FieldLabel({ text, meta }: { text: string; meta?: HelpMeta }) {
  if (!meta) return <>{text}</>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box component="span">{text}</Box>
      <Tooltip
        arrow
        placement="top"
        title={
          <Stack spacing={0.5} sx={{ maxWidth: 320 }}>
            <Typography variant="subtitle2" fontWeight={700}>{meta.title}</Typography>
            <Box>
              <Typography variant="caption" fontWeight={600} color="primary.light">Analogia</Typography>
              <Typography variant="body2">{meta.short}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600} color="secondary.light">Tecnico</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{meta.technical}</Typography>
            </Box>
            {meta.effect ? <Typography variant="caption" fontWeight={700}>{EFFECT_LABEL[meta.effect]}</Typography> : null}
          </Stack>
        }
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
          <IconInfoCircle size={14} />
        </Box>
      </Tooltip>
    </Box>
  );
}

export function SwitchField({
  fieldKey,
  label,
  checked,
  onChange,
}: {
  fieldKey: HelpFieldKey;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label={<FieldLabel text={label} meta={FIELD_HELP[fieldKey]} />}
    />
  );
}

export function SectionPanel({
  title,
  subtitle,
  icon,
  children,
  defaultExpanded = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '18px !important',
        overflow: 'hidden',
        backgroundImage: 'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, rgba(255,255,255,0) 100%)',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ px: 2.25, py: 0.5 }}>
        <Stack spacing={0.25} sx={{ width: '100%' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
              color: 'primary.main',
            }}>
              {icon}
            </Box>
            <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
          </Stack>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 5.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.25, pb: 2.25, pt: 0.5 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
