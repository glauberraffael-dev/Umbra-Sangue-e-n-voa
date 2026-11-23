export type GamePhase = 'title' | 'playing' | 'grimoire' | 'paused' | 'gameover' | 'victory';

export type DisciplineId =
  | 'tenebrosidade'
  | 'ofuscacao'
  | 'auspicios'
  | 'dominacao'
  | 'metamorfose'
  | 'rapidez';

export type ActivePowerId =
  | 'shadowDash'
  | 'snuffLamp'
  | 'shadowSnare'
  | 'abyssalShroud'
  | 'obfuscate'
  | 'falseVisage'
  | 'crimsonSense'
  | 'astralScout'
  | 'dominate'
  | 'memoryWipe'
  | 'possess'
  | 'batSwarm'
  | 'mistForm'
  | 'celerity'
  | 'shadowLeap'
  | 'shadowThrow'
  | 'shadowDecoy'
  | 'darknessPulse';

export type HotkeyBindings = Record<ActivePowerId, string>;

export const MAX_EQUIPPED_SLOTS = 8;

export const DEFAULT_EQUIPPED_POWERS: ActivePowerId[] = [
  'shadowDash',
  'snuffLamp',
  'obfuscate',
  'crimsonSense',
  'dominate',
  'batSwarm',
  'celerity',
];

export const DEFAULT_HOTKEYS: HotkeyBindings = {
  shadowDash: 'KeyQ',
  snuffLamp: 'KeyE',
  shadowSnare: 'Digit4',
  abyssalShroud: 'Digit5',
  darknessPulse: 'KeyJ',
  obfuscate: 'Digit1',
  falseVisage: 'Digit6',
  shadowDecoy: 'KeyH',
  crimsonSense: 'KeyV',
  astralScout: 'KeyT',
  dominate: 'Digit2',
  memoryWipe: 'Digit7',
  possess: 'KeyY',
  batSwarm: 'KeyR',
  mistForm: 'Digit8',
  celerity: 'Digit3',
  shadowLeap: 'KeyZ',
  shadowThrow: 'KeyB',
};

export interface ActivePowerMeta {
  id: ActivePowerId;
  discipline: DisciplineId;
  minTier: number;
  requiredNodeId: string;
  name: string;
  shortName: string;
  bloodCostLabel: string;
  bloodCostValue: number;
  iconKey: string;
  cooldownSec: number;
  description: string;
}

export const ACTIVE_POWER_LIST: ActivePowerMeta[] = [
  {
    id: 'shadowDash',
    discipline: 'tenebrosidade',
    minTier: 1,
    requiredNodeId: 'ten_1',
    name: 'Passo das Sombras',
    shortName: 'Passo Sombrio',
    bloodCostLabel: '10 Sangue',
    bloodCostValue: 10,
    iconKey: 'dash',
    cooldownSec: 4.5,
    description: 'Avanço veloz em névoa escura para atravessar vias iluminadas e vãos entre telhados.',
  },
  {
    id: 'snuffLamp',
    discipline: 'tenebrosidade',
    minTier: 2,
    requiredNodeId: 'ten_2a',
    name: 'Apagar Luz',
    shortName: 'Apagar Luz',
    bloodCostLabel: '8 Sangue',
    bloodCostValue: 8,
    iconKey: 'lamp',
    cooldownSec: 7.0,
    description: 'Extingue lampiões a gás à distância (14m); guardas próximos investigarão a escuridão.',
  },
  {
    id: 'shadowSnare',
    discipline: 'tenebrosidade',
    minTier: 2,
    requiredNodeId: 'ten_2b',
    name: 'Laço das Sombras',
    shortName: 'Laço Sombrio',
    bloodCostLabel: '12 Sangue',
    bloodCostValue: 12,
    iconKey: 'snare',
    cooldownSec: 9.0,
    description: 'Gavinhas abissais imobilizam o alvo à frente por 4.5s e zeram sua suspeita imediata.',
  },
  {
    id: 'abyssalShroud',
    discipline: 'tenebrosidade',
    minTier: 3,
    requiredNodeId: 'ten_3',
    name: 'Mortalha Abissal',
    shortName: 'Mortalha Abis.',
    bloodCostLabel: '18 Sangue',
    bloodCostValue: 18,
    iconKey: 'shroud',
    cooldownSec: 16.0,
    description: 'Envolve o vampiro em trevas densas por 6.5s, zerando exposição e apagando lampiões próximos.',
  },
  {
    id: 'obfuscate',
    discipline: 'ofuscacao',
    minTier: 2,
    requiredNodeId: 'ofu_2a',
    name: 'Ofuscação Espectral',
    shortName: 'Ofuscação',
    bloodCostLabel: '14 Sangue',
    bloodCostValue: 14,
    iconKey: 'ghost',
    cooldownSec: 13.0,
    description: 'Translucidez espectral por 8s, invisível aos mortais mesmo sob lampiões.',
  },
  {
    id: 'falseVisage',
    discipline: 'ofuscacao',
    minTier: 2,
    requiredNodeId: 'ofu_2b',
    name: 'Falso Semblante',
    shortName: 'Falso Sembl.',
    bloodCostLabel: '14 Sangue',
    bloodCostValue: 14,
    iconKey: 'mask',
    cooldownSec: 15.0,
    description: 'Disfarça sua aura sobrenatural por 10s; sentinelas o ignoram enquanto caminhar sem atacar.',
  },
  {
    id: 'crimsonSense',
    discipline: 'auspicios',
    minTier: 1,
    requiredNodeId: 'aus_1',
    name: 'Sentido Carmesim',
    shortName: 'Sentido Carm.',
    bloodCostLabel: '1.8 / 1.1 s',
    bloodCostValue: 2,
    iconKey: 'eye',
    cooldownSec: 0,
    description: 'Revela o pulso vital através de paredes e projeta cones de visão no chão.',
  },
  {
    id: 'astralScout',
    discipline: 'auspicios',
    minTier: 2,
    requiredNodeId: 'aus_2b',
    name: 'Projeção Astral',
    shortName: 'Sonda Astral',
    bloodCostLabel: '10 + 1.4/s',
    bloodCostValue: 10,
    iconKey: 'astral',
    cooldownSec: 2.0,
    description: 'Desprende a consciência em voo livre (até 45m) para reconhecer patrulhas e rotas.',
  },
  {
    id: 'dominate',
    discipline: 'dominacao',
    minTier: 1,
    requiredNodeId: 'dom_1',
    name: 'Dominação Mental',
    shortName: 'Dominação',
    bloodCostLabel: '12 Sangue',
    bloodCostValue: 12,
    iconKey: 'mind',
    cooldownSec: 13.0,
    description: 'Paralisa um mortal à frente em transe hipnótico por 5s, zerando sua suspeita.',
  },
  {
    id: 'memoryWipe',
    discipline: 'dominacao',
    minTier: 2,
    requiredNodeId: 'dom_2a',
    name: 'Apagar Memória',
    shortName: 'Apagar Mem.',
    bloodCostLabel: '15 Sangue',
    bloodCostValue: 15,
    iconKey: 'wipe',
    cooldownSec: 14.0,
    description: 'Onda psíquica (12m) que acalma guardas e civis e reduz Infâmia local e Suspeita.',
  },
  {
    id: 'possess',
    discipline: 'dominacao',
    minTier: 2,
    requiredNodeId: 'dom_2b',
    name: 'Possessão',
    shortName: 'Possessão',
    bloodCostLabel: '18 Sangue',
    bloodCostValue: 18,
    iconKey: 'possess',
    cooldownSec: 15.0,
    description: 'Subjuga a vontade de um mortal (8s), conduzindo-o a becos escuros e distraindo rondas.',
  },
  {
    id: 'batSwarm',
    discipline: 'metamorfose',
    minTier: 2,
    requiredNodeId: 'met_2a',
    name: 'Enxame de Morcegos',
    shortName: 'Morcegos',
    bloodCostLabel: '16 Sangue',
    bloodCostValue: 16,
    iconKey: 'bats',
    cooldownSec: 12.0,
    description: 'Atordoa caçadores próximos (7.5m), drena sangue e permite planar no ar.',
  },
  {
    id: 'mistForm',
    discipline: 'metamorfose',
    minTier: 2,
    requiredNodeId: 'met_2b',
    name: 'Forma de Névoa',
    shortName: 'Forma Névoa',
    bloodCostLabel: '16 Sangue',
    bloodCostValue: 16,
    iconKey: 'mist',
    cooldownSec: 15.0,
    description: 'Dissolve-se em bruma fantasmagórica por 4.5s: imune a dano físico e indetectável.',
  },
  {
    id: 'celerity',
    discipline: 'rapidez',
    minTier: 1,
    requiredNodeId: 'rap_1',
    name: 'Celeridade',
    shortName: 'Celeridade',
    bloodCostLabel: '14 Sangue',
    bloodCostValue: 14,
    iconKey: 'bolt',
    cooldownSec: 14.0,
    description: 'Multiplica velocidade (+42%) e cadência das garras por 5s.',
  },
  {
    id: 'shadowLeap',
    discipline: 'rapidez',
    minTier: 2,
    requiredNodeId: 'rap_2a',
    name: 'Salto das Sombras',
    shortName: 'Salto Sombrio',
    bloodCostLabel: '11 Sangue',
    bloodCostValue: 11,
    iconKey: 'leap',
    cooldownSec: 5.5,
    description: 'Impulso acrobático vertical e frontal que alcança diretamente sacadas e telhados.',
  },
  {
    id: 'shadowThrow',
    discipline: 'rapidez',
    minTier: 2,
    requiredNodeId: 'rap_2b',
    name: 'Arremesso Sombrio',
    shortName: 'Arremesso',
    bloodCostLabel: '10 Sangue',
    bloodCostValue: 10,
    iconKey: 'blade',
    cooldownSec: 5.0,
    description: 'Dispara lâmina sombria (26m) que quebra urnas, apaga lampiões ou atordoa sentinelas.',
  },
  {
    id: 'shadowDecoy',
    discipline: 'ofuscacao',
    minTier: 3,
    requiredNodeId: 'ofu_3b',
    name: 'Simulacro Sombrio',
    shortName: 'Simulacro',
    bloodCostLabel: '12 Sangue',
    bloodCostValue: 12,
    iconKey: 'decoy',
    cooldownSec: 13.0,
    description: 'Conjura um duplo sombrio à frente por 7.5s que atrai guardas e civis para investigá-lo.',
  },
  {
    id: 'darknessPulse',
    discipline: 'tenebrosidade',
    minTier: 3,
    requiredNodeId: 'ten_3b',
    name: 'Pulso de Escuridão',
    shortName: 'Pulso Sombrio',
    bloodCostLabel: '16 Sangue',
    bloodCostValue: 16,
    iconKey: 'pulse',
    cooldownSec: 15.0,
    description: 'Onda sombria (13m) que apaga lampiões, ergue fumaça espessa e atordoa perseguidores para fuga em becos.',
  },
];

