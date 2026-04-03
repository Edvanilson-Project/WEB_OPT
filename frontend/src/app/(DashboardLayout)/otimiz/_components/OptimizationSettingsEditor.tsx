import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  IconBatteryCharging,
  IconChevronDown,
  IconClock,
  IconDna,
  IconInfoCircle,
  IconMap2,
  IconMath,
  IconRoute,
  IconScale,
  IconSettings,
  IconSparkles,
  IconTemperature,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import type { OptimizationSettings } from '../_types';

export type SettingsFormValues = Omit<OptimizationSettings, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

type PercentLikeField = 'cctWaitingTimePayPct' | 'holidayExtraPct';
type FieldEffect = 'ativo' | 'parcial' | 'sem_efeito';
type HelpFieldKey = keyof SettingsFormValues;

type HelpMeta = {
  title: string;
  short: string;
  example?: string;
  effect?: FieldEffect;
};

const PERCENT_UI_FIELDS: PercentLikeField[] = ['cctWaitingTimePayPct', 'holidayExtraPct'];
const NON_NUMERIC_FORM_FIELDS = new Set<keyof SettingsFormValues>([
  'name',
  'description',
  'algorithmType',
  'isActive',
  'applyCct',
  'allowReliefPoints',
  'cctAllowReducedWeeklyRest',
  'enforceSameDepotStartEnd',
  'enforceSingleLineDuty',
  'sameDepotRequired',
  'pricingEnabled',
  'useSetCovering',
  'preservePreferredPairs',
]);

const EFFECT_LABEL: Record<FieldEffect, string> = {
  ativo: 'Tem efeito real no solver',
  parcial: 'Tem efeito parcial na versão atual',
  sem_efeito: 'Ainda sem efeito real na execução atual',
};

