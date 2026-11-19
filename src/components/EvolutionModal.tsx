import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Crosshair,
  Droplet,
  Keyboard,
  Link2,
  Minus,
  Plus,
  ScrollText,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ACTIVE_POWER_LIST,
  AMALGAM_NODES,
  DISCIPLINE_DEFINITIONS,
  IMPORTANT_NPC_LORE,
  MAX_EQUIPPED_SLOTS,
  MEMORY_FRAGMENTS,
  NPC_DOSSIER_PROFILES,
  SKILL_TREE_NODES,
  formatKeyCodeLabel,
  isSkillNodeAvailable,
  type ActivePowerId,
  type DisciplineId,
  type DisciplineLevels,
  type HotkeyBindings,
  type HuntLogEntry,
  type SkillNodeDef,
} from '../game/types';

interface EvolutionModalProps {
  essence: number;
  disciplines: DisciplineLevels;
  unlockedSkills: string[];
  equippedPowers: ActivePowerId[];
  hotkeys: HotkeyBindings;
  collectedMemories: string[];
  encounteredTargets: string[];
  discoveredWeaknesses: Record<string, string[]>;
  huntLog: HuntLogEntry[];
  nightNumber: number;
  mainTargetName: string;
  mainTargetDefeated: boolean;
  onUpgrade: (id: DisciplineId) => void;
  onUnlockSkillNode: (nodeId: string) => void;
  onEquipPower: (powerId: ActivePowerId) => void;
  onUnequipPower: (powerId: ActivePowerId) => void;
  onSetHotkey: (powerId: ActivePowerId, code: string) => void;
  onClose: () => void;
}

const TIER_ROMAN: Record<1 | 2 | 3, string> = {
  1: 'Nv.I',
  2: 'Nv.II',
  3: 'Nv.III',
};

function renderSkillGlyph(iconKey: string, color: string) {
  switch (iconKey) {
    case 'dash':
    case 'leap':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M2 11L11 3M11 3H6M11 3V8" fill="none" stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M8 2C6 4.5 5 6.3 5 8A3 3 0 0 0 11 8C11 6.3 10 4.5 8 2Z" fill="none" stroke={color} strokeWidth="1.4" />
          <path d="M3 13L13 3" stroke="#ef4444" strokeWidth="1.4" />
        </svg>
      );
    case 'snare':
    case 'shroud':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M3 13C4 8 6 5 8 3C10 5 12 8 13 13" fill="none" stroke={color} strokeWidth="1.5" />
          <circle cx="8" cy="9" r="2.2" fill={color} opacity="0.7" />
        </svg>
      );
    case 'eye':
    case 'aura':
    case 'astral':
    case 'telepathy':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M1.5 8Q8 3 14.5 8Q8 13 1.5 8Z" fill="none" stroke={color} strokeWidth="1.4" />
          <circle cx="8" cy="8" r="2" fill={color} />
        </svg>
      );
    case 'ghost':
    case 'mask':
    case 'cloak':
    case 'fade':
    case 'mist':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M4 13V7A4 4 0 0 1 12 7V13L10 11.5L8 13L6 11.5Z" fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'mind':
    case 'wipe':
    case 'possess':
    case 'crown':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <circle cx="8" cy="8" r="5" fill="none" stroke={color} strokeWidth="1.3" />
          <circle cx="8" cy="8" r="1.8" fill={color} />
        </svg>
      );
    case 'bats':
    case 'claw':
    case 'fury':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M1.5 7C4 4.5 6 5.5 8 8C10 5.5 12 4.5 14.5 7C12.5 8.5 10.5 9.5 8 12C5.5 9.5 3.5 8.5 1.5 7Z" fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'bolt':
    case 'blade':
    case 'apex':
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M9.5 1.5L4 9H8L6.5 14.5L12 7H8Z" fill={color} />
        </svg>
      );
    default:
      return <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
  }
}