export function formatKeyCodeLabel(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  if (code === 'Space') return 'Espaço';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  return code;
}

export type SkillBranchSlot = '1' | '2A' | '2B' | '3' | '3B' | 'amalgam';

export interface SkillNodeDef {
  id: string;
  discipline: DisciplineId;
  secondaryDiscipline?: DisciplineId;
  slot: SkillBranchSlot;
  tierNum: 1 | 2 | 3;
  name: string;
  cost: number;
  bloodCost: string;
  powerType: 'Ativo' | 'Passivo' | 'Aprimoramento' | 'Amálgama';
  linkedPower?: ActivePowerId;
  /** Node unlocks if ANY of these prerequisite groups is satisfied (each inner array is AND; outer array is OR) */
  prereqGroups: string[][];
  summary: string;
  iconKey: string;
}

export interface DisciplineTierNode {
  tier: 1 | 2 | 3;
  name: string;
  cost: number;
  bloodCost: string;
  powerType: 'Ativo' | 'Passivo' | 'Aprimoramento';
  linkedPower?: ActivePowerId;
  summary: string;
}

export interface DisciplineDefinition {
  id: DisciplineId;
  name: string;
  subtitle: string;
  accent: string;
  tiers: [DisciplineTierNode, DisciplineTierNode, DisciplineTierNode];
}

export type DisciplineLevels = Record<DisciplineId, number>;

export const DISCIPLINE_DEFINITIONS: DisciplineDefinition[] = [
  {
    id: 'tenebrosidade',
    name: 'Tenebrosidade',
    subtitle: 'Domínio das sombras vivas e extinção de luz',
    accent: '#818cf8',
    tiers: [
      {
        tier: 1,
        name: 'Passo das Sombras',
        cost: 0,
        bloodCost: '10 Sangue',
        powerType: 'Ativo',
        linkedPower: 'shadowDash',
        summary: 'Avanço instantâneo em névoa escura para cruzar ruas iluminadas e vãos entre telhados.',
      },
      {
        tier: 2,
        name: 'Extinção / Laço Sombrio',
        cost: 30,
        bloodCost: '8–12 Sangue',
        powerType: 'Ativo',
        linkedPower: 'snuffLamp',
        summary: 'Bifurca entre apagar lampiões à distância ou imobilizar sentinelas com tentáculos sombrios.',
      },
      {
        tier: 3,
        name: 'Mortalha Abissal',
        cost: 75,
        bloodCost: '18 Sangue',
        powerType: 'Ativo',
        linkedPower: 'abyssalShroud',
        summary: 'Invoca manto abissal que zera exposição à luz, apaga lampiões ao redor e fortalece Passo Sombrio.',
      },
    ],
  },
  {
    id: 'ofuscacao',
    name: 'Ofuscação',
    subtitle: 'Ilusão espectral, disfarce e silêncio',
    accent: '#38bdf8',
    tiers: [
      {
        tier: 1,
        name: 'Manto da Névoa',
        cost: 25,
        bloodCost: 'Passivo',
        powerType: 'Passivo',
        summary: 'Reduz exposição à luz em 32% e abafa os passos ao caminhar em furtividade.',
      },
      {
        tier: 2,
        name: 'Ofuscação / Falso Semblante',
        cost: 55,
        bloodCost: '14 Sangue',
        powerType: 'Ativo',
        linkedPower: 'obfuscate',
        summary: 'Bifurca entre invisibilidade espectral pura ou disfarce social diante de sentinelas.',
      },
      {
        tier: 3,
        name: 'Sumir da Mente',
        cost: 105,
        bloodCost: 'Passivo',
        powerType: 'Aprimoramento',
        summary: 'Silêncio absoluto em quedas, -60% exposição passiva e +25% Essência em abates ocultos.',
      },
    ],
  },
  {
    id: 'auspicios',
    name: 'Auspícios',
    subtitle: 'Percepção sanguínea e projeção astral',
    accent: '#ef4444',
    tiers: [
      {
        tier: 1,
        name: 'Sentido Carmesim',
        cost: 0,
        bloodCost: '1.8 Sangue/s',
        powerType: 'Ativo',
        linkedPower: 'crimsonSense',
        summary: 'Revela o pulsar vermelho de presas através de paredes e cones de visão dos sentinelas no chão.',
      },
      {
        tier: 2,
        name: 'Visão da Aura / Sonda Astral',
        cost: 35,
        bloodCost: 'Passivo / 10+1.4/s',
        powerType: 'Ativo',
        linkedPower: 'astralScout',
        summary: 'Bifurca entre reduzir consumo do Sentido Carmesim ou projetar sua forma astral pelos telhados.',
      },
      {
        tier: 3,
        name: 'Telepatia Sanguínea',
        cost: 85,
        bloodCost: 'Passivo',
        powerType: 'Aprimoramento',
        summary: 'Dobra a velocidade de drenagem letal com Sentido Carmesim ativo e revela rotas.',
      },
    ],
  },
  {
    id: 'dominacao',
    name: 'Dominação',
    subtitle: 'Subjugação mental, amnésia e possessão',
    accent: '#c084fc',
    tiers: [
      {
        tier: 1,
        name: 'Comando Hipnótico',
        cost: 30,
        bloodCost: '12 Sangue',
        powerType: 'Ativo',
        linkedPower: 'dominate',
        summary: 'Paralisa um mortal à frente (11m) em transe hipnótico por 5s, zerando sua suspeita imediata.',
      },
      {
        tier: 2,
        name: 'Apagar Memória / Possessão',
        cost: 60,
        bloodCost: '15–18 Sangue',
        powerType: 'Ativo',
        linkedPower: 'memoryWipe',
        summary: 'Bifurca entre apagar suspeitas e Infâmia em área ou possuir um mortal para atrair vigias.',
      },
      {
        tier: 3,
        name: 'Soberania Mental',
        cost: 110,
        bloodCost: 'Passivo',
        powerType: 'Aprimoramento',
        summary: 'Dominação atinge 2 alvos adjacentes, com alcance de 18m e custo reduzido em 25%.',
      },
    ],
  },
  {
    id: 'metamorfose',
    name: 'Metamorfose',
    subtitle: 'Garras bestiais, enxame e forma de névoa',
    accent: '#f59e0b',
    tiers: [
      {
        tier: 1,
        name: 'Presas & Garras Fatais',
        cost: 30,
        bloodCost: 'Passivo',
        powerType: 'Passivo',
        summary: 'Amplia dano das garras (+9), alcance do bote furtivo (+1.4m), cura extra e +25% Essência ao drenar.',
      },
      {
        tier: 2,
        name: 'Enxame / Forma de Névoa',
        cost: 65,
        bloodCost: '16 Sangue',
        powerType: 'Ativo',
        linkedPower: 'batSwarm',
        summary: 'Bifurca entre enxame atordoante com planeio ou dissolução imune em Forma de Névoa.',
      },
      {
        tier: 3,
        name: 'Fúria das Trevas',
        cost: 115,
        bloodCost: 'Passivo',
        powerType: 'Aprimoramento',
        summary: 'Enxame dura 5.5s, apaga lampiões próximos e libera execução letal mesmo em guardas cautelosos.',
      },
    ],
  },
  {
    id: 'rapidez',
    name: 'Rapidez',
    subtitle: 'Velocidade sobrenatural, saltos e projéteis',
    accent: '#fb7185',
    tiers: [
      {
        tier: 1,
        name: 'Celeridade',
        cost: 35,
        bloodCost: '14 Sangue',
        powerType: 'Ativo',
        linkedPower: 'celerity',
        summary: 'Multiplica velocidade (+42%) e cadência de ataque das garras por 5.0s.',
      },
      {
        tier: 2,
        name: 'Salto / Arremesso Sombrio',
        cost: 65,
        bloodCost: '10–11 Sangue',
        powerType: 'Ativo',
        linkedPower: 'shadowLeap',
        summary: 'Bifurca entre salto acrobático direto aos telhados ou lâmina de sombra à distância.',
      },
      {
        tier: 3,
        name: 'Velocidade Suprema',
        cost: 115,
        bloodCost: 'Passivo',
        powerType: 'Aprimoramento',
        summary: 'Celeridade dura 8s (+55% velocidade), +25% altura de salto e +20% dano letal nas garras.',
      },
    ],
  },
];

