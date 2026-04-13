import type { OptimizationSettings } from '../../_types';

export type SettingsFormValues = Omit<OptimizationSettings, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

type PercentLikeField = 'cctWaitingTimePayPct' | 'holidayExtraPct' | 'cctNocturnalExtraPct';
export type FieldEffect = 'ativo' | 'parcial' | 'sem_efeito';
export type HelpFieldKey = keyof SettingsFormValues;

export type HelpMeta = {
  title: string;
  short: string;
  technical: string;
  example?: string;
  effect?: FieldEffect;
};

export const PERCENT_UI_FIELDS: PercentLikeField[] = ['cctWaitingTimePayPct', 'holidayExtraPct', 'cctNocturnalExtraPct'];
export const NON_NUMERIC_FORM_FIELDS = new Set<keyof SettingsFormValues>([
  'name',
  'description',
  'algorithmType',
  'operationMode',
  'isActive',
  'applyCct',
  'allowReliefPoints',
  'allowMultiLineBlock',
  'enforceSameDepotStartEnd',
  'enforceSingleLineDuty',
  'sameDepotRequired',
  'pricingEnabled',
  'useSetCovering',
  'preservePreferredPairs',
  'allowVehicleSplitShifts',
  'cctIdleTimeIsPaid',
  'enforceTripGroupsHard',
  'operatorChangeTerminalsOnly',
  'operatorSingleVehicleOnly',
  'strictHardValidation',
]);

export const EFFECT_LABEL: Record<FieldEffect, string> = {
  ativo: 'Tem efeito real no solver',
  parcial: 'Tem efeito parcial na versao atual',
  sem_efeito: 'Ainda sem efeito real na execucao atual',
};