export function EvolutionModal({
  essence,
  disciplines,
  unlockedSkills,
  equippedPowers,
  hotkeys,
  collectedMemories,
  encounteredTargets,
  discoveredWeaknesses,
  huntLog,
  nightNumber,
  mainTargetName,
  mainTargetDefeated,
  onUnlockSkillNode,
  onEquipPower,
  onUnequipPower,
  onSetHotkey,
  onClose,
}: EvolutionModalProps) {
  const [activeTab, setActiveTab] = useState<'skills' | 'dossier' | 'huntlog' | 'memories'>('skills');
  const [dossierFilter, setDossierFilter] = useState<'all' | 'noble' | 'guard' | 'cultist'>('all');
  const [listeningPowerId, setListeningPowerId] = useState<ActivePowerId | null>(null);

  useEffect(() => {
    if (!listeningPowerId) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningPowerId(null);
        return;
      }
      onSetHotkey(listeningPowerId, e.code);
      setListeningPowerId(null);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [listeningPowerId, onSetHotkey]);

  const collectedSet = new Set(collectedMemories);
  const encounteredSet = new Set(encounteredTargets);
  const unlockedSet = new Set(unlockedSkills);
  const equippedSet = new Set(equippedPowers);

  const totalWeaknesses = NPC_DOSSIER_PROFILES.reduce((acc, p) => acc + p.weaknesses.length, 0);
  const discoveredWeaknessCount = NPC_DOSSIER_PROFILES.reduce(
    (acc, p) => acc + (discoveredWeaknesses[p.name]?.length ?? 0),
    0,
  );

  const nobleCount = NPC_DOSSIER_PROFILES.filter((p) => p.archetype === 'noble').length;
  const guardCount = NPC_DOSSIER_PROFILES.filter((p) => p.archetype === 'guard').length;
  const cultistCount = NPC_DOSSIER_PROFILES.filter((p) => p.archetype === 'cultist').length;
  const filteredProfiles = NPC_DOSSIER_PROFILES.filter(
    (p) => dossierFilter === 'all' || p.archetype === dossierFilter,
  );
  const mainTargetLore = IMPORTANT_NPC_LORE.find((l) => l.name === mainTargetName);

  const unlockedActivePowers = ACTIVE_POWER_LIST.filter((p) => unlockedSet.has(p.requiredNodeId));
  const discColorMap = Object.fromEntries(DISCIPLINE_DEFINITIONS.map((d) => [d.id, d.accent])) as Record<
    DisciplineId,
    string
  >;
  const discNameMap = Object.fromEntries(DISCIPLINE_DEFINITIONS.map((d) => [d.id, d.name])) as Record<
    DisciplineId,
    string
  >;

  const renderSkillNodeCard = (node: SkillNodeDef, accent: string, compact = false) => {
    const isUnlocked = unlockedSet.has(node.id);
    const isAvailable = isSkillNodeAvailable(node, unlockedSet);
    const canAfford = isAvailable && essence >= node.cost;
    const linkedMeta = node.linkedPower
      ? ACTIVE_POWER_LIST.find((p) => p.id === node.linkedPower)
      : undefined;
    const isEquipped = node.linkedPower ? equippedSet.has(node.linkedPower) : false;

    return (
      <div
        key={node.id}
        className={`border transition-colors flex flex-col justify-between ${compact ? 'p-2.5' : 'p-3'}`}
        style={{
          backgroundColor: isUnlocked ? '#0b101d' : '#080a12',
          borderColor: isUnlocked ? accent : isAvailable ? '#434d70' : '#1b2032',
          opacity: isUnlocked || isAvailable ? 1 : 0.72,
        }}
      >
        <div>
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {renderSkillGlyph(node.iconKey, isUnlocked ? accent : '#64748b')}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span
                    className="text-[9px] font-bold px-1 py-0.2 border shrink-0"
                    style={{
                      borderColor: isUnlocked ? accent : '#2d344d',
                      color: isUnlocked ? accent : '#94a0bd',
                    }}
                  >
                    {TIER_ROMAN[node.tierNum]}
                  </span>
                  <span className="font-gothic text-[11px] text-[#f1ede4] leading-tight truncate">
                    {node.name}
                  </span>
                </div>
              </div>
            </div>

            <span
              className={`text-[9px] px-1.5 py-0.5 border shrink-0 ${
                node.bloodCost.includes('Sangue')
                  ? 'border-[#7f1d1d] text-[#fca5a5] bg-[#1a0b10]'
                  : 'border-[#252b40] text-[#94a0bd]'
              }`}
            >
              {node.bloodCost}
            </span>
          </div>

          <p className="text-[10.5px] text-[#a5aec8] leading-snug mb-2">{node.summary}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          {isUnlocked ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex-1 py-1 text-center text-[9.5px] uppercase tracking-[0.14em] border flex items-center justify-center gap-1"
                style={{
                  borderColor: `${accent}66`,
                  color: accent,
                  backgroundColor: '#070a14',
                }}
              >
                <Check className="w-3 h-3" />
                <span>Dominado</span>
              </div>

              {linkedMeta && (
                <button
                  onClick={() =>
                    isEquipped ? onUnequipPower(linkedMeta.id) : onEquipPower(linkedMeta.id)
                  }
                  disabled={!isEquipped && equippedPowers.length >= MAX_EQUIPPED_SLOTS}
                  className={`px-2 py-1 text-[9.5px] uppercase tracking-wider border flex items-center gap-1 transition-colors ${
                    isEquipped
                      ? 'border-[#ef4444]/80 bg-[#2a0c12] text-[#fca5a5] hover:bg-[#3f111a] cursor-pointer'
                      : equippedPowers.length >= MAX_EQUIPPED_SLOTS
                      ? 'border-[#1d2233] bg-[#070910] text-[#5e6682] cursor-not-allowed'
                      : 'border-[#3b476b] bg-[#11172a] text-[#c7d2fe] hover:border-[#94b8ff] cursor-pointer'
                  }`}
                  title={
                    isEquipped
                      ? 'Remover da barra de atalhos'
                      : equippedPowers.length >= MAX_EQUIPPED_SLOTS
                      ? `Máximo de ${MAX_EQUIPPED_SLOTS} poderes equipados`
                      : 'Equipar na barra ativa'
                  }
                >
                  {isEquipped ? (
                    <>
                      <Minus className="w-2.5 h-2.5" />
                      <span>Equipada</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-2.5 h-2.5" />
                      <span>Equipar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : isAvailable ? (
            <button
              disabled={!canAfford}
              onClick={() => onUnlockSkillNode(node.id)}
              className={`w-full py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold border transition-colors ${
                canAfford
                  ? 'border-[#ef4444]/80 bg-[#7f1d1d] hover:bg-[#b91c1c] text-white cursor-pointer'
                  : 'border-[#252b40] bg-[#0d101b] text-[#5e6682] cursor-not-allowed'
              }`}
            >
              Despertar ({node.cost} Essência)
            </button>
          ) : (
            <div className="w-full py-1 text-center text-[9.5px] uppercase tracking-[0.12em] border border-[#1d2233] bg-[#070910] text-[#5e6682]">
              Requer Tier Anterior · {node.cost} Essência
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-4 bg-[#05070e]/90">
      <div className="w-full max-w-7xl max-h-[93vh] overflow-y-auto bg-[#0b0e18] border border-[#3a2832] shadow-2xl p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-[#252a3d]">
          <div>
            <h2 className="font-gothic text-2xl text-[#f5f1e8] tracking-[0.14em] uppercase">
              Grimório Ancestral
            </h2>
            <p className="text-xs text-[#94a0bd] mt-1 tracking-wide">
              {activeTab === 'skills'
                ? 'Árvore Ramificada das Disciplinas & Amálgamas: escolha bifurcações 2A/2B, equipe até 8 poderes ativos e reconfigure teclas.'
                : activeTab === 'dossier'
                ? 'Perfis de nobres, guardas e caçadores encontrados em Ravencroft e suas fraquezas reveladas.'
                : activeTab === 'huntlog'
                ? 'Registro sombrio dos alvos notáveis já abatidos, detalhando seu histórico e comportamento único.'
                : 'Crônicas de Ravencroft e lembranças fragmentadas de sua antiga vida mortal.'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-[#140c12] border border-[#7f1d1d] flex items-center gap-2.5">
              <span className="text-xs uppercase tracking-[0.15em] text-[#fca5a5]">Essência:</span>
              <span className="text-lg font-bold tabular-nums text-white">{essence}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 border border-[#323850] text-[#cbd5e1] hover:border-[#ef4444] hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar Grimório"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grimoire Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[#1d2233] pb-3">
          <button
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] border transition-colors cursor-pointer ${
              activeTab === 'skills'
                ? 'bg-[#2a0c12] border-[#ef4444] text-white'
                : 'bg-[#080a12] border-[#252b40] text-[#94a0bd] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ef4444]" />
            <span>Árvore de Disciplinas</span>
          </button>

          <button
            onClick={() => setActiveTab('dossier')}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] border transition-colors cursor-pointer ${
              activeTab === 'dossier'
                ? 'bg-[#24160d] border-[#f59e0b] text-white'
                : 'bg-[#080a12] border-[#252b40] text-[#94a0bd] hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>
              Perfis & Fraquezas ({encounteredTargets.length}/{NPC_DOSSIER_PROFILES.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('huntlog')}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] border transition-colors cursor-pointer ${
              activeTab === 'huntlog'
                ? 'bg-[#210f1d] border-[#ec4899] text-white'
                : 'bg-[#080a12] border-[#252b40] text-[#94a0bd] hover:text-white'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 text-[#f472b6]" />
            <span>
              Log de Caça ({huntLog.length}/{IMPORTANT_NPC_LORE.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('memories')}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] border transition-colors cursor-pointer ${
              activeTab === 'memories'
                ? 'bg-[#171b36] border-[#818cf8] text-white'
                : 'bg-[#080a12] border-[#252b40] text-[#94a0bd] hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#818cf8]" />
            <span>
              Fragmentos de Memória ({collectedMemories.length}/{MEMORY_FRAGMENTS.length})
            </span>
          </button>
        </div>

        {activeTab === 'skills' ? (
          <div className="flex flex-col gap-5">
            {/* Equipped Active Power Hotbar & Keybinding Strip */}
            <div className="bg-[#080a12] border border-[#252b40] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#1b2030]">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#e7e2d8]">
                  <Keyboard className="w-4 h-4 text-[#ef4444]" />
                  <span>Slots Equipados ({equippedPowers.length}/{MAX_EQUIPPED_SLOTS}) & Atalhos</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#94a0bd]">
                  <Droplet className="w-3.5 h-3.5 text-[#ef4444]" />
                  <span>
                    Poderes despertos:{' '}
                    <strong className="text-white tabular-nums">
                      {unlockedActivePowers.length}/{ACTIVE_POWER_LIST.length}
                    </strong>
                    {' · '}Clique em [Tecla] para reconfigurar
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {Array.from({ length: MAX_EQUIPPED_SLOTS }).map((_, slotIdx) => {
                  const powerId = equippedPowers[slotIdx];
                  const power = powerId
                    ? ACTIVE_POWER_LIST.find((p) => p.id === powerId)
                    : undefined;

                  if (!power) {
                    return (
                      <div
                        key={`empty-${slotIdx}`}
                        className="p-2 border border-dashed border-[#1e2438] bg-[#06080f] flex flex-col items-center justify-center text-center min-h-[76px]"
                      >
                        <span className="text-[10px] uppercase tracking-wider text-[#4d5673]">
                          Slot {slotIdx + 1}
                        </span>
                        <span className="text-[9.5px] text-[#434b66] mt-0.5">Vazio</span>
                      </div>
                    );
                  }

                  const unlocked = unlockedSet.has(power.requiredNodeId);
                  const isListening = listeningPowerId === power.id;
                  const keyLabel = formatKeyCodeLabel(hotkeys[power.id]);
                  const accent = discColorMap[power.discipline];

                  return (
                    <div
                      key={power.id}
                      className={`p-2 border flex flex-col justify-between gap-1.5 ${
                        unlocked
                          ? 'bg-[#0d111e] border-[#333c59]'
                          : 'bg-[#070910] border-[#1b2030] opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            {renderSkillGlyph(power.iconKey, unlocked ? accent : '#64748b')}
                            <span className="text-[10.5px] font-gothic text-[#f1ede4] truncate">
                              {power.shortName}
                            </span>
                          </div>
                          <div className="text-[9.5px] text-[#fca5a5] mt-0.5">
                            {power.bloodCostLabel}
                          </div>
                        </div>
                        <button
                          onClick={() => onUnequipPower(power.id)}
                          className="text-[#64748b] hover:text-[#ef4444] p-0.5 cursor-pointer"
                          title="Remover do slot"
                          aria-label={`Remover ${power.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          setListeningPowerId((prev) => (prev === power.id ? null : power.id))
                        }
                        className={`w-full py-1 px-1.5 text-[9.5px] uppercase tracking-[0.14em] border transition-colors cursor-pointer ${
                          isListening
                            ? 'bg-[#3b0d14] border-[#ef4444] text-white'
                            : 'bg-[#121626] border-[#2c344f] hover:border-[#94b8ff] text-[#cbd5e1]'
                        }`}
                      >
                        {isListening ? 'Tecla...' : `[${keyLabel}]`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Branching Skill Tree Columns (6 Disciplines with SVG Branching Lines) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {DISCIPLINE_DEFINITIONS.map((disc) => {
                const level = disciplines[disc.id];
                const nodes = SKILL_TREE_NODES.filter((n) => n.discipline === disc.id);
                const node1 = nodes.find((n) => n.slot === '1')!;
                const node2a = nodes.find((n) => n.slot === '2A')!;
                const node2b = nodes.find((n) => n.slot === '2B')!;
                const node3 = nodes.find((n) => n.slot === '3')!;

                const u1 = unlockedSet.has(node1.id);
                const u2a = unlockedSet.has(node2a.id);
                const u2b = unlockedSet.has(node2b.id);
                const u3 = unlockedSet.has(node3.id);

                return (
                  <div
                    key={disc.id}
                    className="bg-[#0e1220] border border-[#23293e] p-4 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#23293e] pb-3 mb-3">
                      <div>
                        <h3
                          className="font-gothic text-sm uppercase tracking-[0.16em]"
                          style={{ color: disc.accent }}
                        >
                          {disc.name}
                        </h3>
                        <p className="text-[11px] text-[#8590ad] mt-1">{disc.subtitle}</p>
                      </div>
                      <span
                        className="text-[10px] tabular-nums px-2 py-0.5 border shrink-0 uppercase tracking-wider"
                        style={{
                          borderColor: level > 0 ? disc.accent : '#2a3047',
                          color: level > 0 ? '#f8fafc' : '#64748b',
                        }}
                      >
                        Nv.{level}/3
                      </span>
                    </div>

                    {/* Tier 1 Root Node */}
                    {renderSkillNodeCard(node1, disc.accent)}

                    {/* SVG Bifurcation Lines: Tier 1 -> 2A / 2B */}
                    <svg
                      viewBox="0 0 200 26"
                      className="w-full h-6 overflow-visible"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M 100 0 C 100 13, 48 13, 48 26"
                        fill="none"
                        stroke={u2a ? disc.accent : u1 ? `${disc.accent}70` : '#252b40'}
                        strokeWidth={u2a ? 2.4 : 1.6}
                      />
                      <path
                        d="M 100 0 C 100 13, 152 13, 152 26"
                        fill="none"
                        stroke={u2b ? disc.accent : u1 ? `${disc.accent}70` : '#252b40'}
                        strokeWidth={u2b ? 2.4 : 1.6}
                      />
                    </svg>

                    {/* Tier 2A & 2B Bifurcation */}
                    <div className="grid grid-cols-2 gap-2">
                      {renderSkillNodeCard(node2a, disc.accent, true)}
                      {renderSkillNodeCard(node2b, disc.accent, true)}
                    </div>

                    {/* SVG Convergence Lines: 2A / 2B -> Tier 3 */}
                    <svg
                      viewBox="0 0 200 26"
                      className="w-full h-6 overflow-visible"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M 48 0 C 48 13, 100 13, 100 26"
                        fill="none"
                        stroke={u3 && u2a ? disc.accent : u2a ? `${disc.accent}70` : '#252b40'}
                        strokeWidth={u3 && u2a ? 2.4 : 1.6}
                      />
                      <path
                        d="M 152 0 C 152 13, 100 13, 100 26"
                        fill="none"
                        stroke={u3 && u2b ? disc.accent : u2b ? `${disc.accent}70` : '#252b40'}
                        strokeWidth={u3 && u2b ? 2.4 : 1.6}
                      />
                    </svg>

                    {/* Tier 3 Apex Node */}
                    {renderSkillNodeCard(node3, disc.accent)}
                  </div>
                );
              })}
            </div>

            {/* Hybrid Cross-Discipline Amalgam Nodes */}
            <div className="bg-[#0a0d18] border border-[#2d2542] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#221d33]">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#e9d5ff]">
                  <Link2 className="w-4 h-4 text-[#c084fc]" />
                  <span>Amálgamas Híbridas entre Disciplinas</span>
                </div>
                <span className="text-[11px] text-[#8590ad]">
                  Combine ramos Nv.II de duas Disciplinas para despertar sinergias únicas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {AMALGAM_NODES.map((amal) => {
                  const accentA = discColorMap[amal.discipline];
                  const accentB = amal.secondaryDiscipline
                    ? discColorMap[amal.secondaryDiscipline]
                    : '#c084fc';
                  const isUnlocked = unlockedSet.has(amal.id);
                  const isAvailable = isSkillNodeAvailable(amal, unlockedSet);
                  const canAfford = isAvailable && essence >= amal.cost;

                  return (
                    <div
                      key={amal.id}
                      className="p-3 border flex flex-col justify-between gap-2"
                      style={{
                        backgroundColor: isUnlocked ? '#120d1f' : '#080a12',
                        borderColor: isUnlocked ? '#c084fc' : isAvailable ? '#5b4b8a' : '#1d2233',
                        opacity: isUnlocked || isAvailable ? 1 : 0.78,
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                            <span style={{ color: accentA }}>{discNameMap[amal.discipline]}</span>
                            <span className="text-[#64748b]">+</span>
                            <span style={{ color: accentB }}>
                              {amal.secondaryDiscipline ? discNameMap[amal.secondaryDiscipline] : ''}
                            </span>
                          </div>
                          <span className="text-[9.5px] px-1.5 py-0.5 border border-[#4c1d95] text-[#ddd6fe] bg-[#1a1033]">
                            Amálgama
                          </span>
                        </div>

                        <h4 className="font-gothic text-xs text-[#f5f1e8] mb-1">{amal.name}</h4>
                        <p className="text-[10.5px] text-[#a5aec8] leading-snug">{amal.summary}</p>
                      </div>

                      {isUnlocked ? (
                        <div className="w-full py-1 text-center text-[10px] uppercase tracking-[0.15em] border border-[#c084fc]/60 text-[#e9d5ff] bg-[#160e29]">
                          Amálgama Desperta
                        </div>
                      ) : isAvailable ? (
                        <button
                          disabled={!canAfford}
                          onClick={() => onUnlockSkillNode(amal.id)}
                          className={`w-full py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold border transition-colors ${
                            canAfford
                              ? 'border-[#c084fc] bg-[#581c87] hover:bg-[#7e22ce] text-white cursor-pointer'
                              : 'border-[#252b40] bg-[#0d101b] text-[#5e6682] cursor-not-allowed'
                          }`}
                        >
                          Fundir Amálgama ({amal.cost} Essência)
                        </button>
                      ) : (
                        <div className="w-full py-1 text-center text-[9.5px] uppercase tracking-[0.12em] border border-[#1d2233] bg-[#070910] text-[#5e6682]">
                          Requer Nv.II em ambas · {amal.cost} Essência
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : activeTab === 'dossier' ? (
          <div>
            {/* Filter & Discovery Progress Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'noble', 'guard', 'cultist'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDossierFilter(filter)}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border transition-colors cursor-pointer ${
                      dossierFilter === filter
                        ? 'bg-[#1a1f33] border-[#94b8ff] text-white'
                        : 'bg-[#080a12] border-[#252b40] text-[#8590ad] hover:text-white'
                    }`}
                  >
                    {filter === 'all'
                      ? `Todos (${NPC_DOSSIER_PROFILES.length})`
                      : filter === 'noble'
                      ? `Nobres (${nobleCount})`
                      : filter === 'guard'
                      ? `Guardas & Caçadores (${guardCount})`
                      : `Ocultistas & Boticários (${cultistCount})`}
                  </button>
                ))}
              </div>
              <div className="text-xs uppercase tracking-[0.12em] text-[#cbd5e1]">
                Fraquezas Reveladas:{' '}
                <strong className="text-[#f59e0b] tabular-nums">
                  {discoveredWeaknessCount}/{totalWeaknesses}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProfiles.map((profile) => {
                const encountered = encounteredSet.has(profile.name);
                const unlockedWeaknesses = new Set(discoveredWeaknesses[profile.name] ?? []);
                const isNoble = profile.archetype === 'noble';
                const isCultist = profile.archetype === 'cultist';

                return (
                  <div
                    key={profile.name}
                    className={`p-4 border flex flex-col justify-between gap-3 ${
                      encountered
                        ? isNoble
                          ? 'bg-[#130b12] border-[#7f1d1d]'
                          : isCultist
                          ? 'bg-[#110c1c] border-[#6d28d9]'
                          : 'bg-[#0c111e] border-[#4f5ca3]'
                        : 'bg-[#080a11] border-[#1f2436] opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 border ${
                            isNoble
                              ? 'border-[#991b1b] text-[#fca5a5] bg-[#2a0c12]'
                              : isCultist
                              ? 'border-[#7c3aed] text-[#ddd6fe] bg-[#1e1038]'
                              : 'border-[#92400e] text-[#fcd34d] bg-[#24160b]'
                          }`}
                        >
                          {isNoble
                            ? 'Nobre'
                            : isCultist
                            ? profile.name === 'Boticário'
                              ? 'Boticário Alquimista'
                              : 'Ocultista'
                            : profile.name.includes('Caçador de Vampiros')
                            ? 'Ordem Escarlate'
                            : 'Guarda da Vigília'}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider ${
                            encountered ? 'text-[#86efac]' : 'text-[#64748b]'
                          }`}
                        >
                          {encountered ? 'Identificado' : 'Não Encontrado'}
                        </span>
                      </div>

                      <h3 className="font-gothic text-base text-[#f5f1e8] tracking-wide">
                        {encountered ? profile.name : 'Alvo Desconhecido'}
                      </h3>
                      <div className="text-[11px] text-[#94a0bd] mt-0.5">
                        {encountered
                          ? `${profile.title} · ${profile.district}`
                          : `Setor provável: ${profile.district}`}
                      </div>

                      {encountered ? (
                        <>
                          <p className="text-xs text-[#cbd5e1] leading-relaxed mt-2.5">
                            {profile.behavior}
                          </p>

                          <div className="mt-3 pt-2.5 border-t border-[#1f2538] flex flex-col gap-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-[#f59e0b] flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Fraquezas Estratégicas</span>
                            </div>

                            {profile.weaknesses.map((w) => {
                              const unlocked = unlockedWeaknesses.has(w.id);
                              return (
                                <div
                                  key={w.id}
                                  className={`p-2.5 border text-xs ${
                                    unlocked
                                      ? 'bg-[#080b14] border-[#b45309]/70'
                                      : 'bg-[#070910] border-[#1c2132]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span
                                      className={`font-semibold ${
                                        unlocked ? 'text-[#fcd34d]' : 'text-[#64748b]'
                                      }`}
                                    >
                                      {unlocked ? w.label : 'Fraqueza Não Descoberta'}
                                    </span>
                                    <span
                                      className={`text-[9px] uppercase tracking-wider ${
                                        unlocked ? 'text-[#86efac]' : 'text-[#64748b]'
                                      }`}
                                    >
                                      {unlocked ? 'Desbloqueada' : 'Oculta'}
                                    </span>
                                  </div>
                                  <p
                                    className={
                                      unlocked
                                        ? 'text-[#cbd5e1] leading-relaxed'
                                        : 'text-[#7c85a2] italic'
                                    }
                                  >
                                    {unlocked ? w.description : `Pista: ${w.discoveryHint}`}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[#7c85a2] italic mt-2.5">
                          Aproxime-se deste alvo pelas ruas ou ative o Sentido Carmesim [V] para registrar seu dossiê e investigar suas fraquezas.
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#1d2233] flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8590ad]">
                      <span>Recompensa: {profile.yieldLabel}</span>
                      <span>
                        {unlockedWeaknesses.size}/{profile.weaknesses.length} Fraquezas
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'huntlog' ? (
          <div className="flex flex-col gap-4">
            {/* Highlighted Alvo Principal da Noite */}
            {mainTargetLore && (
              <div className="p-4 border border-[#d97706] bg-gradient-to-r from-[#1c1008] via-[#150c12] to-[#0b0e18] flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 border border-[#f59e0b] text-[#fde68a] bg-[#2a1806]">
                      Alvo Principal da Noite {nightNumber}
                    </span>
                    <span className="text-[11px] text-[#cbd5e1]">{mainTargetLore.districtHint}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 border ${
                      mainTargetDefeated
                        ? 'border-[#16a34a] text-[#86efac] bg-[#052e16]'
                        : 'border-[#ef4444]/70 text-[#fca5a5] bg-[#2a0c12]'
                    }`}
                  >
                    {mainTargetDefeated ? 'Abatido (+25 Essência Bônus)' : 'Ativo · Visível em Dourado no [V]'}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-gothic text-lg text-[#fef3c7] tracking-wide">
                    {mainTargetLore.name}
                  </h3>
                  <span className="text-xs text-[#fcd34d]">{mainTargetLore.title}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">{mainTargetLore.uniqueBehavior}</p>
              </div>
            )}

            {huntLog.length === 0 ? (
              <div className="p-6 border border-[#252b40] bg-[#080a12] text-center">
                <p className="text-sm text-[#cbd5e1] font-gothic tracking-wide">
                  Nenhum alvo importante foi derrotado nesta caçada ainda.
                </p>
                <p className="text-xs text-[#7c85a2] mt-1.5">
                  Drene ou abata Nobres, Guardas, Caçadores, Ocultistas, Boticários ou Guarda-Costas para registrar seus históricos completos aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {huntLog.map((entry) => (
                  <div
                    key={`${entry.name}-${entry.nightNumber}`}
                    className={`p-4 border flex flex-col justify-between gap-3 ${
                      entry.isMainTarget
                        ? 'border-[#d97706] bg-[#160f0d]'
                        : 'border-[#7f1d1d] bg-[#120b12]'
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 border border-[#991b1b] text-[#fca5a5] bg-[#2a0c12]">
                            {entry.title}
                          </span>
                          {entry.isMainTarget && (
                            <span className="text-[9.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 border border-[#f59e0b] text-[#fde68a] bg-[#2a1806]">
                              Alvo Principal
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-[#f472b6]">
                          Noite {entry.nightNumber} · +{entry.essenceEarned} Essência
                        </span>
                      </div>

                      <h3 className="font-gothic text-base text-[#f5f1e8] tracking-wide">
                        {entry.name}
                      </h3>
                      <div className="text-[11px] text-[#94a0bd] mt-0.5">
                        {entry.method} · {entry.districtName}
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <div className="p-2.5 border border-[#241b2c] bg-[#080a12]">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#a5b4fc] mb-1">
                            Histórico
                          </div>
                          <p className="text-[#cbd5e1] leading-relaxed">{entry.history}</p>
                        </div>
                        <div className="p-2.5 border border-[#2e1a24] bg-[#080a12]">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#fcd34d] mb-1">
                            Comportamento Único
                          </div>
                          <p className="text-[#cbd5e1] leading-relaxed">{entry.uniqueBehavior}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sealed entries preview for undefeated notable NPCs */}
            {huntLog.length < IMPORTANT_NPC_LORE.length && (
              <div className="pt-3 border-t border-[#1d2233]">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#7c85a2] mb-2.5">
                  Alvos Notáveis Ainda Ativos em Ravencroft
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {IMPORTANT_NPC_LORE.filter(
                    (lore) => !huntLog.some((h) => h.name === lore.name),
                  ).map((lore) => (
                    <div
                      key={lore.name}
                      className="p-2.5 border border-[#1f2436] bg-[#070910] opacity-75"
                    >
                      <div className="text-xs font-gothic text-[#cbd5e1]">{lore.name}</div>
                      <div className="text-[10px] text-[#7c85a2] mt-0.5">{lore.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MEMORY_FRAGMENTS.map((frag) => {
              const unlocked = collectedSet.has(frag.id);
              const isProtagonist = frag.category === 'protagonista';
              return (
                <div
                  key={frag.id}
                  className={`p-4 border flex flex-col justify-between gap-2.5 ${
                    unlocked
                      ? isProtagonist
                        ? 'bg-[#120b12] border-[#7f1d1d]'
                        : 'bg-[#0d1122] border-[#4f5ca3]'
                      : 'bg-[#080a11] border-[#1f2436] opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 border ${
                          isProtagonist
                            ? 'border-[#991b1b] text-[#fca5a5] bg-[#2a0c12]'
                            : 'border-[#434e8c] text-[#a5b4fc] bg-[#141830]'
                        }`}
                      >
                        {isProtagonist ? 'Memória do Vampiro' : 'Crônica de Ravencroft'} · {frag.numberLabel}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          unlocked ? 'text-[#86efac]' : 'text-[#64748b]'
                        }`}
                      >
                        {unlocked ? 'Descoberto' : 'Selado'}
                      </span>
                    </div>

                    <h3 className="font-gothic text-base text-[#f5f1e8] tracking-wide">
                      {unlocked ? frag.title : `Fragmento ${frag.numberLabel} — Não Coletado`}
                    </h3>

                    {unlocked ? (
                      <p className="text-xs text-[#cbd5e1] leading-relaxed mt-2">{frag.body}</p>
                    ) : (
                      <p className="text-xs text-[#7c85a2] italic mt-2">
                        Explore a cidade para recuperar esta nota. Localização provável: {frag.locationHint}.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#1d2233] text-[10px] uppercase tracking-wider text-[#8590ad]">
                    Local: {frag.locationHint}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#23293e] flex items-center justify-between text-xs text-[#8892b0]">
          <span>Pressione Tab ou Esc para retornar à caçada</span>
          <button
            onClick={onClose}
            className="px-5 py-2 border border-[#3a425e] hover:border-[#e7e2d8] text-[#e7e2d8] uppercase tracking-[0.15em] cursor-pointer"
          >
            Retornar à Noite
          </button>
        </div>
      </div>
    </div>
  );
}