export const SKILL_TREE_NODES: SkillNodeDef[] = [
  // 1. Tenebrosidade
  {
    id: 'ten_1',
    discipline: 'tenebrosidade',
    slot: '1',
    tierNum: 1,
    name: 'Passo das Sombras',
    cost: 0,
    bloodCost: '10 Sangue',
    powerType: 'Ativo',
    linkedPower: 'shadowDash',
    prereqGroups: [[]],
    summary: 'Avanço instantâneo em névoa escura para cruzar ruas iluminadas e vãos entre telhados.',
    iconKey: 'dash',
  },
  {
    id: 'ten_2a',
    discipline: 'tenebrosidade',
    slot: '2A',
    tierNum: 2,
    name: 'Extinção Noturna',
    cost: 30,
    bloodCost: '8 Sangue',
    powerType: 'Ativo',
    linkedPower: 'snuffLamp',
    prereqGroups: [['ten_1']],
    summary: 'Apaga lampiões a gás à distância (14m). Sentinelas próximos irão investigar a escuridão.',
    iconKey: 'lamp',
  },
  {
    id: 'ten_2b',
    discipline: 'tenebrosidade',
    slot: '2B',
    tierNum: 2,
    name: 'Laço das Sombras',
    cost: 35,
    bloodCost: '12 Sangue',
    powerType: 'Ativo',
    linkedPower: 'shadowSnare',
    prereqGroups: [['ten_1']],
    summary: 'Gavinhas abissais prendem um alvo no campo visual por 4.5s e zeram sua suspeita.',
    iconKey: 'snare',
  },
  {
    id: 'ten_3',
    discipline: 'tenebrosidade',
    slot: '3',
    tierNum: 3,
    name: 'Mortalha Abissal',
    cost: 75,
    bloodCost: '18 Sangue',
    powerType: 'Ativo',
    linkedPower: 'abyssalShroud',
    prereqGroups: [['ten_2a'], ['ten_2b']],
    summary: 'Trevas densas por 6.5s: zera exposição à luz, apaga lampiões a 9m e fortalece Passo Sombrio.',
    iconKey: 'shroud',
  },
  {
    id: 'ten_3b',
    discipline: 'tenebrosidade',
    slot: '3B',
    tierNum: 3,
    name: 'Pulso de Escuridão',
    cost: 80,
    bloodCost: '16 Sangue',
    powerType: 'Ativo',
    linkedPower: 'darknessPulse',
    prereqGroups: [['ten_2a'], ['ten_2b']],
    summary: 'Onda abissal (13m) para escapar em becos: apaga lampiões, atordoa perseguidores e cria véu sombrio.',
    iconKey: 'pulse',
  },

  // 2. Ofuscação
  {
    id: 'ofu_1',
    discipline: 'ofuscacao',
    slot: '1',
    tierNum: 1,
    name: 'Manto da Névoa',
    cost: 25,
    bloodCost: 'Passivo',
    powerType: 'Passivo',
    prereqGroups: [[]],
    summary: 'Reduz exposição à luz em 32% e abafa os passos ao caminhar em furtividade.',
    iconKey: 'cloak',
  },
  {
    id: 'ofu_2a',
    discipline: 'ofuscacao',
    slot: '2A',
    tierNum: 2,
    name: 'Rosto Despercebido',
    cost: 55,
    bloodCost: '14 Sangue',
    powerType: 'Ativo',
    linkedPower: 'obfuscate',
    prereqGroups: [['ofu_1']],
    summary: 'Translucidez espectral azulada por 8s, invisível aos mortais mesmo sob lampiões.',
    iconKey: 'ghost',
  },
  {
    id: 'ofu_2b',
    discipline: 'ofuscacao',
    slot: '2B',
    tierNum: 2,
    name: 'Falso Semblante',
    cost: 55,
    bloodCost: '14 Sangue',
    powerType: 'Ativo',
    linkedPower: 'falseVisage',
    prereqGroups: [['ofu_1']],
    summary: 'Glamour mortal por 10s: passe livre diante de guardas e civis sem levantar suspeita.',
    iconKey: 'mask',
  },
  {
    id: 'ofu_3',
    discipline: 'ofuscacao',
    slot: '3',
    tierNum: 3,
    name: 'Sumir da Mente',
    cost: 105,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['ofu_2a'], ['ofu_2b']],
    summary: 'Ofuscação ganha silêncio absoluto, -60% exposição passiva e +25% Essência em abates ocultos.',
    iconKey: 'fade',
  },
  {
    id: 'ofu_3b',
    discipline: 'ofuscacao',
    slot: '3B',
    tierNum: 3,
    name: 'Simulacro Sombrio',
    cost: 95,
    bloodCost: '12 Sangue',
    powerType: 'Ativo',
    linkedPower: 'shadowDecoy',
    prereqGroups: [['ofu_2a'], ['ofu_2b']],
    summary: 'Projeta um duplo ilusório por 7.5s que desvia olhares e atrai patrulhas para longe da sua rota.',
    iconKey: 'decoy',
  },

  // 3. Auspícios
  {
    id: 'aus_1',
    discipline: 'auspicios',
    slot: '1',
    tierNum: 1,
    name: 'Sentido Carmesim',
    cost: 0,
    bloodCost: '1.8 Sangue/s',
    powerType: 'Ativo',
    linkedPower: 'crimsonSense',
    prereqGroups: [[]],
    summary: 'Revela o pulsar vermelho de presas através de paredes e cones de visão dos sentinelas.',
    iconKey: 'eye',
  },
  {
    id: 'aus_2a',
    discipline: 'auspicios',
    slot: '2A',
    tierNum: 2,
    name: 'Visão da Aura',
    cost: 35,
    bloodCost: '1.1 Sangue/s',
    powerType: 'Aprimoramento',
    prereqGroups: [['aus_1']],
    summary: 'Reduz consumo de Sentido Carmesim para 1.1/s e amplia leitura de fraquezas para 52m.',
    iconKey: 'aura',
  },
  {
    id: 'aus_2b',
    discipline: 'auspicios',
    slot: '2B',
    tierNum: 2,
    name: 'Projeção Astral',
    cost: 45,
    bloodCost: '10 + 1.4/s',
    powerType: 'Ativo',
    linkedPower: 'astralScout',
    prereqGroups: [['aus_1']],
    summary: 'Projeta a câmera espectral pelo distrito (45m) para estudar patrulhas e alvos seguros.',
    iconKey: 'astral',
  },
  {
    id: 'aus_3',
    discipline: 'auspicios',
    slot: '3',
    tierNum: 3,
    name: 'Telepatia Sanguínea',
    cost: 85,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['aus_2a'], ['aus_2b']],
    summary: 'Dobra a velocidade de drenagem com Sentido Carmesim ativo e revela fraquezas rapidamente.',
    iconKey: 'telepathy',
  },

  // 4. Dominação
  {
    id: 'dom_1',
    discipline: 'dominacao',
    slot: '1',
    tierNum: 1,
    name: 'Comando Hipnótico',
    cost: 30,
    bloodCost: '12 Sangue',
    powerType: 'Ativo',
    linkedPower: 'dominate',
    prereqGroups: [[]],
    summary: 'Paralisa um mortal à frente (11m) em transe hipnótico por 5s, zerando sua suspeita.',
    iconKey: 'mind',
  },
  {
    id: 'dom_2a',
    discipline: 'dominacao',
    slot: '2A',
    tierNum: 2,
    name: 'Apagar Memória',
    cost: 60,
    bloodCost: '15 Sangue',
    powerType: 'Ativo',
    linkedPower: 'memoryWipe',
    prereqGroups: [['dom_1']],
    summary: 'Limpa alerta/suspeita em 12m ao redor e reduz Infâmia local (-12%) e Suspeita (-8%).',
    iconKey: 'wipe',
  },
  {
    id: 'dom_2b',
    discipline: 'dominacao',
    slot: '2B',
    tierNum: 2,
    name: 'Possessão',
    cost: 65,
    bloodCost: '18 Sangue',
    powerType: 'Ativo',
    linkedPower: 'possess',
    prereqGroups: [['dom_1']],
    summary: 'Controla um mortal por 8s, atraindo-o para becos escuros e distraindo guardas próximos.',
    iconKey: 'possess',
  },
  {
    id: 'dom_3',
    discipline: 'dominacao',
    slot: '3',
    tierNum: 3,
    name: 'Soberania Mental',
    cost: 110,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['dom_2a'], ['dom_2b']],
    summary: 'Dominação alcança 18m, subjuga 2 alvos adjacentes e reduz recarga e custo em 25%.',
    iconKey: 'crown',
  },

  // 5. Metamorfose
  {
    id: 'met_1',
    discipline: 'metamorfose',
    slot: '1',
    tierNum: 1,
    name: 'Presas & Garras Fatais',
    cost: 30,
    bloodCost: 'Passivo',
    powerType: 'Passivo',
    prereqGroups: [[]],
    summary: '+9 dano nas garras, +1.4m alcance de bote, cura extra e +25% Essência ao drenar.',
    iconKey: 'claw',
  },
  {
    id: 'met_2a',
    discipline: 'metamorfose',
    slot: '2A',
    tierNum: 2,
    name: 'Enxame de Morcegos',
    cost: 65,
    bloodCost: '16 Sangue',
    powerType: 'Ativo',
    linkedPower: 'batSwarm',
    prereqGroups: [['met_1']],
    summary: 'Metamorfose em enxame que atordoa caçadores próximos (7.5m), drena sangue e permite planar.',
    iconKey: 'bats',
  },
  {
    id: 'met_2b',
    discipline: 'metamorfose',
    slot: '2B',
    tierNum: 2,
    name: 'Forma de Névoa',
    cost: 70,
    bloodCost: '16 Sangue',
    powerType: 'Ativo',
    linkedPower: 'mistForm',
    prereqGroups: [['met_1']],
    summary: 'Dissolve-se em vapor espectral por 4.5s: imune a dano físico e invisível em movimento.',
    iconKey: 'mist',
  },
  {
    id: 'met_3',
    discipline: 'metamorfose',
    slot: '3',
    tierNum: 3,
    name: 'Fúria das Trevas',
    cost: 115,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['met_2a'], ['met_2b']],
    summary: 'Enxame dura 5.5s, apaga lampiões próximos e libera execução letal mesmo em guardas cautelosos.',
    iconKey: 'fury',
  },

  // 6. Rapidez
  {
    id: 'rap_1',
    discipline: 'rapidez',
    slot: '1',
    tierNum: 1,
    name: 'Celeridade',
    cost: 35,
    bloodCost: '14 Sangue',
    powerType: 'Ativo',
    linkedPower: 'celerity',
    prereqGroups: [[]],
    summary: 'Multiplica velocidade (+42%) e cadência de ataque das garras por 5.0s.',
    iconKey: 'bolt',
  },
  {
    id: 'rap_2a',
    discipline: 'rapidez',
    slot: '2A',
    tierNum: 2,
    name: 'Salto das Sombras',
    cost: 65,
    bloodCost: '11 Sangue',
    powerType: 'Ativo',
    linkedPower: 'shadowLeap',
    prereqGroups: [['rap_1']],
    summary: 'Impulso vertical e frontal para saltar diretamente aos telhados e sacadas vitorianas.',
    iconKey: 'leap',
  },
  {
    id: 'rap_2b',
    discipline: 'rapidez',
    slot: '2B',
    tierNum: 2,
    name: 'Arremesso Sombrio',
    cost: 65,
    bloodCost: '10 Sangue',
    powerType: 'Ativo',
    linkedPower: 'shadowThrow',
    prereqGroups: [['rap_1']],
    summary: 'Lança dardo de sombra (26m) que estilhaça urnas, apaga lampiões ou atordoa guardas.',
    iconKey: 'blade',
  },
  {
    id: 'rap_3',
    discipline: 'rapidez',
    slot: '3',
    tierNum: 3,
    name: 'Velocidade Suprema',
    cost: 115,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['rap_2a'], ['rap_2b']],
    summary: 'Celeridade dura 8s (+55% velocidade), +25% impulsão de salto e +20% dano nas garras.',
    iconKey: 'apex',
  },
  {
    id: 'rap_3b',
    discipline: 'rapidez',
    slot: '3B',
    tierNum: 3,
    name: 'Bote das Cornijas',
    cost: 105,
    bloodCost: 'Passivo',
    powerType: 'Aprimoramento',
    prereqGroups: [['rap_2a'], ['rap_2b']],
    summary: 'Ataque/drenagem furtiva das alturas (até 11.5m): alcance ampliado, queda silenciosa, +20 Essência e +14 Sangue.',
    iconKey: 'plunge',
  },
];