const FIELD_HELP: Partial<Record<HelpFieldKey, HelpMeta>> = {
  algorithmType: {
    title: 'Algoritmo principal do perfil',
    short: 'Guarda a estratégia preferida deste perfil. Na tela de execução, o algoritmo ainda pode ser trocado manualmente.',
    example: 'Exemplo: deixar Híbrido como padrão, mas rodar Greedy em um teste rápido.',
    effect: 'parcial',
  },
  timeBudgetSeconds: {
    title: 'Budget total',
    short: 'É o tempo máximo que o solver pode gastar tentando melhorar a solução.',
    example: 'Mais tempo tende a melhorar a qualidade, mas demora mais para terminar.',
    effect: 'ativo',
  },
  ilpTimeoutSeconds: {
    title: 'Timeout ILP',
    short: 'Reserva de configuração para o resolvedor exato. Hoje não altera a execução principal pela API.',
    example: 'Pode ser mantido no padrão sem impacto prático agora.',
    effect: 'sem_efeito',
  },
  applyCct: {
    title: 'Aplicar CCT/CLT',
    short: 'Foi pensado para ligar ou desligar regras trabalhistas, mas hoje ainda não muda o cálculo final do solver.',
    example: 'Pode ficar ligado por consistência operacional.',
    effect: 'sem_efeito',
  },
  allowReliefPoints: {
    title: 'Permitir relief points',
    short: 'Permite troca de tripulação em pontos operacionais sem exigir sempre o mesmo terminal.',
    example: 'Ligado: o sistema aceita mais combinações. Desligado: fica mais conservador.',
    effect: 'ativo',
  },
  useSetCovering: {
    title: 'Usar set covering',
    short: 'Liga a etapa que monta jornadas a partir de peças candidatas para buscar soluções mais organizadas.',
    example: 'Bom para cenários médios e grandes, com custo um pouco maior de processamento.',
    effect: 'ativo',
  },
  pricingEnabled: {
    title: 'Pricing problem',
    short: 'Cria novas peças promissoras durante a busca, em vez de usar só as iniciais.',
    example: 'Ligado: tende a achar soluções melhores. Desligado: costuma ser mais rápido.',
    effect: 'ativo',
  },
  preservePreferredPairs: {
    title: 'Preservar ida/volta',
    short: 'Tenta manter pares ida/volta no mesmo recurso sempre que a operação permitir.',
    example: 'Ajuda a evitar que a ida fique com um motorista e a volta com outro sem necessidade.',
    effect: 'ativo',
  },
  cctMaxShiftMinutes: {
    title: 'Spread máximo',
    short: 'É o tempo total entre o começo e o fim da jornada.',
    example: 'Se a jornada começa 06:00 e termina 14:00, o spread é 480 min.',
    effect: 'ativo',
  },
  cctMaxWorkMinutes: {
    title: 'Trabalho efetivo máximo',
    short: 'Conta só o tempo realmente dirigido ou operado, sem considerar toda a janela da jornada.',
    example: 'Um spread de 8h pode ter só 7h20 de trabalho efetivo.',
    effect: 'ativo',
  },
  cctMaxDrivingMinutes: {
    title: 'Direção contínua máxima',
    short: 'Limita quanto tempo seguido alguém pode dirigir antes de precisar de pausa.',
    example: 'Se passar desse valor, o solver corta a jornada ou rejeita a combinação.',
    effect: 'ativo',
  },
  cctMinBreakMinutes: {
    title: 'Break mínimo',
    short: 'É a pausa mínima para o solver considerar que houve descanso válido.',
    example: 'Uma folga menor que isso pode não zerar a direção contínua.',
    effect: 'ativo',
  },
  cctMandatoryBreakAfterMinutes: {
    title: 'Break obrigatório após',
    short: 'Depois desse tempo acumulado de direção, o solver passa a exigir pausa.',
    example: 'Ajuda a evitar jornadas longas sem descanso.',
    effect: 'ativo',
  },
  cctMealBreakMinutes: {
    title: 'Intervalo de refeição',
    short: 'Usado para forçar uma pausa maior quando a jornada fica extensa.',
    example: 'Se a jornada estica, o sistema tenta encaixar esse intervalo.',
    effect: 'ativo',
  },
  cctMinLayoverMinutes: {
    title: 'Layover mínimo',
    short: 'É a folga mínima entre viagens de um mesmo recurso no terminal.',
    example: 'Serve para evitar emenda impossível de uma viagem na outra.',
    effect: 'ativo',
  },
  cctMaxDutiesPerDay: {
    title: 'Turnos por dia',
    short: 'Hoje esse campo ainda não altera a montagem final das jornadas.',
    example: 'Pode permanecer no padrão por enquanto.',
    effect: 'sem_efeito',
  },
  cctMinGuaranteedWorkMinutes: {
    title: 'Horas garantidas',
    short: 'Define o mínimo pago da jornada mesmo se o trabalho efetivo ficar menor.',
    example: 'Se garantir 360 min, uma jornada com 300 min ainda será paga como 360.',
    effect: 'ativo',
  },
  cctWaitingTimePayPct: {
    title: 'Espera remunerada',
    short: 'Indica quanto do tempo de espera entra no custo da tripulação.',
    example: '30% significa pagar uma parte da espera; 100% pesa muito mais no custo.',
    effect: 'ativo',
  },
  cctAllowReducedWeeklyRest: {
    title: 'Descanso semanal reduzido',
    short: 'Está salvo no perfil, mas a regra ainda não interfere de forma completa na execução atual.',
    example: 'Pode ser mantido desligado até a regra ficar 100% operacional.',
    effect: 'sem_efeito',
  },
  enforceSameDepotStartEnd: {
    title: 'Mesmo depósito na jornada',
    short: 'Impede jornada que comece em um depósito e termine em outro quando essa coerência é obrigatória.',
    example: 'Útil quando o motorista precisa devolver o veículo no mesmo pátio.',
    effect: 'ativo',
  },
  enforceSingleLineDuty: {
    title: 'Uma linha por tripulante',
    short: 'Evita misturar linhas diferentes dentro da mesma jornada quando a operação exige continuidade.',
    example: 'Ajuda a impedir um motorista de sair da 815 e terminar o plantão em outra linha.',
    effect: 'ativo',
  },
  maxVehicleShiftMinutes: {
    title: 'Turno máximo do veículo',
    short: 'Limita por quanto tempo um veículo pode ficar escalado no dia.',
    example: 'Serve para evitar blocos de ônibus longos demais.',
    effect: 'ativo',
  },
  pulloutMinutes: {
    title: 'Pullout',
    short: 'Tempo considerado para o veículo sair da garagem até a primeira viagem.',
    example: 'Aumentar esse valor deixa o planejamento mais conservador.',
    effect: 'ativo',
  },
  pullbackMinutes: {
    title: 'Pullback',
    short: 'Tempo considerado para o veículo voltar à garagem após a última viagem.',
    example: 'Ajuda a não superlotar o fim do turno do veículo.',
    effect: 'ativo',
  },
  sameDepotRequired: {
    title: 'Mesmo depósito para bloco',
    short: 'Exige que o bloco do veículo preserve o depósito de origem e retorno.',
    example: 'Útil quando ônibus não podem terminar fora do seu pátio.',
    effect: 'ativo',
  },
  maxSimultaneousChargers: {
    title: 'Carregadores simultâneos',
    short: 'Limita quantos veículos elétricos podem carregar ao mesmo tempo.',
    example: 'Se há só 4 vagas de recarga, usar 4 aqui evita planejamento inviável.',
    effect: 'ativo',
  },
  minWorkpieceMinutes: {
    title: 'Peça mínima',
    short: 'Controla o menor tamanho de peça candidata usada para formar jornadas.',
    example: 'Muito baixo gera muitas combinações; muito alto pode perder boas soluções.',
    effect: 'ativo',
  },
  maxWorkpieceMinutes: {
    title: 'Peça máxima',
    short: 'Controla o maior tamanho de peça candidata antes de montar a jornada final.',
    example: 'Peças muito grandes reduzem flexibilidade.',
    effect: 'ativo',
  },
  minTripsPerPiece: {
    title: 'Trips mínimas por peça',
    short: 'Impede peças pequenas demais na geração de colunas.',
    example: 'Subir esse valor reduz combinações curtas e fragmentadas.',
    effect: 'ativo',
  },
  maxTripsPerPiece: {
    title: 'Trips máximas por peça',
    short: 'Impede peças grandes demais logo no início da geração.',
    example: 'Bom para segurar tempo de processamento em cenários pesados.',
    effect: 'ativo',
  },
  maxCandidateSuccessorsPerTask: {
    title: 'Sucessores por tarefa',
    short: 'Limita quantas continuações o solver testa para cada tarefa.',
    example: 'Mais alto = mais qualidade potencial e mais processamento.',
    effect: 'ativo',
  },
  maxGeneratedColumns: {
    title: 'Máximo de colunas',
    short: 'É o teto de peças que o solver pode gerar.',
    example: 'Muito baixo acelera, mas pode perder qualidade.',
    effect: 'ativo',
  },
  maxPricingIterations: {
    title: 'Iterações de pricing',
    short: 'Quantas rodadas extras de geração inteligente de peças o solver pode fazer.',
    example: '0 = mais rápido; 1 ou 2 = melhor equilíbrio na maioria dos casos.',
    effect: 'ativo',
  },
  maxPricingAdditions: {
    title: 'Adições por pricing',
    short: 'Limita quantas novas peças entram em cada rodada de pricing.',
    example: 'Mais alto pode melhorar a solução, mas aumenta custo de processamento.',
    effect: 'ativo',
  },
  fairnessWeight: {
    title: 'Peso de fairness',
    short: 'Está salvo no perfil, mas ainda não muda de forma direta a execução atual.',
    example: 'Pode ficar no padrão até a penalização entrar 100% no solver.',
    effect: 'sem_efeito',
  },
  sundayOffWeight: {
    title: 'Peso de domingo livre',
    short: 'Hoje ainda não altera diretamente a solução calculada pela API.',
    example: 'Mantenha no padrão por enquanto.',
    effect: 'sem_efeito',
  },
  holidayExtraPct: {
    title: 'Adicional de feriado',
    short: 'Aumenta o custo da tripulação em jornadas com feriado quando essa informação existir.',
    example: '100% significa pagar o adicional cheio sobre esse contexto.',
    effect: 'ativo',
  },
  gaPopulationSize: {
    title: 'População do GA',
    short: 'Parâmetro reservado. Hoje não altera o solver chamado pela API de execução.',
    example: 'Pode ficar no padrão até a integração completa do GA por perfil.',
    effect: 'sem_efeito',
  },
  gaGenerations: {
    title: 'Gerações do GA',
    short: 'Parâmetro reservado para evolução genética. Ainda sem efeito real na execução atual.',
    effect: 'sem_efeito',
  },
  gaMutationRate: {
    title: 'Mutação do GA',
    short: 'Define quanto o GA mudaria soluções candidatas. Ainda sem efeito real pela API atual.',
    effect: 'sem_efeito',
  },
  gaCrossoverRate: {
    title: 'Crossover do GA',
    short: 'Controla mistura de soluções no GA. Ainda sem efeito real pela API atual.',
    effect: 'sem_efeito',
  },
  saInitialTemperature: {
    title: 'Temperatura inicial do SA',
    short: 'Parâmetro reservado do Simulated Annealing. Hoje não altera a execução principal.',
    effect: 'sem_efeito',
  },
  saCoolingRate: {
    title: 'Cooling rate do SA',
    short: 'Controla a queda de temperatura no SA. Ainda sem efeito real pela API atual.',
    effect: 'sem_efeito',
  },
  saMinTemperature: {
    title: 'Temperatura mínima do SA',
    short: 'Parâmetro reservado do SA. Ainda sem efeito real na execução atual.',
    effect: 'sem_efeito',
  },
  tsTabuSize: {
    title: 'Lista tabu',
    short: 'Parâmetro reservado do Tabu Search. Hoje não altera a execução principal da API.',
    effect: 'sem_efeito',
  },
  tsMaxIterations: {
    title: 'Máximo de iterações do Tabu',
    short: 'Parâmetro reservado do Tabu Search. Ainda sem efeito real na execução atual.',
    effect: 'sem_efeito',
  },
};

