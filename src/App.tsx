import { useCallback, useEffect, useRef, useState } from 'react';
import { EvolutionModal } from './components/EvolutionModal';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal, VictoryModal } from './components/OverlayModals';
import { TitleScreen } from './components/TitleScreen';
import { VampireGameEngine } from './game/engine';
import {
  DEFAULT_EQUIPPED_POWERS,
  DEFAULT_HOTKEYS,
  DISTRICT_META,
  INITIAL_DISCIPLINE_LEVELS,
  INITIAL_UNLOCKED_SKILLS,
  type ActivePowerId,
  type DisciplineId,
  type GamePhase,
  type HudSnapshot,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  blood: 92,
  maxBlood: 100,
  essence: 35,
  exposure: 10,
  shadowImmersion: 0,
  noiseLevel: 0,
  globalSuspicion: 0,
  suspicionTier: 'Silencioso',
  weather: 'clear',
  weatherLabel: 'Noite Clara',
  weatherEffect: 'Visibilidade Padrão',
  bellsSabotaged: 0,
  totalBells: 4,
  collectedMemories: [],
  encounteredTargets: [],
  discoveredWeaknesses: {},
  huntLog: [],
  currentDistrict: 'cathedral',
  currentDistrictName: DISTRICT_META.cathedral.name,
  currentDistrictInfamy: 0,
  districtInfamy: {
    cathedral: 0,
    alleys: 0,
    avenue: 0,
    cemetery: 0,
  },
  isInSafeSanctuary: true,
  isCrouching: false,
  isInShadow: true,
  isCrimsonSense: false,
  isObfuscated: false,
  isCelerity: false,
  isMistForm: false,
  isFalseVisage: false,
  isAstralScout: false,
  isAbyssalShroud: false,
  powerRegenRemaining: 0,
  isFeeding: false,
  feedProgress: 0,
  feedTargetName: null,
  feedMethodLabel: null,
  elevation: -2.4,
  alertLevel: 'hidden',
  alertStateLabel: 'Calmo',
  nightNumber: 1,
  nightProgress: 0,
  nightClockText: '00:00',
  isDawnApproaching: false,
  isDawnBurn: false,
  canCompleteNight: false,
  mainTargetName: 'Lorde Valerius',
  mainTargetDistrict: DISTRICT_META.cemetery.name,
  mainTargetDefeated: false,
  killsThisNight: 0,
  quotaThisNight: 7,
  totalKills: 0,
  noblesDrained: 0,
  guardsSlain: 0,
  cooldowns: {
    shadowDash: 0,
    shadowDashMax: 4.5,
    snuffLamp: 0,
    snuffLampMax: 7.0,
    shadowSnare: 0,
    shadowSnareMax: 9.0,
    abyssalShroud: 0,
    abyssalShroudMax: 16.0,
    obfuscate: 0,
    obfuscateMax: 13.0,
    falseVisage: 0,
    falseVisageMax: 15.0,
    astralScout: 0,
    astralScoutMax: 2.0,
    dominate: 0,
    dominateMax: 13.0,
    memoryWipe: 0,
    memoryWipeMax: 14.0,
    possess: 0,
    possessMax: 15.0,
    batSwarm: 0,
    batSwarmMax: 12.0,
    mistForm: 0,
    mistFormMax: 15.0,
    celerity: 0,
    celerityMax: 14.0,
    shadowLeap: 0,
    shadowLeapMax: 5.5,
    shadowThrow: 0,
    shadowThrowMax: 5.0,
  },
  disciplines: { ...INITIAL_DISCIPLINE_LEVELS },
  unlockedSkills: [...INITIAL_UNLOCKED_SKILLS],
  equippedPowers: [...DEFAULT_EQUIPPED_POWERS],
  hotkeys: { ...DEFAULT_HOTKEYS },
  contextPrompt: null,
  statusBanner: null,
  deathReason: null,
  pointerLocked: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VampireGameEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new VampireGameEngine(container, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onPhaseRequest: (nextPhase) => setPhase(nextPhase),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    setPhase('playing');
    engineRef.current?.startNewHunt();
  }, []);

  const handleResume = useCallback(() => {
    setPhase('playing');
    engineRef.current?.setPhase('playing');
  }, []);

  const handleOpenGrimoire = useCallback(() => {
    setPhase('grimoire');
    engineRef.current?.setPhase('grimoire');
  }, []);

  const handlePause = useCallback(() => {
    setPhase('paused');
    engineRef.current?.setPhase('paused');
  }, []);

  const handleQuitToTitle = useCallback(() => {
    setPhase('title');
    engineRef.current?.setPhase('title');
  }, []);

  const handleNextNight = useCallback(() => {
    setPhase('playing');
    engineRef.current?.advanceNextNight();
  }, []);

  const handleUpgrade = useCallback((id: DisciplineId) => {
    engineRef.current?.upgradeDiscipline(id);
  }, []);

  const handleUnlockSkillNode = useCallback((nodeId: string) => {
    engineRef.current?.unlockSkillNode(nodeId);
  }, []);

  const handleEquipPower = useCallback((powerId: ActivePowerId) => {
    engineRef.current?.equipPower(powerId);
  }, []);

  const handleUnequipPower = useCallback((powerId: ActivePowerId) => {
    engineRef.current?.unequipPower(powerId);
  }, []);

  const handleSetHotkey = useCallback((powerId: ActivePowerId, code: string) => {
    engineRef.current?.setHotkey(powerId, code);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!engineRef.current) return;
    setMuted(engineRef.current.toggleMute());
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070e]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={mountRef}
        className="w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      />

      {phase === 'title' && (
        <TitleScreen onStart={handleStart} muted={muted} onToggleMute={handleToggleMute} />
      )}

      {phase === 'playing' && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenGrimoire={handleOpenGrimoire}
          onPause={handlePause}
        />
      )}

      {phase === 'grimoire' && (
        <EvolutionModal
          essence={hud.essence}
          disciplines={hud.disciplines}
          unlockedSkills={hud.unlockedSkills}
          equippedPowers={hud.equippedPowers}
          hotkeys={hud.hotkeys}
          collectedMemories={hud.collectedMemories}
          encounteredTargets={hud.encounteredTargets}
          discoveredWeaknesses={hud.discoveredWeaknesses}
          huntLog={hud.huntLog}
          nightNumber={hud.nightNumber}
          mainTargetName={hud.mainTargetName}
          mainTargetDefeated={hud.mainTargetDefeated}
          onUpgrade={handleUpgrade}
          onUnlockSkillNode={handleUnlockSkillNode}
          onEquipPower={handleEquipPower}
          onUnequipPower={handleUnequipPower}
          onSetHotkey={handleSetHotkey}
          onClose={handleResume}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onOpenGrimoire={handleOpenGrimoire}
          onRestart={handleStart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {phase === 'victory' && (
        <VictoryModal
          hud={hud}
          onNextNight={handleNextNight}
          onOpenGrimoire={handleOpenGrimoire}
        />
      )}

      {phase === 'gameover' && (
        <GameOverModal
          hud={hud}
          onRestart={handleStart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </div>
  );
}
