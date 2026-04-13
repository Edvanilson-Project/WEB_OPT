import React from 'react';
import {
  Alert,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  IconBatteryCharging,
  IconMap2,
  IconMoon,
  IconRoute,
  IconScale,
  IconSettings,
  IconSparkles,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import { getSessionUser } from '@/lib/api';
import type { OptimizationSettings } from '../_types';
import type { SettingsFormValues } from './settings/settings-constants';
import { ALGORITHM_OPTIONS, FIELD_HELP } from './settings/settings-constants';
import { NumberField, FieldLabel, SwitchField, SectionPanel, SelectField } from './settings/settings-fields';

// Re-export everything consumers need from the barrel
export type { SettingsFormValues } from './settings/settings-constants';
export { ALGORITHM_OPTIONS, DEFAULT_SETTINGS_FORM } from './settings/settings-constants';
export {
  OPTIMIZATION_SETTINGS_DRAWER_EVENT,
  OPTIMIZATION_SETTINGS_UPDATED_EVENT,
  openOptimizationSettingsDrawer,
  notifyOptimizationSettingsUpdated,
  normalizeSettingsFromApi,
  normalizeSettingsForApi,
} from './settings/settings-utils';

export function OptimizationSettingsHighlights({
  settings,
  compact = false,
}: {
  settings: Partial<OptimizationSettings> | SettingsFormValues;
  compact?: boolean;
}) {
  const strictHardValidation = settings.strictHardValidation ?? true;
  const chips = [
    { label: ALGORITHM_OPTIONS.find((item) => item.value === settings.algorithmType)?.label ?? 'Algoritmo', color: 'primary' as const },
    { label: (settings.applyCct ?? true) ? 'CCT ativo' : 'CCT flexivel', color: (settings.applyCct ?? true) ? 'success' as const : 'warning' as const },
    { label: settings.useSetCovering ? 'Set covering' : 'Sem set covering', color: settings.useSetCovering ? 'info' as const : 'default' as const },
    { label: settings.pricingEnabled ? 'Pricing ligado' : 'Pricing desligado', color: settings.pricingEnabled ? 'secondary' as const : 'default' as const },
    { label: settings.preservePreferredPairs ? 'Ida/volta preservada' : 'Pairing flexivel', color: settings.preservePreferredPairs ? 'success' as const : 'default' as const },
    { label: settings.enforceTripGroupsHard ? 'Pares obrigatórios' : 'Pares flexíveis', color: settings.enforceTripGroupsHard ? 'success' as const : 'warning' as const },
    { label: strictHardValidation ? 'Hard estrito' : 'Hard auditável', color: strictHardValidation ? 'success' as const : 'warning' as const },
    { label: `Jornada ${settings.cctMaxShiftMinutes ?? 480} min`, color: 'default' as const },
    { label: `Budget ${settings.timeBudgetSeconds ?? 300}s`, color: 'default' as const },
  ];

  return (
    <Stack direction="row" flexWrap="wrap" gap={compact ? 0.75 : 1}>
      {chips.map((chip) => (
        <Chip
          key={chip.label}
          label={chip.label}
          color={chip.color}
          size={compact ? 'small' : 'medium'}
          variant={chip.color === 'default' ? 'outlined' : 'filled'}
          sx={{ borderRadius: 999 }}
        />
      ))}
    </Stack>
  );
}

export function OptimizationSettingsEditor({
  value,
  onChange,
  dense = false,
  showActivation = true,
  isNew = false,
}: {
  value: SettingsFormValues;
  onChange: <K extends keyof SettingsFormValues>(key: K, nextValue: SettingsFormValues[K]) => void;
  dense?: boolean;
  showActivation?: boolean;
  isNew?: boolean;
}) {
  const grid = dense ? 1.5 : 2;
  const user = getSessionUser();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  return (
    <Stack spacing={dense ? 1.5 : 2}>
      {/* ── Header: Resumo rapido ────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          p: dense ? 1.5 : 2,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(168,85,247,0.08) 100%)',
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconSparkles size={18} />
            <Typography variant="subtitle2" fontWeight={700}>
              {isNew ? 'Identificacao do Novo Perfil' : 'Resumo da estrategia ativa'}
            </Typography>
          </Stack>
          {!isNew && <OptimizationSettingsHighlights settings={value} compact={dense} />}
          <Grid container spacing={grid} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nome do perfil" size="small" fullWidth value={value.name ?? ''} onChange={(e) => onChange('name', e.target.value)} helperText="Identifique este perfil de configuracao (ex: 'Padrao DU', 'Pico Verao')" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Descricao" size="small" fullWidth value={value.description ?? ''} onChange={(e) => onChange('description', e.target.value)} helperText="Observacoes sobre quando/porque usar este perfil" />
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      {/* ── 1. Estrategia do solver ──────────────────────────────────────── */}
      <SectionPanel
        title="Estrategia do solver"
        subtitle="Pipeline principal, tempo de busca e politicas globais."
        icon={<IconSettings size={18} />}
        defaultExpanded
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} md={8}>
            <FormControl size="small" fullWidth>
              <InputLabel><FieldLabel text="Algoritmo principal" meta={FIELD_HELP.algorithmType} /></InputLabel>
              <Select
                label="Algoritmo principal"
                value={value.algorithmType}
                onChange={(e) => onChange('algorithmType', e.target.value)}
              >
                {ALGORITHM_OPTIONS.map((item) => (
                  <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl size="small" fullWidth>
              <InputLabel><FieldLabel text="Modo de operação" meta={FIELD_HELP.operationMode} /></InputLabel>
              <Select
                label="Modo de operação"
                value={value.operationMode ?? 'urban'}
                onChange={(e) => onChange('operationMode', e.target.value as 'urban' | 'charter')}
              >
                <MenuItem value="urban">Urbano (Padrao)</MenuItem>
                <MenuItem value="charter">Fretamento (Charter)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Budget total" fieldKey="timeBudgetSeconds" value={value.timeBudgetSeconds} onChange={(next) => onChange('timeBudgetSeconds', next)} min={30} max={3600} unit="s" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Multiplicador Timeout (Admin)" fieldKey="maxTimeoutMultiplier" value={value.maxTimeoutMultiplier ?? 1.5} onChange={(next) => onChange('maxTimeoutMultiplier', next)} min={1.0} max={5.0} step={0.1} dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="applyCct" checked={value.applyCct} onChange={(checked) => onChange('applyCct', checked)} label="Aplicar CCT/CLT" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="allowReliefPoints" checked={value.allowReliefPoints} onChange={(checked) => onChange('allowReliefPoints', checked)} label="Permitir relief points" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="useSetCovering" checked={!!value.useSetCovering} onChange={(checked) => onChange('useSetCovering', checked)} label="Usar set covering" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="pricingEnabled" checked={!!value.pricingEnabled} onChange={(checked) => onChange('pricingEnabled', checked)} label="Pricing problem ativo" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="preservePreferredPairs" checked={!!value.preservePreferredPairs} onChange={(checked) => onChange('preservePreferredPairs', checked)} label="Preservar ida/volta" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="enforceTripGroupsHard" checked={!!value.enforceTripGroupsHard} onChange={(checked) => onChange('enforceTripGroupsHard', checked)} label="Forçar pares ida/volta" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="operatorChangeTerminalsOnly" checked={!!value.operatorChangeTerminalsOnly} onChange={(checked) => onChange('operatorChangeTerminalsOnly', checked)} label="Troca veículo só em terminais" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="operatorSingleVehicleOnly" checked={!!value.operatorSingleVehicleOnly} onChange={(checked) => onChange('operatorSingleVehicleOnly', checked)} label="Operador veículo único" />
          </Grid>
          <Grid item xs={12} md={4}>
            <SwitchField fieldKey="strictHardValidation" checked={value.strictHardValidation ?? true} onChange={(checked) => onChange('strictHardValidation', checked)} label="Validação hard estrita" />
          </Grid>
          {showActivation ? (
            <Grid item xs={12} md={4}>
              <SwitchField fieldKey="isActive" checked={value.isActive} onChange={(checked) => onChange('isActive', checked)} label="Marcar como ativa" />
            </Grid>
          ) : null}
        </Grid>
      </SectionPanel>

      {/* ── 2. Tripulacao e jornada ──────────────────────────────────────── */}
      <SectionPanel
        title="Tripulacao e jornada"
        subtitle="Limites de jornada, breaks, refeicao, horas garantidas e remuneracao."
        icon={<IconUsers size={18} />}
        defaultExpanded
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Spread maximo" fieldKey="cctMaxShiftMinutes" value={value.cctMaxShiftMinutes} onChange={(next) => onChange('cctMaxShiftMinutes', next)} min={60} max={720} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Spread minimo" fieldKey="cctMinShiftMinutes" value={value.cctMinShiftMinutes ?? 0} onChange={(next) => onChange('cctMinShiftMinutes', next)} min={0} max={480} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Jornada regular / base HE" fieldKey="cctMaxWorkMinutes" value={value.cctMaxWorkMinutes} onChange={(next) => onChange('cctMaxWorkMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trabalho efetivo min." fieldKey="cctMinWorkMinutes" value={value.cctMinWorkMinutes ?? 0} onChange={(next) => onChange('cctMinWorkMinutes', next)} min={0} max={480} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite hora extra" fieldKey="cctOvertimeLimitMinutes" value={value.cctOvertimeLimitMinutes ?? 120} onChange={(next) => onChange('cctOvertimeLimitMinutes', next)} min={0} max={300} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Direcao continua max." fieldKey="cctMaxDrivingMinutes" value={value.cctMaxDrivingMinutes} onChange={(next) => onChange('cctMaxDrivingMinutes', next)} min={30} max={600} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Break minimo" fieldKey="cctMinBreakMinutes" value={value.cctMinBreakMinutes} onChange={(next) => onChange('cctMinBreakMinutes', next)} min={5} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Break obrigatorio apos" fieldKey="cctMandatoryBreakAfterMinutes" value={value.cctMandatoryBreakAfterMinutes ?? 270} onChange={(next) => onChange('cctMandatoryBreakAfterMinutes', next)} min={60} max={600} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Refeicao" fieldKey="cctMealBreakMinutes" value={value.cctMealBreakMinutes ?? 60} onChange={(next) => onChange('cctMealBreakMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Layover minimo" fieldKey="cctMinLayoverMinutes" value={value.cctMinLayoverMinutes} onChange={(next) => onChange('cctMinLayoverMinutes', next)} min={0} max={120} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Horas garantidas" fieldKey="cctMinGuaranteedWorkMinutes" value={value.cctMinGuaranteedWorkMinutes ?? 360} onChange={(next) => onChange('cctMinGuaranteedWorkMinutes', next)} min={0} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Espera remunerada" fieldKey="cctWaitingTimePayPct" value={value.cctWaitingTimePayPct ?? 30} onChange={(next) => onChange('cctWaitingTimePayPct', next)} min={0} max={100} unit="%" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Limite ociosidade total" fieldKey="maxUnpaidBreakMinutes" value={value.maxUnpaidBreakMinutes ?? 360} onChange={(next) => onChange('maxUnpaidBreakMinutes', next)} min={0} max={1440} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Gatilho pausa longa" fieldKey="longUnpaidBreakLimitMinutes" value={value.longUnpaidBreakLimitMinutes ?? 180} onChange={(next) => onChange('longUnpaidBreakLimitMinutes', next)} min={0} max={720} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Peso penalidade pausa" fieldKey="longUnpaidBreakPenaltyWeight" value={value.longUnpaidBreakPenaltyWeight ?? 1.0} onChange={(next) => onChange('longUnpaidBreakPenaltyWeight', next)} min={0} max={5} step={0.1} dense={dense} />
          </Grid>
          <Grid item xs={12} md={12}>
            <SwitchField fieldKey="cctIdleTimeIsPaid" checked={value.cctIdleTimeIsPaid ?? true} onChange={(checked) => onChange('cctIdleTimeIsPaid', checked)} label="Tempo ocioso entre viagens é remunerado (CLT Urbano)" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Tolerancia de conexao" fieldKey="connectionToleranceMinutes" value={value.connectionToleranceMinutes ?? 0} onChange={(next) => onChange('connectionToleranceMinutes', next)} min={0} max={30} unit="min" dense={dense} helperText="Perdoa gaps pequenos entre viagens (ex: 2-5 min)" /></Grid>
        </Grid>
      </SectionPanel>

      <SectionPanel title="Pesos e Equidade (Fairness)" icon={<IconUsers size={20} />} defaultExpanded={false}>
        <Grid container spacing={grid}>
          <Grid item xs={12} md={4}>
            <NumberField label="Peso Equidade total" fieldKey="fairnessWeight" value={value.fairnessWeight ?? 0} onChange={(next) => onChange('fairnessWeight', next)} min={0} max={100} unit="%" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Meta de trabalho" fieldKey="fairnessTargetWorkMinutes" value={value.fairnessTargetWorkMinutes ?? 420} onChange={(next) => onChange('fairnessTargetWorkMinutes', next)} min={0} max={720} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Tolerância meta" fieldKey="fairnessToleranceMinutes" value={value.fairnessToleranceMinutes ?? 30} onChange={(next) => onChange('fairnessToleranceMinutes', next)} min={0} max={120} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Peso: Hora Extra" fieldKey="goalWeightOvertime" value={value.goalWeightOvertime ?? 0.8} onChange={(next) => onChange('goalWeightOvertime', next)} min={0} max={5} step={0.1} dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Peso: Spread" fieldKey="goalWeightSpread" value={value.goalWeightSpread ?? 0.15} onChange={(next) => onChange('goalWeightSpread', next)} min={0} max={5} step={0.05} dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Peso: Garante Mín." fieldKey="goalWeightMinWork" value={value.goalWeightMinWork ?? 0.2} onChange={(next) => onChange('goalWeightMinWork', next)} min={0} max={5} step={0.1} dense={dense} />
          </Grid>
        </Grid>
      </SectionPanel>

      {/* ── 3. Descanso e Lei 13.103 ─────────────────────────────────────── */}
      <SectionPanel
        title="Descanso e Lei 13.103"
        subtitle="Fracionamento de intervalo, descanso inter-jornada, limites semanais/quinzenais e constraints operacionais."
        icon={<IconScale size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Fracionamento 1a parte" fieldKey="cctSplitBreakFirstMinutes" value={value.cctSplitBreakFirstMinutes ?? 15} onChange={(next) => onChange('cctSplitBreakFirstMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Fracionamento 2a parte" fieldKey="cctSplitBreakSecondMinutes" value={value.cctSplitBreakSecondMinutes ?? 30} onChange={(next) => onChange('cctSplitBreakSecondMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Descanso entre jornadas" fieldKey="cctInterShiftRestMinutes" value={value.cctInterShiftRestMinutes ?? 660} onChange={(next) => onChange('cctInterShiftRestMinutes', next)} min={0} max={1440} unit="min" dense={dense} helperText="CLT: 11h (660 min)" /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Descanso semanal" fieldKey="cctWeeklyRestMinutes" value={value.cctWeeklyRestMinutes ?? 1440} onChange={(next) => onChange('cctWeeklyRestMinutes', next)} min={0} max={4320} unit="min" dense={dense} helperText="CLT: 24h (1440 min)" /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite diario direcao" fieldKey="cctDailyDrivingLimitMinutes" value={value.cctDailyDrivingLimitMinutes ?? 540} onChange={(next) => onChange('cctDailyDrivingLimitMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite diario estendido" fieldKey="cctExtendedDailyDrivingLimitMinutes" value={value.cctExtendedDailyDrivingLimitMinutes ?? 600} onChange={(next) => onChange('cctExtendedDailyDrivingLimitMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Dias estendidos/semana" fieldKey="cctMaxExtendedDrivingDaysPerWeek" value={value.cctMaxExtendedDrivingDaysPerWeek ?? 2} onChange={(next) => onChange('cctMaxExtendedDrivingDaysPerWeek', next)} min={0} max={7} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite semanal direcao" fieldKey="cctWeeklyDrivingLimitMinutes" value={value.cctWeeklyDrivingLimitMinutes ?? 3360} onChange={(next) => onChange('cctWeeklyDrivingLimitMinutes', next)} min={60} max={10080} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite quinzenal direcao" fieldKey="cctFortnightDrivingLimitMinutes" value={value.cctFortnightDrivingLimitMinutes ?? 5400} onChange={(next) => onChange('cctFortnightDrivingLimitMinutes', next)} min={60} max={20160} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="enforceSameDepotStartEnd" checked={!!value.enforceSameDepotStartEnd} onChange={(checked) => onChange('enforceSameDepotStartEnd', checked)} label="Exigir mesmo deposito na jornada" /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="enforceSingleLineDuty" checked={!!value.enforceSingleLineDuty} onChange={(checked) => onChange('enforceSingleLineDuty', checked)} label="Manter tripulante em uma unica linha" /></Grid>
        </Grid>
      </SectionPanel>

      {/* ── 4. Veiculos e custos ──────────────────────────────────────────── */}
      <SectionPanel
        title="Veiculos e custos"
        subtitle="Turno do veiculo, custos operacionais, garagem e infraestrutura de carregamento."
        icon={<IconTruck size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Turno max. do veiculo" fieldKey="maxVehicleShiftMinutes" value={value.maxVehicleShiftMinutes} onChange={(next) => onChange('maxVehicleShiftMinutes', next)} min={120} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Custo fixo / veiculo" fieldKey="fixedVehicleActivationCost" value={value.fixedVehicleActivationCost ?? 800} onChange={(next) => onChange('fixedVehicleActivationCost', next)} min={0} max={50000} step={50} unit="R$" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Custo deadhead / min" fieldKey="deadheadCostPerMinute" value={value.deadheadCostPerMinute ?? 0.85} onChange={(next) => onChange('deadheadCostPerMinute', next)} min={0} max={100} step={0.05} unit="R$/min" dense={dense} /></Grid>
          <Grid item xs={12} md={12}>
            <NumberField label="Custo ociosidade" fieldKey="idleCostPerMinute" value={value.idleCostPerMinute ?? 0.5} onChange={(next) => onChange('idleCostPerMinute', next)} min={0} max={100} step={0.05} unit="$/min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Reuso de veículo (Ratio)" fieldKey="maxConnectionCostForReuseRatio" value={value.maxConnectionCostForReuseRatio ?? 2.5} onChange={(next) => onChange('maxConnectionCostForReuseRatio', next)} min={0} max={10} step={0.1} dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Layover T.Central" fieldKey="terminalCentralMinLayover" value={value.terminalCentralMinLayover ?? 12} onChange={(next) => onChange('terminalCentralMinLayover', next)} min={1} max={60} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Gap mín. Recolhimento" fieldKey="splitShiftMinGapMinutes" value={value.splitShiftMinGapMinutes ?? 120} onChange={(next) => onChange('splitShiftMinGapMinutes', next)} min={0} max={300} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Gap máx. Recolhimento" fieldKey="splitShiftMaxGapMinutes" value={value.splitShiftMaxGapMinutes ?? 600} onChange={(next) => onChange('splitShiftMaxGapMinutes', next)} min={0} max={1440} unit="min" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SelectField 
              label="Política de Recolhimento" 
              fieldKey="vspGarageReturnPolicy" 
              value={value.vspGarageReturnPolicy ?? 'smart'} 
              onChange={(next) => onChange('vspGarageReturnPolicy', next as any)}
              options={[
                { value: 'smart', label: 'Inteligente (Menor Custo)' },
                { value: 'always', label: 'Sempre Recolher' },
                { value: 'never', label: 'Nunca Recolher (Ficar na Rua)' },
              ]}
              dense={dense}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Pullout" fieldKey="pulloutMinutes" value={value.pulloutMinutes} onChange={(next) => onChange('pulloutMinutes', next)} min={0} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Pullback" fieldKey="pullbackMinutes" value={value.pullbackMinutes} onChange={(next) => onChange('pullbackMinutes', next)} min={0} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Carregadores simultaneos" fieldKey="maxSimultaneousChargers" value={value.maxSimultaneousChargers ?? 0} onChange={(next) => onChange('maxSimultaneousChargers', next)} min={0} max={200} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Energia pico" fieldKey="peakEnergyCostPerKwh" value={value.peakEnergyCostPerKwh ?? 0} onChange={(next) => onChange('peakEnergyCostPerKwh', next)} min={0} max={50} step={0.1} unit="R$/kWh" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Energia fora pico" fieldKey="offpeakEnergyCostPerKwh" value={value.offpeakEnergyCostPerKwh ?? 0} onChange={(next) => onChange('offpeakEnergyCostPerKwh', next)} min={0} max={50} step={0.1} unit="R$/kWh" dense={dense} /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="sameDepotRequired" checked={!!value.sameDepotRequired} onChange={(checked) => onChange('sameDepotRequired', checked)} label="Mesmo deposito para bloco" /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="allowVehicleSplitShifts" checked={value.allowVehicleSplitShifts ?? true} onChange={(checked) => onChange('allowVehicleSplitShifts', checked)} label="Permitir turno partido" /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="allowMultiLineBlock" checked={value.allowMultiLineBlock ?? true} onChange={(checked) => onChange('allowMultiLineBlock', checked)} label="Permitir blocos multlinha" /></Grid>
        </Grid>
        <Alert severity="info" icon={<IconBatteryCharging size={16} />} sx={{ mt: 1.5, borderRadius: 2 }}>
          Custos de energia e carregadores influenciam a heuristica VSP para veiculos eletricos.
        </Alert>
      </SectionPanel>

      {/* ── 5. Periodo noturno ───────────────────────────────────────────── */}
      <SectionPanel
        title="Periodo noturno"
        subtitle="Horario noturno e adicional CLT art. 73."
        icon={<IconMoon size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Inicio noturno" fieldKey="cctNocturnalStartHour" value={value.cctNocturnalStartHour ?? 22} onChange={(next) => onChange('cctNocturnalStartHour', next)} min={0} max={23} unit="h" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Fim noturno" fieldKey="cctNocturnalEndHour" value={value.cctNocturnalEndHour ?? 5} onChange={(next) => onChange('cctNocturnalEndHour', next)} min={0} max={23} unit="h" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Adicional noturno" fieldKey="cctNocturnalExtraPct" value={value.cctNocturnalExtraPct ?? 20} onChange={(next) => onChange('cctNocturnalExtraPct', next)} min={0} max={100} unit="%" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Fator hora noturna" fieldKey="cctNocturnalFactor" value={value.cctNocturnalFactor ?? 0.875} onChange={(next) => onChange('cctNocturnalFactor', next)} min={0.5} max={1} step={0.001} dense={dense} helperText="CLT: 0.875 (52min30s)" /></Grid>
        </Grid>
      </SectionPanel>

      {/* ── 6. Workpieces e set covering ──────────────────────────────────── */}
      <SectionPanel
        title="Workpieces e set covering"
        subtitle="Faixas de geracao de colunas e granularidade das pecas para o CSP."
        icon={<IconRoute size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Peca minima" fieldKey="minWorkpieceMinutes" value={value.minWorkpieceMinutes ?? 0} onChange={(next) => onChange('minWorkpieceMinutes', next)} min={0} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Peca maxima" fieldKey="maxWorkpieceMinutes" value={value.maxWorkpieceMinutes ?? 480} onChange={(next) => onChange('maxWorkpieceMinutes', next)} min={30} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trips min./peca" fieldKey="minTripsPerPiece" value={value.minTripsPerPiece ?? 1} onChange={(next) => onChange('minTripsPerPiece', next)} min={1} max={20} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trips max./peca" fieldKey="maxTripsPerPiece" value={value.maxTripsPerPiece ?? 6} onChange={(next) => onChange('maxTripsPerPiece', next)} min={1} max={50} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Sucessores por tarefa" fieldKey="maxCandidateSuccessorsPerTask" value={value.maxCandidateSuccessorsPerTask ?? 5} onChange={(next) => onChange('maxCandidateSuccessorsPerTask', next)} min={1} max={50} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Max. colunas" fieldKey="maxGeneratedColumns" value={value.maxGeneratedColumns ?? 2500} onChange={(next) => onChange('maxGeneratedColumns', next)} min={8} max={20000} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Iteracoes pricing" fieldKey="maxPricingIterations" value={value.maxPricingIterations ?? 1} onChange={(next) => onChange('maxPricingIterations', next)} min={0} max={20} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Adicoes por pricing" fieldKey="maxPricingAdditions" value={value.maxPricingAdditions ?? 192} onChange={(next) => onChange('maxPricingAdditions', next)} min={1} max={5000} dense={dense} /></Grid>
        </Grid>
      </SectionPanel>

      {/* ── 7. Objetivos e fairness ──────────────────────────────────────── */}
      <SectionPanel
        title="Objetivos e fairness"
        subtitle="Pesos para equilibrio da escala e adicionais operacionais."
        icon={<IconMap2 size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Peso de fairness" fieldKey="fairnessWeight" value={value.fairnessWeight ?? 0.15} onChange={(next) => onChange('fairnessWeight', next)} min={0} max={10} step={0.05} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Adicional feriado" fieldKey="holidayExtraPct" value={value.holidayExtraPct ?? 100} onChange={(next) => onChange('holidayExtraPct', next)} min={0} max={500} unit="%" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Peso folga domingo" fieldKey="sundayOffWeight" value={value.sundayOffWeight ?? 0} onChange={(next) => onChange('sundayOffWeight', next)} min={0} max={10} step={0.05} dense={dense} /></Grid>
        </Grid>
      </SectionPanel>
    </Stack>
  );
}