export const OPTIMIZATION_SETTINGS_DRAWER_EVENT = 'optimization:open-settings';
export const OPTIMIZATION_SETTINGS_UPDATED_EVENT = 'optimization:settings-updated';

export function openOptimizationSettingsDrawer() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMIZATION_SETTINGS_DRAWER_EVENT));
  }
}

export function notifyOptimizationSettingsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMIZATION_SETTINGS_UPDATED_EVENT));
  }
}

export const ALGORITHM_OPTIONS = [
  { value: 'full_pipeline', label: 'Pipeline Completo (VSP → CSP)' },
  { value: 'hybrid_pipeline', label: 'Pipeline Híbrido (Greedy → SA → Tabu → GA → ILP)' },
  { value: 'greedy', label: 'Greedy (Guloso Rápido)' },
  { value: 'vsp_only', label: 'Apenas VSP' },
  { value: 'csp_only', label: 'Apenas CSP' },
  { value: 'genetic', label: 'Algoritmo Genético (GA)' },
  { value: 'simulated_annealing', label: 'Simulated Annealing (SA)' },
  { value: 'tabu_search', label: 'Tabu Search (TS)' },
  { value: 'set_partitioning', label: 'Set Covering / Partitioning' },
  { value: 'joint_solver', label: 'Solucionador Conjunto (VSP + CSP)' },
];