// ── FIELD_HELP ── Explicacao dupla (analogia + tecnica) para TODOS os campos ativos ──
export const FIELD_HELP: Record<string, HelpMeta> = {
  /* ── Estrategia ──────────────────────────────────────────────────────── */
  algorithmType: {
    title: 'Algoritmo principal',
    short: 'E como escolher o "metodo de trabalho": cada algoritmo busca a melhor escala de um jeito diferente, alguns mais rapidos e outros mais cuidadosos.',
    technical: 'Define o AlgorithmType usado pelo pipeline (greedy, SA, tabu_search, genetic, hybrid_pipeline, etc.). Greedy e O(n log n), meta-heuristicas exploram vizinhancas por time_budget.',
    effect: 'ativo',
  },
  timeBudgetSeconds: {
    title: 'Tempo de busca',
    short: 'E como dar mais tempo para o "consultor" pensar. Mais tempo = solucoes geralmente melhores, mas demora mais.',
    technical: 'Limite em segundos para meta-heuristicas (SA, Tabu, GA). O greedy ignora. Meta-heuristicas usam 80% desse valor; o restante e margem de seguranca.',
    effect: 'ativo',
  },
  applyCct: {
    title: 'Aplicar CCT/CLT',
    short: 'Liga ou desliga as regras trabalhistas. E como dizer "respeite as leis de descanso e jornada" ou "ignore tudo".',
    technical: 'Flag booleana enviada como apply_cct ao optimizer. Quando false, as restricoes de jornada deixam de ser verificadas pelo CSP.',
    effect: 'ativo',
  },
  allowReliefPoints: {
    title: 'Permitir pontos de rendicao',
    short: 'Permite trocar motorista no meio do caminho, como se outro pegasse o volante em um ponto combinado.',
    technical: 'Quando true, o CSP aceita troca de operador em relief points, nao exigindo que dest/orig coincidam. Aumenta a combinatoria de solucoes viaveis.',
    effect: 'ativo',
  },
  useSetCovering: {
    title: 'Usar set covering',
    short: 'Um metodo mais inteligente de montar escalas, como montar um quebra-cabeca tentando encaixar as melhores pecas.',
    technical: 'Quando true, o CSP usa modelo ILP de set covering/partitioning para selecionar jornadas otimas dentre as colunas geradas. Fallback para greedy se infactivel.',
    effect: 'ativo',
  },
  pricingEnabled: {
    title: 'Column generation (pricing)',
    short: 'Cria automaticamente novas combinacoes promissoras durante a busca, em vez de usar so as iniciais. "Inventar pecas melhores no meio do jogo."',
    technical: 'Ativa o pricing problem do column generation: gera colunas adicionais via dual variables da relaxacao LP, melhorando a qualidade da solucao ILP.',
    effect: 'ativo',
  },
  preservePreferredPairs: {
    title: 'Preservar pares ida/volta',
    short: 'O mesmo motorista que faz a ida tenta fazer a volta, como um carteiro que entrega e depois retorna pelo mesmo caminho.',
    technical: 'Injeta trip_group constraints no VSP e CSP para manter pares ida/volta no mesmo bloco/duty. Usa inferencia automatica por terminal/horario.',
    effect: 'ativo',
  },
  enforceTripGroupsHard: {
    title: 'Forçar pares ida/volta (obrigatório)',
    short: 'OBRIGA que o mesmo tripulante faça a viagem de ida e a de volta. Se desativado, o optimizer pode separar os pares para otimizar custo.',
    technical: 'Ativa enforce_trip_groups_hard e operator_pairing_hard no CSP. Injeta mandatory_trip_groups_same_duty com pares explícitos.',
    effect: 'ativo',
  },
  operatorChangeTerminalsOnly: {
    title: 'Troca de veículo somente em terminais',
    short: 'O motorista só pode trocar de veículo em pontos terminais (início ou fim de linha). Não pode trocar no meio do percurso.',
    technical: 'Restringe operator_change_terminals_only no CSP greedy. A troca de bloco/veículo só é permitida quando o ponto final do bloco anterior e o ponto inicial do próximo são terminais.',
    effect: 'ativo',
  },
  operatorSingleVehicleOnly: {
    title: 'Operador em veículo único',
    short: 'O motorista trabalha o dia inteiro no mesmo veículo. Não é permitido trocar de ônibus durante a jornada.',
    technical: 'Ativa operator_single_vehicle_only no CSP. Impede que um duty contenha blocos de diferentes veículos (source_block_ids).',
    effect: 'ativo',
  },
  strictHardValidation: {
    title: 'Validação hard estrita',
    short: 'Se houver violação hard na entrada ou na saída, a execução aborta em vez de apenas devolver auditoria.',
    technical: 'Propaga strict_hard_validation para VSP e CSP. Quando false, a execução continua e o relatório de hard constraints permanece disponível em meta.hard_constraint_report.',
    effect: 'ativo',
  },

  /* ── Tripulacao e jornada ────────────────────────────────────────────── */
  cctMaxShiftMinutes: {
    title: 'Spread maximo da jornada',
    short: 'O tempo total entre entrar e sair do trabalho, incluindo intervalos. Se entra as 6h e sai as 14h = 480 min.',
    technical: 'Spread = end_time - start_time + pullout + pullback. Limite hard no CSP: jornada que ultrapasse e rejeitada. Padrao CLT urbano: 480 min.',
    effect: 'ativo',
  },
  cctMaxWorkMinutes: {
    title: 'Jornada regular (base da HE)',
    short: 'Base para calcular hora extra na jornada do plantao. Considera a jornada total entre inicio e fim, nao so o tempo efetivo dirigindo.',
    technical: 'Hora extra = max(0, spread_time - max_work_minutes). O limite hard continua respeitando max_shift_minutes e overtime_limit_minutes.',
    effect: 'ativo',
  },
  cctMinWorkMinutes: {
    title: 'Trabalho efetivo minimo',
    short: 'Nao vale a pena escalar alguem para menos do que isso. Evita jornadas "migalha" que geram custo sem produzir.',
    technical: 'Filtro no CSP: duties com work_time < min_work sao penalizadas ou rejeitadas. Garante utilizacao minima de operadores.',
    effect: 'ativo',
  },
  cctMinShiftMinutes: {
    title: 'Spread minimo da jornada',
    short: 'A jornada nao pode ser menor que isso. Evita turnos extremamente curtos que nao compensam o deslocamento.',
    technical: 'Limite inferior de spread da duty no CSP. Se shift < min_shift, penaliza ou rejeita a duty candidata.',
    effect: 'ativo',
  },
  cctOvertimeLimitMinutes: {
    title: 'Limite de hora extra',
    short: 'Quanto de hora extra e permitido acima da jornada regular do plantao.',
    technical: 'Se spread_time - max_work_minutes > overtime_limit, a duty e rejeitada. CLT: maximo 2h extras/dia (120 min).',
    effect: 'ativo',
  },
  cctMaxDrivingMinutes: {
    title: 'Direcao continua maxima',
    short: 'Quanto tempo pode dirigir sem parar, como "nao pode ficar mais de X horas no volante sem descansar".',
    technical: 'Limite de continuous_drive sem reset por break. Apos esse periodo, exige pausa >= min_break para reset. Art. 235-D da CLT.',
    effect: 'ativo',
  },
  cctMinBreakMinutes: {
    title: 'Pausa minima',
    short: 'O menor intervalo que conta como descanso real. Uma parada de 5 min nao conta; precisa desse minimo.',
    technical: 'Gap minimo entre blocos para resetar continuous_drive e contabilizar como break valido no CSP. Abaixo disso, considerado idle continuo.',
    effect: 'ativo',
  },
  cctMandatoryBreakAfterMinutes: {
    title: 'Pausa obrigatoria apos',
    short: 'Depois de tanto tempo dirigindo, o sistema obriga uma parada. Um "alarme de descanso" automatico.',
    technical: 'Apos acumular este valor de driving continuo, o CSP insere corte de run-cutting e exige pausa. Alinhado com mandatory_break_after do GreedyCSP.',
    effect: 'ativo',
  },
  cctMealBreakMinutes: {
    title: 'Intervalo de refeicao',
    short: 'Tempo minimo para uma refeicao completa. O sistema tenta encaixar essa pausa na jornada.',
    technical: 'Trigger de meal_break no run-cutting: se driving acumulado atinge meal_trigger (mandatory_break - meal_break), o CSP corta o bloco em tarefas menores.',
    effect: 'ativo',
  },
  cctMinLayoverMinutes: {
    title: 'Layover minimo',
    short: 'Tempo minimo que o veiculo espera no terminal antes da proxima viagem. "Estacionar e respirar."',
    technical: 'Min gap entre trips no mesmo block/duty. Garante conexao fisicamente viavel (manobra, embarque). Usado pelo block_is_feasible().',
    effect: 'ativo',
  },
  connectionToleranceMinutes: {
    title: 'Tolerancia de conexao',
    short: 'Perdoa pequenos gaps entre viagens. Ex: se uma viagem termina as 10:00 e a proxima comeca as 10:02, com tolerancia de 3 min o solver aceita. Sem isso, 2 min de atraso pode desperdicar um veiculo inteiro.',
    technical: 'connection_tolerance_minutes: valor adicionado ao gap antes de comparar com deadhead minimo. Propaga-se para VSP (MCNF, Greedy) e CSP. Ideal para compensar imprecisoes de carta horaria.',
    example: 'Valor 5 = aceita conexoes com ate 5 min de folga negativa.',
    effect: 'ativo',
  },
  operationMode: {
    title: 'Modo de Operação',
    short: 'Define as restrições globais do sistema: Urbano (mais rígido com CCT) ou Fretamento (mais focado em produtividade e janelas longas).',
    technical: 'operation_mode enviado ao solver. Altera pesos de penalidade e janelas de viabilidade para pullout/pullback e refeicao.',
    effect: 'ativo',
  },
  cctMinGuaranteedWorkMinutes: {
    title: 'Horas minimas garantidas',
    short: 'Mesmo que trabalhe menos, recebe como se tivesse trabalhado pelo menos esse tanto. "Piso salarial de horas."',
    technical: 'min_guaranteed_work_minutes no CSP. Se work_time < este valor, paid_minutes = max(work_time, guaranteed). Afeta custo da solucao.',
    effect: 'ativo',
  },
  cctWaitingTimePayPct: {
    title: 'Espera remunerada (%)',
    short: 'Quanto do tempo de espera entre viagens e pago. 30% = paga um terco da espera; 100% = paga tudo.',
    technical: 'Multiplicador sobre idle/waiting time no calculo de paid_minutes. waiting_time_pay_pct=0.3 -> 30% do tempo ocioso entra como custo. CLT art. 235-C par.8.',
    effect: 'ativo',
  },
  cctIdleTimeIsPaid: {
    title: 'Tempo ocioso e pago',
    short: 'Se ativado, o tempo parado entre viagens e considerado como hora paga. Se nao, e "tempo morto" sem custo.',
    technical: 'idle_time_is_paid: quando true, todo gap entre trips entra como paid_minutes. Impacta diretamente o custo total da solucao CSP.',
    effect: 'ativo',
  },

  /* ── Descanso e Lei 13.103 ───────────────────────────────────────────── */
  cctSplitBreakFirstMinutes: {
    title: 'Fracionamento 1a parte',
    short: 'A primeira parte do descanso fracionado. Como dividir o intervalo em dois pedacos menores.',
    technical: 'Split break: em vez de uma pausa grande, o motorista faz duas menores. Esta e a 1a fracao. Lei 13.103/2015.',
    effect: 'ativo',
  },
  cctSplitBreakSecondMinutes: {
    title: 'Fracionamento 2a parte',
    short: 'A segunda parte do descanso fracionado. Somando as duas partes, deve atingir o minimo exigido.',
    technical: 'Split break 2a fracao. split_first + split_second deve >= min_break. CLT art. 235-C par.3.',
    effect: 'ativo',
  },
  cctInterShiftRestMinutes: {
    title: 'Descanso entre jornadas',
    short: 'Tempo minimo de descanso entre o fim de uma jornada e o inicio da proxima. "Dormir antes de voltar."',
    technical: 'Inter-shift rest: CLT art. 66 exige 11h (660 min). Usado no rostering multi-dia para espacar duties consecutivas.',
    effect: 'ativo',
  },
  cctWeeklyRestMinutes: {
    title: 'Descanso semanal',
    short: 'Folga semanal minima obrigatoria. Geralmente 24h (1440 min), preferencialmente aos domingos.',
    technical: 'Weekly rest: CLT art. 67 exige 24h consecutivas de repouso. 1440 min = 24h. Usado no rostering multi-dia.',
    effect: 'ativo',
  },
  cctDailyDrivingLimitMinutes: {
    title: 'Limite diario de direcao',
    short: 'Quanto pode dirigir no dia todo (9h padrao). Diferente de "direcao continua" ─ e o acumulado.',
    technical: 'Soma total de driving no dia. Lei 13.103: 10h diarias com extensao. Usado como hard constraint no CSP quando stricto.',
    effect: 'ativo',
  },
  cctExtendedDailyDrivingLimitMinutes: {
    title: 'Limite diario estendido',
    short: 'Em dias excepcionais, pode dirigir um pouco mais (10h). Mas nao todos os dias ─ limitado por semana.',
    technical: 'Extensao do limite diario permitida em ate N dias/semana. Lei 13.103 art. 235-C par.1. Default 600 min (10h).',
    effect: 'ativo',
  },
  cctMaxExtendedDrivingDaysPerWeek: {
    title: 'Dias estendidos por semana',
    short: 'Quantos dias por semana o motorista pode usar o limite diario estendido. Geralmente 2.',
    technical: 'Maximo de dias com daily_driving > daily_limit por semana calendario. Constraint semanal no rostering.',
    effect: 'ativo',
  },
  cctWeeklyDrivingLimitMinutes: {
    title: 'Limite semanal de direcao',
    short: 'Total maximo de horas dirigindo em uma semana. "Teto semanal de volante."',
    technical: 'Soma de driving_minutes na semana. EU 561/2006: 56h (3360 min). Hard constraint no rostering semanal.',
    effect: 'ativo',
  },
  cctFortnightDrivingLimitMinutes: {
    title: 'Limite quinzenal de direcao',
    short: 'Total maximo de horas dirigindo em 15 dias. Impede acumulo excessivo.',
    technical: 'Soma de driving em duas semanas consecutivas. EU 561/2006: 90h (5400 min). Constraint quinzenal.',
    effect: 'ativo',
  },
  enforceSameDepotStartEnd: {
    title: 'Jornada no mesmo deposito',
    short: 'O motorista precisa comecar e terminar no mesmo lugar. "Sair e voltar para a mesma garagem."',
    technical: 'Hard constraint no CSP: start_depot_id == end_depot_id em cada duty.',
    effect: 'ativo',
  },
  enforceSingleLineDuty: {
    title: 'Uma linha por tripulante',
    short: 'O motorista fica so em uma linha o dia todo, sem trocar. "Seu posto e a linha 815, o dia todo."',
    technical: 'Hard constraint: todos os trips na duty devem ter o mesmo line_id. Pode aumentar crew count.',
    effect: 'ativo',
  },

  /* ── Veiculos e custos ───────────────────────────────────────────────── */
  maxVehicleShiftMinutes: {
    title: 'Turno maximo do veiculo',
    short: 'Por quanto tempo o onibus pode ficar na rua. "O onibus trabalha no maximo X horas e depois volta para a garagem."',
    technical: 'Limite hard no VSP: block_spread <= max_vehicle_shift. Blocos que excedem sao inviaveis. Afeta diretamente o numero de veiculos.',
    effect: 'ativo',
  },
  fixedVehicleActivationCost: {
    title: 'Custo fixo por veiculo',
    short: 'Quanto custa "ligar" cada veiculo no dia, independente de quanto ande. A "taxa de saida da garagem".',
    technical: 'fixed_vehicle_activation_cost no VSP: componente fixa do custo por bloco. Valores altos = menos veiculos; valores baixos = mais liberdade.',
    effect: 'ativo',
  },
  deadheadCostPerMinute: {
    title: 'Custo de deslocamento vazio',
    short: 'O custo por minuto quando o onibus vai vazio de um terminal para outro. "Andar de bobeira custa caro."',
    technical: 'deadhead_cost_per_minute: penaliza conexoes entre trips distantes no VSP. Custo proporcional ao tempo de deadhead.',
    effect: 'ativo',
  },
  idleCostPerMinute: {
    title: 'Custo de ociosidade',
    short: 'O custo por minuto com o onibus parado esperando. "Tempo parado tambem custa dinheiro."',
    technical: 'idle_cost_per_minute: penalidade por minuto de gap no bloco. Usado na funcao de custo do SA/Tabu/GA (quick_cost_sorted).',
    effect: 'ativo',
  },
  allowMultiLineBlock: {
    title: 'Permitir blocos multlinha',
    short: 'Permite que o mesmo veiculo faca viagens de linhas diferentes no mesmo dia. "Um onibus pode rodar na Linha A de manha e na Linha B a tarde."',
    technical: 'allow_multi_line_block: quando true, o VSP (Greedy e MCNF) permite conexoes entre trips de line_id distintos. Se false, cada bloco fica restrito a uma única linha.',
    effect: 'ativo',
  },
  allowVehicleSplitShifts: {
    title: 'Permitir turno partido do veiculo',
    short: 'O onibus faz um turno de manha, fica parado e volta a tarde. "Dois expedientes no mesmo dia."',
    technical: 'Permite blocos com gap > split_shift_min_gap_minutes (120 min). Se false, blocos devem ser contiguos.',
    effect: 'ativo',
  },
  pulloutMinutes: {
    title: 'Pullout (saida da garagem)',
    short: 'Tempo para o onibus sair da garagem ate o ponto inicial. "Aquecer o motor e ir ate a primeira parada."',
    technical: 'Adicionado ao inicio do spread da duty como overhead operacional. pullout + pullback e somado ao spread total.',
    effect: 'ativo',
  },
  pullbackMinutes: {
    title: 'Pullback (retorno a garagem)',
    short: 'Tempo para o onibus voltar da ultima viagem para a garagem. O caminho "para dormir".',
    technical: 'Adicionado ao final do spread da duty. Parte do calculo: new_spread = block.end - duty.start + pullout + pullback.',
    effect: 'ativo',
  },
  sameDepotRequired: {
    title: 'Mesmo deposito para bloco',
    short: 'O onibus deve terminar o dia na mesma garagem onde comecou. Nao pode "dormir fora de casa".',
    technical: 'same_depot_required no VSP: restricao que exige origin_depot == destination_depot para cada block.',
    effect: 'ativo',
  },
  maxSimultaneousChargers: {
    title: 'Carregadores simultaneos',
    short: 'Quantos onibus eletricos podem carregar ao mesmo tempo. "Vagas de tomada" na garagem.',
    technical: 'Limite de concorrencia de recarga no planejamento EV. Se > 0, verifica sobreposicao de janelas de recarga.',
    effect: 'ativo',
  },
  peakEnergyCostPerKwh: {
    title: 'Energia em horario pico',
    short: 'Quanto custa carregar o onibus eletrico quando a energia esta cara (horario de pico).',
    technical: 'Tarifa de energia no horario pico (kWh). Influencia a heuristica de alocacao de janelas de recarga no VSP EV.',
    effect: 'ativo',
  },
  offpeakEnergyCostPerKwh: {
    title: 'Energia fora do pico',
    short: 'Quanto custa carregar fora do horario comercial (mais barato). "Carregar a noite sai mais em conta."',
    technical: 'Tarifa de energia fora do pico (kWh). O solver prefere recargas nesta faixa quando possivel.',
    effect: 'ativo',
  },

  /* ── Noturno ─────────────────────────────────────────────────────────── */
  cctNocturnalStartHour: {
    title: 'Inicio do periodo noturno',
    short: 'A hora em que comeca a "noite" para fins de adicional noturno. Geralmente 22h.',
    technical: 'Hora (0-23) a partir da qual incide adicional noturno. CLT art. 73: 22h as 5h. Fator aplicado no calculo de custo.',
    effect: 'ativo',
  },
  cctNocturnalEndHour: {
    title: 'Fim do periodo noturno',
    short: 'A hora em que termina a "noite". Geralmente 5h da manha.',
    technical: 'Hora (0-23) em que cessa o adicional noturno. CLT art. 73. Padrao: 5.',
    effect: 'ativo',
  },
  cctNocturnalExtraPct: {
    title: 'Adicional noturno (%)',
    short: 'Quanto a mais o motorista ganha por trabalhar a noite. 20% = recebe 120% do normal nesse periodo.',
    technical: 'Multiplicador sobre horas noturnas: 0.20 = 20% de adicional. CLT art. 73 par.1. Impacta paid_minutes do CSP.',
    effect: 'ativo',
  },

  /* ── Workpieces e column generation ──────────────────────────────────── */
  minWorkpieceMinutes: {
    title: 'Peca minima',
    short: 'O menor pedaco de trabalho que pode ser oferecido. "Nao vale escalar alguem para menos de X minutos."',
    technical: 'min_workpiece_minutes: filtra pecas candidatas curtas no column generation. Reduz combinatoria.',
    effect: 'ativo',
  },
  maxWorkpieceMinutes: {
    title: 'Peca maxima',
    short: 'O maior pedaco de trabalho continuo. Pecas maiores podem reduzir crew mas limitam flexibilidade.',
    technical: 'max_workpiece_minutes: limite superior de duracao para cada coluna candidata no set partitioning.',
    effect: 'ativo',
  },
  minTripsPerPiece: {
    title: 'Viagens minimas por peca',
    short: 'Cada peca precisa ter pelo menos essa quantidade de viagens. Evita "migalhas".',
    technical: 'Filtro de cardinalidade minima em cada coluna do set partitioning. Elimina colunas triviais.',
    effect: 'ativo',
  },
  maxTripsPerPiece: {
    title: 'Viagens maximas por peca',
    short: 'Limite de viagens por peca. Mantem pecas gerenciaveis e controla complexidade.',
    technical: 'Limite de trips por coluna na geracao. Controla explosao combinatoria em cenarios densos.',
    effect: 'ativo',
  },
  maxCandidateSuccessorsPerTask: {
    title: 'Sucessores por tarefa',
    short: 'Quantas "proximas viagens" o sistema testa para cada viagem. Mais opcoes = melhor mas mais lento.',
    technical: 'Branching factor do grafo de tasks no column generation. Maior valor expande o espaco exponencialmente.',
    effect: 'ativo',
  },
  maxGeneratedColumns: {
    title: 'Maximo de colunas geradas',
    short: 'Limite de quantas combinacoes o sistema cria. "Nao invente mais que X opcoes."',
    technical: 'Hard cap no numero de colunas (variaveis) do modelo ILP. Evita explosao de memoria.',
    effect: 'ativo',
  },
  maxPricingIterations: {
    title: 'Iteracoes de pricing',
    short: 'Rodadas extras de criacao inteligente de pecas. Mais rodadas = pecas potencialmente melhores.',
    technical: 'Ciclos de re-pricing: resolve LP -> extrai duals -> gera colunas com custo reduzido negativo -> re-resolve.',
    effect: 'ativo',
  },
  maxPricingAdditions: {
    title: 'Adicoes por pricing',
    short: 'Quantas pecas novas entram a cada rodada. Controla velocidade vs. qualidade.',
    technical: 'Limite de colunas por iteracao de pricing. Alto = mais candidatas = potencial melhor mas LP mais pesado.',
    effect: 'ativo',
  },

  /* ── Objetivos ───────────────────────────────────────────────────────── */
  fairnessWeight: {
    title: 'Peso de equidade',
    short: 'Quanto o sistema se preocupa em distribuir trabalho igual. 0 = nao se importa; alto = tenta igualar.',
    technical: 'fairness_weight no CSP: penaliza desvio de work_time em relacao ao target. Normalizado 0-1 (>1.0 dividido por 100).',
    effect: 'ativo',
  },
  holidayExtraPct: {
    title: 'Adicional de feriado (%)',
    short: 'Quanto a mais custa escalar alguem no feriado. 100% = paga o dobro naquele dia.',
    technical: 'Multiplicador de custo da duty em feriado. 1.0 = 100% adicional. Aplicado no calculo de paid_minutes.',
    effect: 'ativo',
  },
  sundayOffWeight: {
    title: 'Peso folga no domingo',
    short: 'Preferencia por nao escalar tripulantes ao domingo. 0 = nao importa; alto = tenta evitar escalas no domingo.',
    technical: 'sunday_off_weight no CSP: penaliza duties que caem em domingos. Usado no rostering multi-dia para preferir folgas dominicais.',
    effect: 'parcial',
  },
  cctNocturnalFactor: {
    title: 'Fator hora noturna',
    short: 'Fator de reducao da hora noturna (CLT art. 73 par.1). 1h noturna = 52min30s, fator 0.875.',
    technical: 'Multiplicador que reduz a duracao da hora noturna: 60*0.875=52.5min. Afeta o calculo de minutos trabalhados no periodo noturno.',
    effect: 'ativo',
  },
  isActive: {
    title: 'Perfil ativo',
    short: 'Apenas um perfil pode estar ativo por empresa. Ao ativar este, o anterior sera desativado automaticamente.',
    technical: 'Flag booleana que marca o perfil como ativo. O backend usa find_active(companyId) para obter o perfil vigente nas otimizacoes.',
    effect: 'ativo',
  },
  maxTimeoutMultiplier: {
    title: 'Multiplicador de timeout (Admin)',
    short: 'Margem de segurança para o tempo de resposta. Se o orçamento é 10min e o multiplicador é 1.5, o sistema espera até 15min + margem antes de desistir.',
    technical: 'Fator aplicado sobre time_budget_s para definir o HTTP timeout do backend: max(360s, budget * multiplier + 60s). Protegido no backend contra não-admins.',
    effect: 'ativo',
  },
  fairnessTargetWorkMinutes: {
    title: 'Meta de trabalho (Fairness)',
    short: 'O "alvo" de horas para cada motorista. O sistema tenta deixar todo mundo perto desse valor para ninguém trabalhar demais ou de menos.',
    technical: 'fairness_target_work_minutes: valor central para cálculo de desvios no objetivo de equidade. Padrão 7h (420 min).',
    effect: 'ativo',
  },
  fairnessToleranceMinutes: {
    title: 'Tolerância de equidade',
    short: 'O quanto o sistema pode "errar" a meta acima sem começar a penalizar. É uma margem de manobra para escalas difíceis.',
    technical: 'fairness_tolerance_minutes: janela de desvio positivo ignorada pela função de custo de fairness.',
    effect: 'ativo',
  },
  maxUnpaidBreakMinutes: {
    title: 'Limite de ociosidade total',
    short: 'O máximo de tempo que um motorista pode ficar parado ou em intervalos não pagos somados na jornada toda.',
    technical: 'max_unpaid_break_minutes: limite hard para a soma de todos os gaps não remunerados na duty.',
    effect: 'ativo',
  },
  longUnpaidBreakLimitMinutes: {
    title: 'Gatilho de pausa longa',
    short: 'A partir de quanto tempo uma única parada é considerada "excessiva" e deve ser evitada pelo sistema.',
    technical: 'long_unpaid_break_limit_minutes: limite de duração de um único gap antes de aplicar penalidade de custo.',
    effect: 'ativo',
  },
  longUnpaidBreakPenaltyWeight: {
    title: 'Peso da penalidade de pausa',
    short: 'O quanto o sistema "sofre" ao criar pausas longas. Valores altos forçam jornadas mais contínuas.',
    technical: 'long_unpaid_break_penalty_weight: multiplicador aplicado sobre minutos excedentes ao gatilho de pausa longa.',
    effect: 'ativo',
  },
  maxConnectionCostForReuseRatio: {
    title: 'Agressividade de reuso (VSP)',
    short: 'Define se o sistema deve tentar reusar o mesmo ônibus a qualquer custo ou se é melhor pegar um novo ônibus na garagem.',
    technical: 'max_connection_cost_for_reuse_ratio: threshold de custo de conexão para decidir entre linkar tarefas ou criar novos blocos.',
    effect: 'ativo',
  },
  goalWeightOvertime: {
    title: 'Peso: Hora Extra',
    short: 'Importância de evitar horas extras. Aumente para reduzir o custo de folha, mas pode exigir mais contratações.',
    technical: 'goal_weights.overtime: multiplicador de penalidade para minutos que excedem a jornada regular (HE).',
    effect: 'ativo',
  },
  goalWeightSpread: {
    title: 'Peso: Amplitude (Spread)',
    short: 'Importância de ter jornadas curtas "ponta a ponta". Ajuda no conforto do tripulante.',
    technical: 'goal_weights.spread: multiplicador de penalidade para a duração total da jornada do primeiro ao último minuto.',
    effect: 'ativo',
  },
  goalWeightMinWork: {
    title: 'Peso: Trabalho Mínimo',
    short: 'Importância de garantir que cada escala tenha trabalho produtivo suficiente para compensar o custo.',
    technical: 'goal_weights.min_work: penalidade para jornadas muito curtas que não atingem a garantia mínima.',
    effect: 'ativo',
  },
  terminalCentralMinLayover: {
    title: 'Layover Terminal Central',
    short: 'Tempo mínimo de espera específico para o Terminal Central (ID 1). Geralmente maior devido ao fluxo.',
    technical: 'terminal_central_min_layover: substitui o min_layover padrão apenas quando a conexão ocorre no terminal principal.',
    effect: 'ativo',
  },
  splitShiftMinGapMinutes: {
    title: 'Gap mín. Recolhimento',
    short: 'Menor tempo de espera para considerar que um ônibus pode "recolher" para a garagem e voltar mais tarde (Turno Partido).',
    technical: 'split_shift_min_gap_minutes: no VSP, define o intervalo mínimo para aplicar lógica de split shift (teto de custo de garagem).',
    effect: 'ativo',
  },
  splitShiftMaxGapMinutes: {
    title: 'Gap máx. Recolhimento',
    short: 'Maior tempo que um ônibus pode ficar parado (recolhido) entre dois turnos no mesmo dia.',
    technical: 'split_shift_max_gap_minutes: limite superior para janelas de ociosidade em blocos bipartidos no VSP.',
    effect: 'ativo',
  },
  vspGarageReturnPolicy: {
    title: 'Política de Recolhimento',
    short: 'Como o sistema decide se o ônibus deve voltar para a garagem ou ficar na rua.',
    technical: 'vsp_garage_return_policy: define o custo aplicado em janelas de split shift (smart|always|never).',
    effect: 'ativo',
  },
};