export const AMALGAM_NODES: SkillNodeDef[] = [
  {
    id: 'amal_eclipse',
    discipline: 'tenebrosidade',
    secondaryDiscipline: 'ofuscacao',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Eclipse Vivo',
    cost: 70,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['ten_2a', 'ofu_2a'],
      ['ten_2a', 'ofu_2b'],
      ['ten_2b', 'ofu_2a'],
      ['ten_2b', 'ofu_2b'],
    ],
    summary: 'Tenebrosidade + Ofuscação: Passo, Laço e Mortalha não geram testemunhas e Ofuscação dura +2.5s.',
    iconKey: 'amalgam',
  },
  {
    id: 'amal_masquerade',
    discipline: 'ofuscacao',
    secondaryDiscipline: 'dominacao',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Sussurro da Máscara',
    cost: 75,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['ofu_2a', 'dom_2a'],
      ['ofu_2a', 'dom_2b'],
      ['ofu_2b', 'dom_2a'],
      ['ofu_2b', 'dom_2b'],
    ],
    summary: 'Ofuscação + Dominação: Apagar Memória remove +10% extra de Infâmia e Falso Semblante dura +3s.',
    iconKey: 'amalgam',
  },
  {
    id: 'amal_oracle',
    discipline: 'auspicios',
    secondaryDiscipline: 'dominacao',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Olhar do Soberano',
    cost: 75,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['aus_2a', 'dom_2a'],
      ['aus_2a', 'dom_2b'],
      ['aus_2b', 'dom_2a'],
      ['aus_2b', 'dom_2b'],
    ],
    summary: 'Auspícios + Dominação: Reduz custo de poderes mentais em 4 Sangue e amplia seu alcance em +4m.',
    iconKey: 'amalgam',
  },
  {
    id: 'amal_nightmare',
    discipline: 'metamorfose',
    secondaryDiscipline: 'rapidez',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Pesadelo Alado',
    cost: 80,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['met_2a', 'rap_2a'],
      ['met_2a', 'rap_2b'],
      ['met_2b', 'rap_2a'],
      ['met_2b', 'rap_2b'],
    ],
    summary: 'Metamorfose + Rapidez: Botes Aéreos curam +18 PV e +15 Essência extra; Salto Sombrio recarrega 35% mais rápido.',
    iconKey: 'amalgam',
  },
  {
    id: 'amal_umbra_blade',
    discipline: 'tenebrosidade',
    secondaryDiscipline: 'rapidez',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Lâmina do Crepúsculo',
    cost: 75,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['ten_2a', 'rap_2a'],
      ['ten_2a', 'rap_2b'],
      ['ten_2b', 'rap_2a'],
      ['ten_2b', 'rap_2b'],
    ],
    summary: 'Tenebrosidade + Rapidez: Arremesso Sombrio aplica Laço das Sombras (2.5s) e reduz recarga de Passo Sombrio.',
    iconKey: 'amalgam',
  },
  {
    id: 'amal_nocturnal_stalker',
    discipline: 'ofuscacao',
    secondaryDiscipline: 'auspicios',
    slot: 'amalgam',
    tierNum: 2,
    name: 'Caçador das Cornijas',
    cost: 75,
    bloodCost: 'Amálgama',
    powerType: 'Amálgama',
    prereqGroups: [
      ['ofu_2a', 'aus_2a'],
      ['ofu_2a', 'aus_2b'],
      ['ofu_2b', 'aus_2a'],
      ['ofu_2b', 'aus_2b'],
    ],
    summary: 'Ofuscação + Auspícios: Bote das Cornijas oculta o corpo nas sombras após drenar e amplia o alcance vertical em +1.5m.',
    iconKey: 'amalgam',
  },
];