export const DEFAULT_SETTINGS_FORM: SettingsFormValues = {
  name: '',
  description: '',
  algorithmType: 'full_pipeline',
  gaPopulationSize: 50,
  gaGenerations: 100,
  gaMutationRate: 0.1,
  gaCrossoverRate: 0.8,
  saInitialTemperature: 1000,
  saCoolingRate: 0.95,
  saMinTemperature: 0.01,
  tsTabuSize: 10,
  tsMaxIterations: 500,
  ilpTimeoutSeconds: 60,
  timeBudgetSeconds: 300,
  cctMaxShiftMinutes: 480,
  cctMaxDrivingMinutes: 240,
  cctMinBreakMinutes: 30,
  cctMaxDutiesPerDay: 1,
  allowReliefPoints: false,
  cctMaxWorkMinutes: 440,
  cctMinLayoverMinutes: 8,
  applyCct: true,
  pulloutMinutes: 10,
  pullbackMinutes: 10,
  maxVehicleShiftMinutes: 960,
  cctMandatoryBreakAfterMinutes: 270,
  cctSplitBreakFirstMinutes: 15,
  cctSplitBreakSecondMinutes: 15,
  cctMealBreakMinutes: 60,
  cctReducedWeeklyRestMinutes: 2160,
  cctAllowReducedWeeklyRest: false,
  cctDailyDrivingLimitMinutes: 480,
  cctExtendedDailyDrivingLimitMinutes: 600,
  cctMaxExtendedDrivingDaysPerWeek: 2,
  cctWeeklyDrivingLimitMinutes: 3360,
  cctFortnightDrivingLimitMinutes: 5400,
  cctWaitingTimePayPct: 30,
  cctMinGuaranteedWorkMinutes: 360,
  enforceSameDepotStartEnd: false,
  enforceSingleLineDuty: false,
  fairnessWeight: 0.15,
  sundayOffWeight: 0.2,
  holidayExtraPct: 100,
  sameDepotRequired: false,
  maxSimultaneousChargers: 4,
  peakEnergyCostPerKwh: 1.2,
  offpeakEnergyCostPerKwh: 0.8,
  minWorkpieceMinutes: 120,
  maxWorkpieceMinutes: 540,
  minTripsPerPiece: 2,
  maxTripsPerPiece: 10,
  pricingEnabled: true,
  useSetCovering: true,
  preservePreferredPairs: true,
  maxCandidateSuccessorsPerTask: 5,
  maxGeneratedColumns: 2500,
  maxPricingIterations: 1,
  maxPricingAdditions: 192,
  isActive: true,
};

function toUiPercent(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value <= 5 ? value * 100 : value;
}

function toApiPercent(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value > 5 ? value / 100 : value;
}

function coerceNumericLike<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = { ...settings };
  for (const key of Object.keys(normalized) as Array<keyof T>) {
    if (NON_NUMERIC_FORM_FIELDS.has(key as keyof SettingsFormValues)) continue;
    const value = normalized[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
        normalized[key] = Number(trimmed) as T[keyof T];
      }
    }
  }
  return normalized;
}

export function normalizeSettingsFromApi<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = coerceNumericLike(settings);
  for (const field of PERCENT_UI_FIELDS) {
    const value = normalized[field];
    if (typeof value === 'number') {
      normalized[field] = toUiPercent(value) as T[typeof field];
    }
  }
  return normalized;
}