export const ALGORITHM_OPTIONS = [
  { value: 'full_pipeline', label: 'Estrategia Industrial (VSP + CSP)' },
  { value: 'hybrid_pipeline', label: 'Estrategia Hibrida (Legado Estavel)' },
  { value: 'greedy', label: 'Guloso Rapido (MCNF/Greedy)' },
];

export const DEFAULT_SETTINGS_FORM: SettingsFormValues = {
  name: '',
  description: '',
  algorithmType: 'full_pipeline',
  operationMode: 'urban',
  // Budget
  timeBudgetSeconds: 300,
  connectionToleranceMinutes: 2,
  // CCT jornada
  cctMaxShiftMinutes: 480,
  cctMaxWorkMinutes: 440,
  cctMinWorkMinutes: 0,
  cctMinShiftMinutes: 0,
  cctOvertimeLimitMinutes: 120,
  cctMaxDrivingMinutes: 270,
  cctMinBreakMinutes: 30,
  allowReliefPoints: false,
  cctMinLayoverMinutes: 8,
  applyCct: true,
  // Breaks e refeicao
  cctMandatoryBreakAfterMinutes: 270,
  cctSplitBreakFirstMinutes: 15,
  cctSplitBreakSecondMinutes: 30,
  cctMealBreakMinutes: 60,
  // Descansos
  cctInterShiftRestMinutes: 660,
  cctWeeklyRestMinutes: 1440,
  // Limites de direcao
  cctDailyDrivingLimitMinutes: 540,
  cctExtendedDailyDrivingLimitMinutes: 600,
  cctMaxExtendedDrivingDaysPerWeek: 2,
  cctWeeklyDrivingLimitMinutes: 3360,
  cctFortnightDrivingLimitMinutes: 5400,
  // Remuneracao
  cctWaitingTimePayPct: 30,
  cctMinGuaranteedWorkMinutes: 360,
  cctIdleTimeIsPaid: true,
  // Noturno
  cctNocturnalStartHour: 22,
  cctNocturnalEndHour: 5,
  cctNocturnalFactor: 0.875,
  cctNocturnalExtraPct: 20,
  // Operacionais
  pulloutMinutes: 10,
  pullbackMinutes: 10,
  maxVehicleShiftMinutes: 960,
  fixedVehicleActivationCost: 800,
  deadheadCostPerMinute: 0.85,
  idleCostPerMinute: 0.5,
  allowVehicleSplitShifts: true,
  enforceSameDepotStartEnd: false,
  enforceSingleLineDuty: false,
  sameDepotRequired: false,
  // EV
  maxSimultaneousChargers: 0,
  peakEnergyCostPerKwh: 0,
  offpeakEnergyCostPerKwh: 0,
  // Column generation
  minWorkpieceMinutes: 0,
  maxWorkpieceMinutes: 480,
  minTripsPerPiece: 1,
  maxTripsPerPiece: 6,
  pricingEnabled: true,
  useSetCovering: true,
  preservePreferredPairs: true,
  maxCandidateSuccessorsPerTask: 5,
  maxGeneratedColumns: 2500,
  maxPricingIterations: 1,
  maxPricingAdditions: 192,
  // Regras operacionais
  enforceTripGroupsHard: true,
  operatorChangeTerminalsOnly: true,
  operatorSingleVehicleOnly: false,
  strictHardValidation: true,
  // Objetivos
  fairnessWeight: 0.15,
  holidayExtraPct: 100,
  maxTimeoutMultiplier: 1.5,
  fairnessTargetWorkMinutes: 420,
  fairnessToleranceMinutes: 30,
  maxUnpaidBreakMinutes: 360,
  longUnpaidBreakLimitMinutes: 180,
  longUnpaidBreakPenaltyWeight: 1.0,
  maxConnectionCostForReuseRatio: 2.5,
  goalWeightOvertime: 0.8,
  goalWeightSpread: 0.15,
  goalWeightMinWork: 0.2,
  terminalCentralMinLayover: 12,
  splitShiftMinGapMinutes: 120,
  splitShiftMaxGapMinutes: 600,
  isActive: true,
};