export const ALL_SKILL_NODES: SkillNodeDef[] = [...SKILL_TREE_NODES, ...AMALGAM_NODES];

export const INITIAL_UNLOCKED_SKILLS: string[] = ['ten_1', 'aus_1'];

export function isSkillNodeAvailable(node: SkillNodeDef, unlocked: Set<string>): boolean {
  if (unlocked.has(node.id)) return false;
  return node.prereqGroups.some((group) => group.every((reqId) => unlocked.has(reqId)));
}

export type NpcArchetype = 'citizen' | 'beggar' | 'cultist' | 'noble' | 'guard' | 'bodyguard' | 'hunter';
export type NpcStatusTier =
  | 'mendigo'
  | 'plebeu'
  | 'cultista'
  | 'vigilia'
  | 'elite'
  | 'escolta'
  | 'cacador'
  | 'nobre'
  | 'patriarca';
export type NpcAlertState =
  | 'patrol'
  | 'resting'
  | 'curious'
  | 'suspicious'
  | 'alert'
  | 'hunt'
  | 'flee'
  | 'stunned'
  | 'possessed'
  | 'drained';

export type DistrictId = 'cathedral' | 'alleys' | 'avenue' | 'cemetery';

export interface DistrictMeta {
  id: DistrictId;
  name: string;
  bodyguardThreshold: number;
  decayMult: number;
  reactionNote: string;
}

export const DISTRICT_META: Record<DistrictId, DistrictMeta> = {
  cathedral: {
    id: 'cathedral',
    name: 'Adro da Catedral Norte',
    bodyguardThreshold: 40,
    decayMult: 0.9,
    reactionNote: 'Praça sagrada de pedra gótica; cultistas e sentinelas intensificam rondas acima de 40% de Infâmia.',
  },
  alleys: {
    id: 'alleys',
    name: 'Becos e Vielas Estreitas',
    bodyguardThreshold: 55,
    decayMult: 1.25,
    reactionNote: 'Passagens estreitas com vapor de bueiros e escaladas para telhados; Infâmia dissipa mais depressa.',
  },
  avenue: {
    id: 'avenue',
    name: 'Avenida Vitoriana',
    bodyguardThreshold: 45,
    decayMult: 0.85,
    reactionNote: 'Boulevard amplo com carruagens e vitrines; Caçadores de Vampiros patrulham quando a Infâmia sobe.',
  },
  cemetery: {
    id: 'cemetery',
    name: 'Cemitério e Mansão',
    bodyguardThreshold: 35,
    decayMult: 0.95,
    reactionNote: 'Mausoléus, cripta segura e jardins aristocráticos; nobres isolados contratam escoltas aos 35% de Infâmia.',
  },
};

export interface HuntLogEntry {
  name: string;
  archetype: NpcArchetype;
  title: string;
  districtName: string;
  nightNumber: number;
  method: string;
  essenceEarned: number;
  isMainTarget?: boolean;
  history: string;
  uniqueBehavior: string;
}

export interface ImportantNpcLore {
  name: string;
  archetype: NpcArchetype;
  title: string;
  districtHint: string;
  history: string;
  uniqueBehavior: string;
}