export function normalizeSettingsForApi<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = coerceNumericLike(settings);
  for (const field of PERCENT_UI_FIELDS) {
    const value = normalized[field];
    if (typeof value === 'number') {
      normalized[field] = toApiPercent(value) as T[typeof field];
    }
  }
  return normalized;
}

function NumberField({
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
      value={Number.isFinite(value) ? value : 0}
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

function FieldLabel({ text, meta }: { text: string; meta?: HelpMeta }) {
  if (!meta) return <>{text}</>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box component="span">{text}</Box>
      <Tooltip
        arrow
        placement="top"
        title={
          <Stack spacing={0.5} sx={{ maxWidth: 280 }}>
            <Typography variant="subtitle2" fontWeight={700}>{meta.title}</Typography>
            <Typography variant="body2">{meta.short}</Typography>
            {meta.example ? <Typography variant="caption">{meta.example}</Typography> : null}
            {meta.effect ? <Typography variant="caption" fontWeight={700}>{EFFECT_LABEL[meta.effect]}</Typography> : null}
          </Stack>
        }
      >
        <Box component="span" sx={{ display: 'inline-flex', color: meta.effect === 'sem_efeito' ? 'warning.main' : meta.effect === 'parcial' ? 'info.main' : 'primary.main' }}>
          <IconInfoCircle size={14} />
        </Box>
      </Tooltip>
    </Box>
  );
}

function SwitchField({
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

function SectionPanel({
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

export function OptimizationSettingsHighlights({
  settings,
  compact = false,
}: {
  settings: Partial<OptimizationSettings> | SettingsFormValues;
  compact?: boolean;
}) {
  const chips = [
    { label: ALGORITHM_OPTIONS.find((item) => item.value === settings.algorithmType)?.label ?? 'Algoritmo', color: 'primary' as const },
    { label: (settings.applyCct ?? true) ? 'CCT ativo' : 'CCT flexível', color: (settings.applyCct ?? true) ? 'success' as const : 'warning' as const },
    { label: settings.useSetCovering ? 'Set covering' : 'Sem set covering', color: settings.useSetCovering ? 'info' as const : 'default' as const },
    { label: settings.pricingEnabled ? 'Pricing ligado' : 'Pricing desligado', color: settings.pricingEnabled ? 'secondary' as const : 'default' as const },
    { label: settings.preservePreferredPairs ? 'Ida/volta preservada' : 'Pairing flexível', color: settings.preservePreferredPairs ? 'success' as const : 'default' as const },
    { label: settings.sameDepotRequired ? 'Mesmo depósito obrigatório' : 'Depósito flexível', color: settings.sameDepotRequired ? 'warning' as const : 'default' as const },
    { label: `${settings.maxSimultaneousChargers ?? 0} carregadores`, color: 'default' as const },
    { label: `Jornada ${settings.cctMaxShiftMinutes ?? 480} min`, color: 'default' as const },
    { label: `Peça ${settings.minWorkpieceMinutes ?? 0}-${settings.maxWorkpieceMinutes ?? 0} min`, color: 'default' as const },
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
}: {
  value: SettingsFormValues;
  onChange: <K extends keyof SettingsFormValues>(key: K, nextValue: SettingsFormValues[K]) => void;
  dense?: boolean;
  showActivation?: boolean;
}) {
  const grid = dense ? 1.5 : 2;

  return (
    <Stack spacing={dense ? 1.5 : 2}>
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
            <Typography variant="subtitle2" fontWeight={700}>Resumo da estratégia ativa</Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip size="small" color="success" variant="outlined" label="Impacto real no solver" />
            <Chip size="small" color="info" variant="outlined" label="Impacto parcial" />
            <Chip size="small" color="warning" variant="outlined" label="Sem efeito real hoje" />
          </Stack>
          <OptimizationSettingsHighlights settings={value} compact={dense} />
        </Stack>
      </Paper>

      <SectionPanel
        title="Estratégia do solver"
        subtitle="Define o pipeline principal, tempo de busca e políticas globais de otimização."
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
            <NumberField label="Budget total" fieldKey="timeBudgetSeconds" value={value.timeBudgetSeconds} onChange={(next) => onChange('timeBudgetSeconds', next)} min={30} max={3600} unit="s" dense={dense} />
          </Grid>
          <Grid item xs={12} md={4}>
            <NumberField label="Timeout ILP" fieldKey="ilpTimeoutSeconds" value={value.ilpTimeoutSeconds} onChange={(next) => onChange('ilpTimeoutSeconds', next)} min={10} max={600} unit="s" dense={dense} />
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
            <SwitchField fieldKey="preservePreferredPairs" checked={!!value.preservePreferredPairs} onChange={(checked) => onChange('preservePreferredPairs', checked)} label="Preservar ida/volta no mesmo recurso" />
          </Grid>
          {showActivation ? (
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Switch checked={value.isActive} onChange={(e) => onChange('isActive', e.target.checked)} />} label="Marcar como ativa" />
            </Grid>
          ) : null}
        </Grid>
        <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
          Solver completo = modo avançado. Fallback inline = modo simplificado. Para multi-linha, híbrido e pairing, o sistema agora deve exigir o solver completo.
        </Alert>
      </SectionPanel>

      <SectionPanel
        title="Tripulação e jornada"
        subtitle="Parâmetros centrais da jornada, breaks, layover, horas garantidas e remuneração da espera."
        icon={<IconUsers size={18} />}
        defaultExpanded
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Spread máximo" fieldKey="cctMaxShiftMinutes" value={value.cctMaxShiftMinutes} onChange={(next) => onChange('cctMaxShiftMinutes', next)} min={60} max={720} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trabalho efetivo máx." fieldKey="cctMaxWorkMinutes" value={value.cctMaxWorkMinutes} onChange={(next) => onChange('cctMaxWorkMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Direção contínua máx." fieldKey="cctMaxDrivingMinutes" value={value.cctMaxDrivingMinutes} onChange={(next) => onChange('cctMaxDrivingMinutes', next)} min={30} max={240} unit="min" dense={dense} helperText="Limite legal duro usado pelo solver" /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Break mínimo" fieldKey="cctMinBreakMinutes" value={value.cctMinBreakMinutes} onChange={(next) => onChange('cctMinBreakMinutes', next)} min={10} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Break obrigatório após" fieldKey="cctMandatoryBreakAfterMinutes" value={value.cctMandatoryBreakAfterMinutes ?? 270} onChange={(next) => onChange('cctMandatoryBreakAfterMinutes', next)} min={60} max={600} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Refeição" fieldKey="cctMealBreakMinutes" value={value.cctMealBreakMinutes ?? 30} onChange={(next) => onChange('cctMealBreakMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Layover mínimo" fieldKey="cctMinLayoverMinutes" value={value.cctMinLayoverMinutes} onChange={(next) => onChange('cctMinLayoverMinutes', next)} min={0} max={120} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Turnos por dia" fieldKey="cctMaxDutiesPerDay" value={value.cctMaxDutiesPerDay} onChange={(next) => onChange('cctMaxDutiesPerDay', next)} min={1} max={3} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Horas garantidas" fieldKey="cctMinGuaranteedWorkMinutes" value={value.cctMinGuaranteedWorkMinutes ?? 360} onChange={(next) => onChange('cctMinGuaranteedWorkMinutes', next)} min={0} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Espera remunerada" fieldKey="cctWaitingTimePayPct" value={value.cctWaitingTimePayPct ?? 30} onChange={(next) => onChange('cctWaitingTimePayPct', next)} min={0} max={100} unit="%" helperText="A UI mostra percentual; a API recebe fração" dense={dense} /></Grid>
        </Grid>
      </SectionPanel>

      <SectionPanel
        title="UE / Lei 13.103"
        subtitle="Descanso fracionado, limites diário/semanal/quinzenal e retorno ao depósito."
        icon={<IconScale size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Split break 1" fieldKey="cctSplitBreakFirstMinutes" value={value.cctSplitBreakFirstMinutes ?? 15} onChange={(next) => onChange('cctSplitBreakFirstMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Split break 2" fieldKey="cctSplitBreakSecondMinutes" value={value.cctSplitBreakSecondMinutes ?? 15} onChange={(next) => onChange('cctSplitBreakSecondMinutes', next)} min={0} max={180} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite diário" fieldKey="cctDailyDrivingLimitMinutes" value={value.cctDailyDrivingLimitMinutes ?? 480} onChange={(next) => onChange('cctDailyDrivingLimitMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite diário estendido" fieldKey="cctExtendedDailyDrivingLimitMinutes" value={value.cctExtendedDailyDrivingLimitMinutes ?? 600} onChange={(next) => onChange('cctExtendedDailyDrivingLimitMinutes', next)} min={60} max={900} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Dias estendidos/semana" fieldKey="cctMaxExtendedDrivingDaysPerWeek" value={value.cctMaxExtendedDrivingDaysPerWeek ?? 2} onChange={(next) => onChange('cctMaxExtendedDrivingDaysPerWeek', next)} min={0} max={7} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite semanal" fieldKey="cctWeeklyDrivingLimitMinutes" value={value.cctWeeklyDrivingLimitMinutes ?? 3360} onChange={(next) => onChange('cctWeeklyDrivingLimitMinutes', next)} min={60} max={10080} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Limite quinzenal" fieldKey="cctFortnightDrivingLimitMinutes" value={value.cctFortnightDrivingLimitMinutes ?? 5400} onChange={(next) => onChange('cctFortnightDrivingLimitMinutes', next)} min={60} max={20160} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Descanso semanal reduzido" value={value.cctReducedWeeklyRestMinutes ?? 2160} onChange={(next) => onChange('cctReducedWeeklyRestMinutes', next)} min={0} max={10080} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="cctAllowReducedWeeklyRest" checked={!!value.cctAllowReducedWeeklyRest} onChange={(checked) => onChange('cctAllowReducedWeeklyRest', checked)} label="Permitir descanso semanal reduzido" /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="enforceSameDepotStartEnd" checked={!!value.enforceSameDepotStartEnd} onChange={(checked) => onChange('enforceSameDepotStartEnd', checked)} label="Exigir mesmo depósito na jornada" /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="enforceSingleLineDuty" checked={!!value.enforceSingleLineDuty} onChange={(checked) => onChange('enforceSingleLineDuty', checked)} label="Manter tripulante em uma única linha" /></Grid>
        </Grid>
      </SectionPanel>

      <SectionPanel
        title="Veículos e energia"
        subtitle="Jornada de veículo, pullout/pullback, restrição de depósito e infraestrutura de carregamento."
        icon={<IconTruck size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Turno máx. do veículo" fieldKey="maxVehicleShiftMinutes" value={value.maxVehicleShiftMinutes} onChange={(next) => onChange('maxVehicleShiftMinutes', next)} min={120} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Pullout" fieldKey="pulloutMinutes" value={value.pulloutMinutes} onChange={(next) => onChange('pulloutMinutes', next)} min={0} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Pullback" fieldKey="pullbackMinutes" value={value.pullbackMinutes} onChange={(next) => onChange('pullbackMinutes', next)} min={0} max={60} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Carregadores simultâneos" fieldKey="maxSimultaneousChargers" value={value.maxSimultaneousChargers ?? 4} onChange={(next) => onChange('maxSimultaneousChargers', next)} min={1} max={200} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Energia pico" value={value.peakEnergyCostPerKwh ?? 1.2} onChange={(next) => onChange('peakEnergyCostPerKwh', next)} min={0} max={50} step={0.1} unit="R$/kWh" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Energia fora pico" value={value.offpeakEnergyCostPerKwh ?? 0.8} onChange={(next) => onChange('offpeakEnergyCostPerKwh', next)} min={0} max={50} step={0.1} unit="R$/kWh" dense={dense} /></Grid>
          <Grid item xs={12} md={4}><SwitchField fieldKey="sameDepotRequired" checked={!!value.sameDepotRequired} onChange={(checked) => onChange('sameDepotRequired', checked)} label="Mesmo depósito para bloco" /></Grid>
        </Grid>
        <Alert severity="info" icon={<IconBatteryCharging size={16} />} sx={{ mt: 1.5, borderRadius: 2 }}>
          Custos de energia e capacidade de carregadores influenciam a heurística VSP para veículos elétricos.
        </Alert>
      </SectionPanel>

      <SectionPanel
        title="Workpieces, set covering e pricing"
        subtitle="Faixas de geração de colunas e granularidade das peças para o CSP."
        icon={<IconRoute size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Peça mínima" fieldKey="minWorkpieceMinutes" value={value.minWorkpieceMinutes ?? 120} onChange={(next) => onChange('minWorkpieceMinutes', next)} min={30} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Peça máxima" fieldKey="maxWorkpieceMinutes" value={value.maxWorkpieceMinutes ?? 540} onChange={(next) => onChange('maxWorkpieceMinutes', next)} min={30} max={1440} unit="min" dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trips mín./peça" fieldKey="minTripsPerPiece" value={value.minTripsPerPiece ?? 2} onChange={(next) => onChange('minTripsPerPiece', next)} min={1} max={20} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Trips máx./peça" fieldKey="maxTripsPerPiece" value={value.maxTripsPerPiece ?? 10} onChange={(next) => onChange('maxTripsPerPiece', next)} min={1} max={50} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Sucessores por tarefa" fieldKey="maxCandidateSuccessorsPerTask" value={value.maxCandidateSuccessorsPerTask ?? 5} onChange={(next) => onChange('maxCandidateSuccessorsPerTask', next)} min={1} max={50} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Máx. colunas" fieldKey="maxGeneratedColumns" value={value.maxGeneratedColumns ?? 2500} onChange={(next) => onChange('maxGeneratedColumns', next)} min={8} max={20000} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Iterações pricing" fieldKey="maxPricingIterations" value={value.maxPricingIterations ?? 1} onChange={(next) => onChange('maxPricingIterations', next)} min={0} max={20} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={3}><NumberField label="Adições por pricing" fieldKey="maxPricingAdditions" value={value.maxPricingAdditions ?? 192} onChange={(next) => onChange('maxPricingAdditions', next)} min={1} max={5000} dense={dense} /></Grid>
        </Grid>
      </SectionPanel>

      <SectionPanel
        title="Objetivos, fairness e custos sociais"
        subtitle="Pesos para equilíbrio da escala, domingos livres e adicionais operacionais."
        icon={<IconMap2 size={18} />}
      >
        <Grid container spacing={grid}>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Peso de fairness" fieldKey="fairnessWeight" value={value.fairnessWeight ?? 0.15} onChange={(next) => onChange('fairnessWeight', next)} min={0} max={10} step={0.05} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Peso de domingo livre" fieldKey="sundayOffWeight" value={value.sundayOffWeight ?? 0.2} onChange={(next) => onChange('sundayOffWeight', next)} min={0} max={10} step={0.05} dense={dense} /></Grid>
          <Grid item xs={12} sm={6} md={4}><NumberField label="Adicional feriado" fieldKey="holidayExtraPct" value={value.holidayExtraPct ?? 100} onChange={(next) => onChange('holidayExtraPct', next)} min={0} max={500} unit="%" helperText="100 = pagamento base dobrado" dense={dense} /></Grid>
        </Grid>
      </SectionPanel>

      <SectionPanel
        title="Metaheurísticas avançadas"
        subtitle="Parâmetros de GA, SA e Tabu Search para cenários mais difíceis."
        icon={<IconDna size={18} />}
      >
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Os parâmetros de GA, Simulated Annealing, Tabu e timeout ILP ainda estão guardados no perfil, mas hoje não mudam a execução principal disparada pela API.
        </Alert>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={1}><IconDna size={16} /><Typography variant="subtitle2" fontWeight={700}>Algoritmo Genético</Typography></Stack>
            <Grid container spacing={grid}>
              <Grid item xs={12} sm={6} md={3}><NumberField label="População" fieldKey="gaPopulationSize" value={value.gaPopulationSize} onChange={(next) => onChange('gaPopulationSize', next)} min={10} max={500} dense={dense} /></Grid>
              <Grid item xs={12} sm={6} md={3}><NumberField label="Gerações" fieldKey="gaGenerations" value={value.gaGenerations} onChange={(next) => onChange('gaGenerations', next)} min={1} max={10000} dense={dense} /></Grid>
              <Grid item xs={12} sm={6} md={3}><NumberField label="Mutação" fieldKey="gaMutationRate" value={value.gaMutationRate} onChange={(next) => onChange('gaMutationRate', next)} min={0} max={1} step={0.01} unit="%" helperText="0 a 1" dense={dense} /></Grid>
              <Grid item xs={12} sm={6} md={3}><NumberField label="Crossover" fieldKey="gaCrossoverRate" value={value.gaCrossoverRate} onChange={(next) => onChange('gaCrossoverRate', next)} min={0} max={1} step={0.01} unit="%" helperText="0 a 1" dense={dense} /></Grid>
            </Grid>
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={1}><IconTemperature size={16} /><Typography variant="subtitle2" fontWeight={700}>Simulated Annealing</Typography></Stack>
            <Grid container spacing={grid}>
              <Grid item xs={12} sm={4}><NumberField label="Temperatura inicial" fieldKey="saInitialTemperature" value={value.saInitialTemperature} onChange={(next) => onChange('saInitialTemperature', next)} min={1} max={1000000} dense={dense} /></Grid>
              <Grid item xs={12} sm={4}><NumberField label="Cooling rate" fieldKey="saCoolingRate" value={value.saCoolingRate} onChange={(next) => onChange('saCoolingRate', next)} min={0.001} max={0.9999} step={0.001} dense={dense} /></Grid>
              <Grid item xs={12} sm={4}><NumberField label="Temperatura mínima" fieldKey="saMinTemperature" value={value.saMinTemperature} onChange={(next) => onChange('saMinTemperature', next)} min={0.0001} max={100} step={0.001} dense={dense} /></Grid>
            </Grid>
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={1}><IconClock size={16} /><Typography variant="subtitle2" fontWeight={700}>Tabu Search</Typography></Stack>
            <Grid container spacing={grid}>
              <Grid item xs={12} sm={6}><NumberField label="Lista tabu" fieldKey="tsTabuSize" value={value.tsTabuSize} onChange={(next) => onChange('tsTabuSize', next)} min={1} max={1000} dense={dense} /></Grid>
              <Grid item xs={12} sm={6}><NumberField label="Máx. iterações" fieldKey="tsMaxIterations" value={value.tsMaxIterations} onChange={(next) => onChange('tsMaxIterations', next)} min={10} max={5000} dense={dense} /></Grid>
            </Grid>
          </Box>
        </Stack>
      </SectionPanel>
    </Stack>
  );
}