export const IMPORTANT_NPC_LORE: ImportantNpcLore[] = [
  {
    name: 'Lorde Valerius',
    archetype: 'noble',
    title: 'Patriarca do Conselho',
    districtHint: 'Jardins da Mansão & Avenida Vitoriana',
    history:
      'Financiador da Ordem da Vigília em Ravencroft e antigo aliado de sua família mortal. Assinou o decreto que selou as criptas.',
    uniqueBehavior:
      'Desfila pelos jardins da Mansão e Avenida Vitoriana perto de lampiões, contrata Guarda-Costas sob alta Infâmia e corre ao Sino.',
  },
  {
    name: 'Condessa Eleanor',
    archetype: 'noble',
    title: 'Mecenas da Catedral',
    districtHint: 'Adro da Catedral Norte',
    history:
      'Viúva reclusa que doa ouro à Catedral Norte em troca de indulgências noturnas, fascinada pelos rumores de um predador nos telhados.',
    uniqueBehavior:
      'Atraída facilmente por ruídos em vielas escuras; move-se depressa sob chuva leve e alerta sentinelas se exposta.',
  },
  {
    name: 'Barão Thorne',
    archetype: 'noble',
    title: 'Senhor da Mansão Leste',
    districtHint: 'Cemitério e Mansão',
    history:
      'Nobre pragmático que transformou os jardins do Cemitério e Mansão em fortaleza privada contra a peste rubra.',
    uniqueBehavior:
      'Mantém atenção rígida ao nível do jardim, ignorando sacadas e telhados acima; vulnerável a Botes Aéreos e Morcegos.',
  },
  {
    name: 'Magistrado Vance',
    archetype: 'noble',
    title: 'Juiz da Vigília Noturna',
    districtHint: 'Avenida Vitoriana',
    history:
      'Autor das sentenças sumárias contra suspeitos de vampirismo; circula entre a Avenida Vitoriana e os salões aristocráticos.',
    uniqueBehavior:
      'Detecta vultos mesmo sob exposição moderada em noites claras, mas perde quase toda a eficácia visual sob Neblina Densa.',
  },
  {
    name: 'Caçador de Vampiros',
    archetype: 'hunter',
    title: 'Matador da Ordem Escarlate',
    districtHint: 'Avenida Vitoriana',
    history:
      'Especialista armado com estacas de prata e besta de repetição, convocado às ruas principais da Avenida Vitoriana conforme a Infâmia cresce.',
    uniqueBehavior:
      'Visão aguçada a longa distância e perseguição implacável em dupla; cede alta Essência quando emboscado pelas sombras ou telhados.',
  },
  {
    name: 'Guarda-Costas Juramentado',
    archetype: 'bodyguard',
    title: 'Escolta Pessoal da Aristocracia',
    districtHint: 'Junto aos Nobres (Alta Infâmia)',
    history:
      'Mercenário blindado contratado pelas casas nobres sempre que a Infâmia de um distrito dispara após caçadas repetidas.',
    uniqueBehavior:
      'Escolta nobres em formação cerrada, nunca descansa em lampiões e entra em Caça Total instantânea contra invasores.',
  },
  {
    name: 'Inquisidor de Prata',
    archetype: 'guard',
    title: 'Rastreador da Ordem',
    districtHint: 'Becos e Vielas Estreitas',
    history:
      'Veterano das caçadas de inverno, treinado para seguir rastros acústicos pelos becos e executar vampiros feridos com lâminas benzidas.',
    uniqueBehavior:
      'Investiga imediatamente estilhaços e passos audíveis; sua percepção sonora é drasticamente abafada pela chuva.',
  },
  {
    name: 'Alabardeiro',
    archetype: 'guard',
    title: 'Guarda Pesado da Avenida',
    districtHint: 'Avenida Vitoriana & Jardins',
    history:
      'Membro da guarda blindada que reforça a Avenida Vitoriana sempre que a cidade entra em estado de Inquietação ou Lei Marcial.',
    uniqueBehavior:
      'Alta vitalidade e golpes cadenciados que aceleram conforme a Suspeita Global cresce; paralisa facilmente com Morcegos.',
  },
  {
    name: 'Sentinela Sacra',
    archetype: 'guard',
    title: 'Guardiã das Passarelas e Sinos',
    districtHint: 'Adro da Catedral Norte',
    history:
      'Designada para vigiar pontes e arcos da Catedral Norte após o Grande Incêndio, conectando a rede de sinos de bronze.',
    uniqueBehavior:
      'Patrulha estruturas elevadas e prioriza correr até o Sino de Alarme mais próximo ao avistar o vampiro.',
  },
  {
    name: 'Caçador da Vigília',
    archetype: 'guard',
    title: 'Patrulheiro de Lanterna',
    districtHint: 'Avenida Vitoriana & Cruzamentos',
    history:
      'Soldado raso da milícia noturna que faz turnos entre os lampiões a gás e repousa brevemente junto às chamas.',
    uniqueBehavior:
      'Alterna turnos de ronda e pausas junto a lampiões acesos, reagindo em estágios de curiosidade, alerta e caça total.',
  },
  {
    name: 'Acólito do Eclipse',
    archetype: 'cultist',
    title: 'Ocultista das Sombras Sagradas',
    districtHint: 'Adro da Catedral Norte & Mausoléus',
    history:
      'Membro de uma seita clandestina que venera a lua sangrenta de Ravencroft, rondando o Adro da Catedral Norte e mausoléus com lanterna ritual.',
    uniqueBehavior:
      'Carrega lanterna própria e entoa cânticos de alerta ao testemunhar poderes; drená-lo concede regeneração temporária de Sangue e recarga acelerada.',
  },
  {
    name: 'Boticário',
    archetype: 'cultist',
    title: 'Alquimista das Vielas',
    districtHint: 'Becos, Catedral & Cemitério',
    history:
      'Preparador de elixires lunares e óleos fosforescentes para a Ordem; percorre os becos com sua lanterna esmeralda carregando reagentes arcanos.',
    uniqueBehavior:
      'Ilumina vielas escuras com sua lanterna portátil, mas seu sangue alquímico ativa um bônus intenso de regeneração de poder ao ser drenado.',
  },
];

export interface MemoryFragment {
  id: string;
  numberLabel: string;
  title: string;
  category: 'cidade' | 'protagonista';
  locationHint: string;
  body: string;
}

export const MEMORY_FRAGMENTS: MemoryFragment[] = [
  {
    id: 'mem-1',
    numberLabel: 'I',
    title: 'O Pacto da Névoa Eterna',
    category: 'cidade',
    locationHint: 'Cemitério — Próximo à Cripta Segura',
    body: 'Em 1794, o Conselho de Ravencroft selou o sino da Catedral com cinzas de mártires para conter a peste rubra. Desde aquela noite, a lua nunca mais abandonou os pináculos — e os mortos dos mausoléus aprenderam a escutar os passos dos vivos.',
  },
  {
    id: 'mem-2',
    numberLabel: 'II',
    title: 'Diário de Sangue — Folha Rasgada',
    category: 'protagonista',
    locationHint: 'Avenida Vitoriana — Praça da Fonte',
    body: 'Eu costumava carregar a lanterna de prata pelas mesmas pedras onde hoje me arrasto nas sombras. Quando a Ordem me deixou sangrando sob a fonte, não foi a morte que respondeu às minhas preces — foi uma fome mais antiga que a própria cidade.',
  },
  {
    id: 'mem-3',
    numberLabel: 'III',
    title: 'Decreto da Vigília de Prata',
    category: 'cidade',
    locationHint: 'Adro da Catedral Norte — Ponte Suspensa',
    body: 'A todos os sentinelas: mantenham os lampiões acesos e os sinos de alerta desimpedidos. A criatura prefere os telhados e não suporta o toque do bronze sagrado. Caso encontrem corpos sem uma gota de sangue, convoquem os Caçadores Escarlates.',
  },
  {
    id: 'mem-4',
    numberLabel: 'IV',
    title: 'A Última Valsa na Mansão Thorne',
    category: 'protagonista',
    locationHint: 'Cemitério e Mansão — Terraço dos Jardins',
    body: 'Reconheço o brasão nos estandartes rasgados pelo vento. Antes da maldição, dancei nestes salões usando um manto carmesim — hoje observo por trás das sebes e beirais enquanto meus antigos pares brindam à minha inexistência.',
  },
  {
    id: 'mem-5',
    numberLabel: 'V',
    title: 'Crônica dos Telhados Negros',
    category: 'cidade',
    locationHint: 'Becos e Vielas Estreitas — Passarela Superior',
    body: 'Os arquitetos de Ravencroft ergueram passarelas entre os cortiços após o Grande Incêndio de 1812, temendo que a fumaça dos bueiros sufocasse as vielas. Mal sabiam que criavam estradas invisíveis para predadores acima da linha dos lampiões.',
  },
  {
    id: 'mem-6',
    numberLabel: 'VI',
    title: 'Confissão do Boticário',
    category: 'cidade',
    locationHint: 'Becos e Vielas Estreitas — Bueiro Sul',
    body: 'As urnas de barro junto aos bueiros escondiam ervas lunares e óleos para as lâmpadas a gás. Desde que os primeiros desaparecimentos começaram, o vapor que sobe do subsolo traz um odor metálico impossível de disfarçar.',
  },
  {
    id: 'mem-7',
    numberLabel: 'VII',
    title: 'Juramento Quebrado na Catedral',
    category: 'protagonista',
    locationHint: 'Adro da Catedral Norte — Balcão do Vitral',
    body: 'Aqui fiz meu último voto humano diante do vitral flamejante. Minhas garras servem apenas para abrir caminho na escuridão — é no silêncio do abraço e na drenagem do sangue vivo que minha verdadeira linhagem desperta.',
  },
  {
    id: 'mem-8',
    numberLabel: 'VIII',
    title: 'Eco das Carruagens Noturnas',
    category: 'protagonista',
    locationHint: 'Avenida Vitoriana — Carruagem do Portão Sul',
    body: 'As rodas calaram quando o toque de recolher foi decretado nas vitrines da avenida. Se a alvorada vier antes que eu domine estes quatro setores, serei apenas poeira levada pelo vento entre os postes de ferro.',
  },
];

export interface ContextPrompt {
  type: 'feed' | 'snuff' | 'sabotageBell' | 'hideCorpse' | 'memory' | 'restCoffin';
  label: string;
  keyHint: string;
  isStealthKill?: boolean;
  isAerialKill?: boolean;
  targetName?: string;
}

export type SuspicionTier = 'Silencioso' | 'Inquietação' | 'Caça Ativa' | 'Lei Marcial';

export type WeatherType = 'clear' | 'fog' | 'rain';

export const WEATHER_META: Record<
  WeatherType,
  { label: string; effectLabel: string; banner: string }
> = {
  clear: {
    label: 'Noite Clara',
    effectLabel: 'Visibilidade Padrão',
    banner: 'Céu limpo sob o luar — Visibilidade e alcance sonoro padrão.',
  },
  fog: {
    label: 'Neblina Densa',
    effectLabel: 'Visão Guarda -38%',
    banner: 'Neblina Densa descendo sobre Ravencroft — Raio de visão dos guardas reduzido!',
  },
  rain: {
    label: 'Chuva Leve',
    effectLabel: 'Som Passos -58%',
    banner: 'Chuva Leve sobre as pedras — Som dos seus passos abafado pela chuva!',
  },
};

export interface NpcWeakness {
  id: string;
  label: string;
  description: string;
  discoveryHint: string;
}

export interface NpcDossierProfile {
  name: string;
  archetype: 'noble' | 'guard' | 'cultist';
  title: string;
  district: string;
  yieldLabel: string;
  behavior: string;
  weaknesses: NpcWeakness[];
}

export const NPC_DOSSIER_PROFILES: NpcDossierProfile[] = [
  {
    name: 'Lorde Valerius',
    archetype: 'noble',
    title: 'Patriarca do Conselho',
    district: 'Mansão & Avenida Vitoriana',
    yieldLabel: '+60 Sangue · +78 Essência · +3 Domínio',
    behavior:
      'Desfila pelos jardins e vias principais próximas aos lampiões e corre imediatamente para o Sino de Alarme ao testemunhar um ataque.',
    weaknesses: [
      {
        id: 'bell_panic',
        label: 'Isolamento dos Sinos',
        description:
          'Sabotar o sino próximo [E] corta sua única rota de alerta, permitindo drená-lo sem convocar reforços da Vigília.',
        discoveryHint: 'Sabote um sino próximo ou observe-o com Sentido Carmesim [V].',
      },
      {
        id: 'lamp_blind',
        label: 'Vulnerável na Penumbra',
        description:
          'Apagar o lampião mais próximo deixa seu trajeto na escuridão total, ocultando o corpo automaticamente após a drenagem.',
        discoveryHint: 'Apague um lampião perto dele ou drene-o nas sombras.',
      },
    ],
  },
  {
    name: 'Condessa Eleanor',
    archetype: 'noble',
    title: 'Mecenas da Catedral',
    district: 'Adro da Catedral Norte',
    yieldLabel: '+48 Sangue · +54 Essência · +2 Domínio',
    behavior:
      'Caminha pelo adro norte sob proteção indireta das sentinelas; distrai-se facilmente com ruídos vindos dos becos.',
    weaknesses: [
      {
        id: 'sound_lure',
        label: 'Curiosidade Imprudente',
        description:
          'Quebrar urnas ou barris nos arredores atrai a Condessa para longe da patrulha armada, deixando-a isolada para [F].',
        discoveryHint: 'Atraia a Condessa com um ruído ou observe-a com [V].',
      },
      {
        id: 'rain_approach',
        label: 'Aproximação Sob Chuva',
        description:
          'Durante Chuva Leve ou usando Manto da Névoa, você pode correr pelas suas costas sem que ela perceba seus passos.',
        discoveryHint: 'Aproxime-se dela sob Chuva Leve ou drene-a furtivamente.',
      },
    ],
  },
  {
    name: 'Barão Thorne',
    archetype: 'noble',
    title: 'Senhor da Mansão Leste',
    district: 'Jardins da Mansão & Cemitério',
    yieldLabel: '+50 Sangue · +58 Essência · +2 Domínio',
    behavior:
      'Passeia entre as sebes dos jardins da Mansão e alerta todos os guardas próximos se avistar você sob luz forte.',
    weaknesses: [
      {
        id: 'aerial_ambush',
        label: 'Desatenção Vertical',
        description:
          'Jamais vigia sacadas ou telhados. Um Bote Aéreo [F] vindo de cima o abate no ato e concede +15 Essência bônus.',
        discoveryHint: 'Execute um Bote Aéreo ou observe-o de cima com [V].',
      },
      {
        id: 'bat_stun',
        label: 'Pânico com Enxame',
        description:
          'O Enxame de Morcegos [R] interrompe instantaneamente sua fuga em direção aos sinos e abre brecha para drenagem.',
        discoveryHint: 'Atinja-o com Enxame de Morcegos [R] ou drene-o atordoado.',
      },
    ],
  },
  {
    name: 'Magistrado Vance',
    archetype: 'noble',
    title: 'Juiz da Vigília Noturna',
    district: 'Avenida Vitoriana',
    yieldLabel: '+54 Sangue · +66 Essência · +3 Domínio',
    behavior:
      'Olhar treinado para notar vultos iluminados junto às vitrines (Exposição > 72%), mas depende inteiramente da clareza do ar.',
    weaknesses: [
      {
        id: 'fog_blind',
        label: 'Cegueira na Neblina',
        description:
          'Sob Neblina Densa ou Falso Semblante, perde alcance visual suficiente para ser flanqueado em plena avenida.',
        discoveryHint: 'Observe-o durante Neblina Densa ou após usar [Q] perto dele.',
      },
      {
        id: 'silent_corpse',
        label: 'Rastro Exposto',
        description:
          'Se drenado sob lampiões, seu corpo dispara a Infâmia rapidamente; oculte o corpo com [G] ou drene nas sombras.',
        discoveryHint: 'Oculte um corpo com [G] ou drene o Magistrado.',
      },
    ],
  },
  {
    name: 'Caçador de Vampiros',
    archetype: 'guard',
    title: 'Matador da Ordem Escarlate',
    district: 'Avenida Vitoriana (Alta Infâmia)',
    yieldLabel: '+46 Sangue · +58 Essência · +3 Domínio',
    behavior:
      'Surge nas ruas principais conforme a Infâmia sobe. Possui visão alongada (15.5m) e dispara virotes de prata com precisão mortal.',
    weaknesses: [
      {
        id: 'hunter_flank',
        label: 'Foco Frontal Rígido',
        description:
          'Apesar da visão longa à frente, é vulnerável a Laço das Sombras, Forma de Névoa e Emboscada Letal pelas costas.',
        discoveryHint: 'Observe-o com Sentido Carmesim [V] ou embosque-o das sombras.',
      },
      {
        id: 'hunter_lure',
        label: 'Rastreamento Acústico',
        description:
          'Arremesso Sombrio ou urnas quebradas nos becos laterais desviam sua rota da Avenida Vitoriana.',
        discoveryHint: 'Desvie um Caçador com som ou atordoe-o.',
      },
    ],
  },
  {
    name: 'Caçador da Vigília',
    archetype: 'guard',
    title: 'Patrulheiro de Lanterna',
    district: 'Avenida Vitoriana & Cruzamentos',
    yieldLabel: '+36 Sangue · +36 Essência · +2 Domínio',
    behavior:
      'Varre as ruas com cone de visão frontal de 13.5m e ataca com alabarda de prata ao confirmar sua presença.',
    weaknesses: [
      {
        id: 'back_ambush',
        label: 'Ponto Cego Traseiro',
        description:
          'Vulnerável à Emboscada Letal [F] instantânea pelas costas enquanto estiver em patrulha sem alerta amarelo ou vermelho.',
        discoveryHint: 'Observe-o com Sentido Carmesim [V] ou abata-o furtivamente.',
      },
      {
        id: 'fog_cone',
        label: 'Cone Reduzido pela Neblina',
        description:
          'A Neblina Densa reduz seu raio de detecção visual em 38%, criando brechas seguras mesmo entre lampiões acesos.',
        discoveryHint: 'Aproxime-se dele durante Neblina Densa.',
      },
    ],
  },
  {
    name: 'Inquisidor de Prata',
    archetype: 'guard',
    title: 'Rastreador da Ordem',
    district: 'Becos e Vielas Estreitas',
    yieldLabel: '+42 Sangue · +48 Essência · +3 Domínio',
    behavior:
      'Investiga imediatamente passos ruidosos e estilhaços; em combate aberto, mantém guarda alta contra investidas frontais.',
    weaknesses: [
      {
        id: 'rain_muffle',
        label: 'Audição Abafada pela Chuva',
        description:
          'Chuva Leve reduz o som dos seus passos em 58%, permitindo cruzar suas costas sem disparar investigação sonora.',
        discoveryHint: 'Mova-se próximo a ele durante Chuva Leve ou use [V].',
      },
      {
        id: 'claw_finish',
        label: 'Quebra de Postura por Garras',
        description:
          'Quando alertado, golpeie com Garras [X] até reduzir sua vitalidade a <=25 PV para liberar a execução drenante [F].',
        discoveryHint: 'Enfraqueça-o com Garras [X] em combate ou execute-o ferido.',
      },
    ],
  },
  {
    name: 'Sentinela Sacra',
    archetype: 'guard',
    title: 'Guardiã das Passarelas e Sinos',
    district: 'Adro da Catedral Norte',
    yieldLabel: '+38 Sangue · +40 Essência · +2 Domínio',
    behavior:
      'Patrulha pontes elevadas (4m) e tenta correr até o Sino de Alarme mais próximo caso entre em alerta vermelho.',
    weaknesses: [
      {
        id: 'vertical_blind',
        label: 'Ângulo Morto Superior',
        description:
          'Não vigia telhados acima de 2.8m; posicione-se acima dela para reduzir sua visão e desferir um Bote Aéreo [F].',
        discoveryHint: 'Observe-a de uma elevação superior ou execute Bote Aéreo.',
      },
      {
        id: 'sabotage_counter',
        label: 'Dependente de Sinos Ativos',
        description:
          'Sabotar o sino do setor [E] impede que ela convoque reforços coordenados e reduz a Suspeita Global em 10%.',
        discoveryHint: 'Sabote um sino próximo ou analise-a com [V].',
      },
    ],
  },
  {
    name: 'Alabardeiro',
    archetype: 'guard',
    title: 'Guarda Pesado da Avenida',
    district: 'Avenida Vitoriana & Jardins',
    yieldLabel: '+42 Sangue · +46 Essência · +3 Domínio',
    behavior:
      'Possui alta vitalidade e amplia velocidade e cadência de ataque conforme a Suspeita Global aumenta.',
    weaknesses: [
      {
        id: 'swarm_stun',
        label: 'Paralisia por Enxame',
        description:
          'Atordoado imediatamente pelo Enxame de Morcegos [R], anulando seu alerta e liberando drenagem direta com [F].',
        discoveryHint: 'Atordoe-o com Enxame de Morcegos [R] ou examine com [V].',
      },
      {
        id: 'suspicion_bait',
        label: 'Distração por Ruído',
        description:
          'Barris ou urnas quebradas forçam-no a virar as costas à rota; com Fúria das Trevas, drene-o mesmo em alerta amarelo.',
        discoveryHint: 'Distraia-o com um som para investigação ou drene-o.',
      },
    ],
  },
  {
    name: 'Acólito do Eclipse',
    archetype: 'cultist',
    title: 'Ocultista das Sombras Sagradas',
    district: 'Adro da Catedral Norte & Mausoléus',
    yieldLabel: '+36 Sangue · +34 Essência · Regen. Poder (18s)',
    behavior:
      'Carrega lanterna violeta própria e entoa cânticos de alerta local ao ver poderes sobrenaturais. Seu sangue desperta regeneração de Sangue e recarga dobrada.',
    weaknesses: [
      {
        id: 'occult_siphon',
        label: 'Sangue Canalizador',
        description:
          'Drenar um Ocultista ativa 18s de Regeneração de Poder (+Sangue contínuo e recargas 2x mais rápidas) para encadear Disciplinas.',
        discoveryHint: 'Drene um Acólito do Eclipse ou observe-o com [V].',
      },
      {
        id: 'lantern_blind',
        label: 'Cego pela Própria Chama',
        description:
          'Focado no brilho do próprio turíbulo e lanterna, ignora abordagens por trás em vielas ou sob Ofuscação.',
        discoveryHint: 'Aborde-o pelas costas ou sob Ofuscação.',
      },
    ],
  },
  {
    name: 'Boticário',
    archetype: 'cultist',
    title: 'Alquimista das Vielas',
    district: 'Becos, Catedral & Cemitério',
    yieldLabel: '+36 Sangue · +34 Essência · Regen. Poder (18s)',
    behavior:
      'Percorre rotas sombrias com lanterna esmeralda portátil repleta de óleos lunares; ao ser drenado, transfere vigor alquímico às suas Disciplinas.',
    weaknesses: [
      {
        id: 'elixir_surge',
        label: 'Elixir Sanguíneo Volátil',
        description:
          'Drená-lo [F] concede bônus temporário de regeneração de poder (18s), ideal antes de invadir áreas vigiadas ou enfrentar Caçadores.',
        discoveryHint: 'Drene o Boticário pelas vielas ou examine-o com [V].',
      },
      {
        id: 'sound_curious',
        label: 'Atenção aos Frascos',
        description:
          'Investigará imediatamente urnas quebradas próximas por temer saque aos seus suprimentos.',
        discoveryHint: 'Quebre uma urna próxima ou observe-o com [V].',
      },
    ],
  },
];

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  blood: number;
  maxBlood: number;
  essence: number;
  pendingEssence: number;
  exposure: number; // 0 (deep shadow) to 100 (exposed in bright light / spotted)
  shadowImmersion: number; // 0 (lit) to 1 (immersed in deep shadows)
  noiseLevel: number; // 0 (silent) to 100 (loud)
  globalSuspicion: number; // 0..100
  suspicionTier: SuspicionTier;
  weather: WeatherType;
  weatherLabel: string;
  weatherEffect: string;
  bellsSabotaged: number;
  totalBells: number;
  collectedMemories: string[];
  encounteredTargets: string[];
  discoveredWeaknesses: Record<string, string[]>;
  huntLog: HuntLogEntry[];
  currentDistrict: DistrictId;
  currentDistrictName: string;
  currentDistrictInfamy: number;
  districtInfamy: Record<DistrictId, number>;
  isInSafeSanctuary: boolean;
  isInSafeCemetery: boolean;
  isCrouching: boolean;
  isInShadow: boolean;
  isCrimsonSense: boolean;
  isObfuscated: boolean;
  isCelerity: boolean;
  isMistForm: boolean;
  isFalseVisage: boolean;
  isAstralScout: boolean;
  isAbyssalShroud: boolean;
  isShadowDecoyActive: boolean;
  powerRegenRemaining: number;
  isFeeding: boolean;
  feedProgress: number;
  feedTargetName: string | null;
  feedMethodLabel: string | null;
  elevation: number;
  alertLevel: 'hidden' | 'curious' | 'caution' | 'hunted';
  alertStateLabel: 'Calmo' | 'Investigando' | 'Suspeito' | 'Alerta';
  nightNumber: number;
  nightProgress: number;
  nightClockText: string;
  isDawnApproaching: boolean;
  isDawnBurn: boolean;
  canCompleteNight: boolean;
  cryptDistance: number;
  cryptBearingDeg: number;
  showCryptCompass: boolean;
  lastNightSummary: {
    nightNumber: number;
    kills: number;
    quota: number;
    quotaMet: boolean;
    essenceConsolidated: number;
    quotaBonus: number;
    infamyReliefPct: number;
  } | null;
  mainTargetName: string;
  mainTargetDistrict: string;
  mainTargetDefeated: boolean;
  killsThisNight: number;
  quotaThisNight: number;
  totalKills: number;
  noblesDrained: number;
  guardsSlain: number;
  cooldowns: {
    shadowDash: number;
    shadowDashMax: number;
    snuffLamp: number;
    snuffLampMax: number;
    shadowSnare: number;
    shadowSnareMax: number;
    abyssalShroud: number;
    abyssalShroudMax: number;
    darknessPulse: number;
    darknessPulseMax: number;
    obfuscate: number;
    obfuscateMax: number;
    falseVisage: number;
    falseVisageMax: number;
    shadowDecoy: number;
    shadowDecoyMax: number;
    astralScout: number;
    astralScoutMax: number;
    dominate: number;
    dominateMax: number;
    memoryWipe: number;
    memoryWipeMax: number;
    possess: number;
    possessMax: number;
    batSwarm: number;
    batSwarmMax: number;
    mistForm: number;
    mistFormMax: number;
    celerity: number;
    celerityMax: number;
    shadowLeap: number;
    shadowLeapMax: number;
    shadowThrow: number;
    shadowThrowMax: number;
  };
  disciplines: DisciplineLevels;
  unlockedSkills: string[];
  equippedPowers: ActivePowerId[];
  hotkeys: HotkeyBindings;
  contextPrompt: ContextPrompt | null;
  statusBanner: string | null;
  deathReason: string | null;
  pointerLocked: boolean;
}

export const INITIAL_DISCIPLINE_LEVELS: DisciplineLevels = {
  tenebrosidade: 1,
  ofuscacao: 0,
  auspicios: 1,
  dominacao: 0,
  metamorfose: 0,
  rapidez: 0,
};
