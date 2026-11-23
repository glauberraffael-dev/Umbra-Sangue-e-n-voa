import { BookOpen, Pause, Volume2, VolumeX } from 'lucide-react';
import {
  ACTIVE_POWER_LIST,
  DEFAULT_EQUIPPED_POWERS,
  formatKeyCodeLabel,
  type ActivePowerId,
  type HudSnapshot,
} from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onOpenGrimoire: () => void;
  onPause: () => void;
}

export function GameHud({
  hud,
  muted,
  onToggleMute,
  onOpenGrimoire,
  onPause,
}: GameHudProps) {
  const bloodPct = Math.max(0, Math.min(100, (hud.blood / hud.maxBlood) * 100));
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const shadowStrength = Math.max(0, Math.min(1, hud.shadowImmersion));
  const deepShadow = shadowStrength >= 0.4 && hud.isInShadow;

  const panelClass = deepShadow
    ? 'bg-[#03050b]/96 border-[#7c8cff] shadow-[0_0_0_1px_rgba(165,180,252,0.32),0_10px_28px_rgba(0,0,0,0.85)]'
    : 'bg-[#080a12]/88 border-[#2b3147] shadow-lg';

  const barTrackClass = deepShadow
    ? 'bg-[#080b14] border-[#4b5882]'
    : 'bg-[#141724] border-[#2a2f44]';

  const exposureColor =
    hud.alertLevel === 'hunted'
      ? '#ef4444'
      : hud.alertLevel === 'caution'
      ? '#facc15'
      : hud.alertLevel === 'curious'
      ? '#93c5fd'
      : deepShadow
      ? '#a5b4fc'
      : hud.isInShadow
      ? '#818cf8'
      : '#fb923c';

  const eyeTitle = hud.isMistForm
    ? `Forma de Névoa · ${hud.alertStateLabel}`
    : hud.isAbyssalShroud
    ? `Mortalha Abissal · ${hud.alertStateLabel}`
    : hud.isObfuscated
    ? `Ofuscação · ${hud.alertStateLabel}`
    : hud.isFalseVisage
    ? `Falso Semblante · ${hud.alertStateLabel}`
    : hud.isInSafeSanctuary
    ? `Cripta Segura · ${hud.alertStateLabel}`
    : hud.isInShadow
    ? `Oculto na Sombra · ${hud.alertStateLabel}`
    : `Exposto à Luz · ${hud.alertStateLabel}`;

  const unlockedSet = new Set(hud.unlockedSkills);
  const equippedIds: ActivePowerId[] =
    hud.equippedPowers && hud.equippedPowers.length > 0 ? hud.equippedPowers : DEFAULT_EQUIPPED_POWERS;

  const skillSlots = equippedIds
    .map((id) => ACTIVE_POWER_LIST.find((p) => p.id === id))
    .filter((p): p is (typeof ACTIVE_POWER_LIST)[number] => Boolean(p))
    .map((power) => {
      const unlocked = unlockedSet.has(power.requiredNodeId);
      let cd = 0;
      let cdMax = Math.max(0.1, power.cooldownSec);
      let active = false;

      switch (power.id) {
        case 'shadowDash':
          cd = hud.cooldowns.shadowDash;
          cdMax = hud.cooldowns.shadowDashMax;
          break;
        case 'snuffLamp':
          cd = hud.cooldowns.snuffLamp;
          cdMax = hud.cooldowns.snuffLampMax;
          break;
        case 'shadowSnare':
          cd = hud.cooldowns.shadowSnare;
          cdMax = hud.cooldowns.shadowSnareMax;
          break;
        case 'abyssalShroud':
          cd = hud.cooldowns.abyssalShroud;
          cdMax = hud.cooldowns.abyssalShroudMax;
          active = hud.isAbyssalShroud;
          break;
        case 'obfuscate':
          cd = hud.cooldowns.obfuscate;
          cdMax = hud.cooldowns.obfuscateMax;
          active = hud.isObfuscated;
          break;
        case 'falseVisage':
          cd = hud.cooldowns.falseVisage;
          cdMax = hud.cooldowns.falseVisageMax;
          active = hud.isFalseVisage;
          break;
        case 'crimsonSense':
          active = hud.isCrimsonSense;
          break;
        case 'astralScout':
          cd = hud.cooldowns.astralScout;
          cdMax = hud.cooldowns.astralScoutMax;
          active = hud.isAstralScout;
          break;
        case 'dominate':
          cd = hud.cooldowns.dominate;
          cdMax = hud.cooldowns.dominateMax;
          break;
        case 'memoryWipe':
          cd = hud.cooldowns.memoryWipe;
          cdMax = hud.cooldowns.memoryWipeMax;
          break;
        case 'possess':
          cd = hud.cooldowns.possess;
          cdMax = hud.cooldowns.possessMax;
          break;
        case 'batSwarm':
          cd = hud.cooldowns.batSwarm;
          cdMax = hud.cooldowns.batSwarmMax;
          break;
        case 'mistForm':
          cd = hud.cooldowns.mistForm;
          cdMax = hud.cooldowns.mistFormMax;
          active = hud.isMistForm;
          break;
        case 'celerity':
          cd = hud.cooldowns.celerity;
          cdMax = hud.cooldowns.celerityMax;
          active = hud.isCelerity;
          break;
        case 'shadowLeap':
          cd = hud.cooldowns.shadowLeap;
          cdMax = hud.cooldowns.shadowLeapMax;
          break;
        case 'shadowThrow':
          cd = hud.cooldowns.shadowThrow;
          cdMax = hud.cooldowns.shadowThrowMax;
          break;
        case 'shadowDecoy':
          cd = hud.cooldowns.shadowDecoy;
          cdMax = hud.cooldowns.shadowDecoyMax;
          active = hud.isShadowDecoyActive;
          break;
        case 'darknessPulse':
          cd = hud.cooldowns.darknessPulse;
          cdMax = hud.cooldowns.darknessPulseMax;
          break;
      }

      return {
        id: power.id,
        key: formatKeyCodeLabel(hud.hotkeys[power.id]),
        name: power.shortName,
        bloodCost: power.bloodCostValue,
        unlocked,
        cd,
        cdMax: Math.max(0.1, cdMax),
        active,
      };
    });

  const openNorm =
    hud.alertLevel === 'hunted'
      ? 1
      : hud.alertLevel === 'caution'
      ? Math.max(0.68, hud.exposure / 100)
      : hud.alertLevel === 'curious'
      ? Math.max(0.42, hud.exposure / 100)
      : hud.isInShadow
      ? 0.04
      : Math.max(0.65, Math.min(1, hud.exposure / 100));
  const lidDelta = 0.8 + openNorm * 11.8;
  const pupilR = 1.8 + openNorm * 4.4;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Subtle peripheral shadow framing synchronized with deep-shadow immersion */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-200"
        style={{
          opacity: shadowStrength * 0.55,
          background:
            'radial-gradient(circle at center, transparent 54%, rgba(6, 8, 20, 0.55) 84%, rgba(2, 3, 10, 0.92) 100%)',
        }}
      />

      {/* Subtle sunlight burn perimeter glow when Dawn arrives outside the Crypt */}
      {hud.isDawnBurn && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 60%, rgba(217, 119, 6, 0.22) 86%, rgba(185, 28, 28, 0.45) 100%)',
          }}
        />
      )}

      {/* Top Perimeter Row */}
      <div className="relative flex items-start justify-between gap-4">
        {/* Top-Left: Minimal Gothic Vitals */}
        <div className={`w-60 md:w-64 border p-2.5 transition-colors duration-200 ${panelClass}`}>
          {/* Night, Dawn Clock & Prey Header */}
          <div
            className={`flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] mb-2 pb-1.5 border-b ${
              deepShadow ? 'text-[#dbe4ff] border-[#3d4870]' : 'text-[#9aa4c2] border-[#1d2233]'
            }`}
          >
            <span className={`font-gothic ${deepShadow ? 'text-[#ffffff]' : 'text-[#e7e2d8]'}`}>
              Noite {hud.nightNumber}
            </span>
            <span
              className={`tabular-nums text-[10px] px-1.5 py-0.5 border ${
                hud.isDawnBurn
                  ? 'border-[#ef4444] bg-[#450a0a]/90 text-[#fde047] font-semibold'
                  : hud.isDawnApproaching
                  ? 'border-[#d97706] bg-[#2a1707]/80 text-[#fcd34d]'
                  : deepShadow
                  ? 'border-[#3d4870] text-[#cbd5e1]'
                  : 'border-[#252b40] text-[#94a3b8]'
              }`}
              title={
                hud.isDawnBurn
                  ? 'Aurora (05:00) — Retorne imediatamente à Cripta!'
                  : hud.isDawnApproaching
                  ? 'Alvorada próxima (05:00 - Aurora)'
                  : 'Ciclo da Noite (00:00 até 05:00 - Aurora)'
              }
            >
              {hud.isDawnBurn ? `${hud.nightClockText} · Aurora!` : hud.nightClockText}
            </span>
            <span className="tabular-nums flex items-center gap-1" title="Presas da Noite">
              <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
                <path d="M8 1.5C8 1.5 3.5 6.8 3.5 10A4.5 4.5 0 0 0 12.5 10C12.5 6.8 8 1.5 8 1.5Z" fill="#dc2626" />
              </svg>
              <strong className={deepShadow ? 'text-[#ff6b6b]' : 'text-[#ef4444]'}>
                {hud.killsThisNight}/{hud.quotaThisNight}
              </strong>
            </span>
          </div>

          {/* Night Progression Bar (00:00 -> 05:00 Aurora) */}
          <div className="mb-2" title="Avanço da Noite até 05:00 - Aurora">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] mb-0.5 text-[#94a3b8]">
              <span>00:00</span>
              <span
                className={
                  hud.isDawnBurn
                    ? 'text-[#f87171] font-semibold'
                    : hud.isDawnApproaching
                    ? 'text-[#fbbf24]'
                    : 'text-[#818cf8]'
                }
              >
                {hud.isDawnBurn ? 'Aurora Ativa' : hud.isDawnApproaching ? 'Alvorada Próxima' : 'Vigília Noturna'}
              </span>
              <span>05:00</span>
            </div>
            <div className={`h-1 border overflow-hidden ${barTrackClass}`}>
              <div
                className={`h-full transition-all duration-200 ${
                  hud.isDawnBurn
                    ? 'bg-gradient-to-r from-[#f59e0b] to-[#ef4444]'
                    : hud.isDawnApproaching
                    ? 'bg-gradient-to-r from-[#6366f1] via-[#d97706] to-[#fbbf24]'
                    : 'bg-gradient-to-r from-[#312e81] via-[#4f46e5] to-[#818cf8]'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, hud.nightProgress * 100))}%` }}
              />
            </div>
          </div>

          {/* Blood Reservoir */}
          <div className="mb-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className={deepShadow ? 'text-[#fecaca]' : 'text-[#fca5a5]'}>Sangue</span>
                {hud.powerRegenRemaining > 0 && (
                  <span
                    className="text-[9px] px-1 border border-[#34d399]/60 bg-[#052e23]/80 text-[#6ee7b7] tabular-nums"
                    title="Regeneração de Sangue e recarga de poderes dobrada"
                  >
                    +{hud.powerRegenRemaining}s Poder
                  </span>
                )}
              </div>
              <span className={`tabular-nums ${deepShadow ? 'text-white font-semibold' : 'text-[#d4cfc7]'}`}>
                {hud.blood}
              </span>
            </div>
            <div className={`h-2 border overflow-hidden ${barTrackClass}`}>
              <div
                className="h-full bg-gradient-to-r from-[#991b1b] to-[#f87171] transition-all duration-100"
                style={{ width: `${bloodPct}%` }}
              />
            </div>
          </div>

          {/* Health */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-0.5">
              <span className={deepShadow ? 'text-[#f1f5f9]' : 'text-[#cbd5e1]'}>Vitalidade</span>
              <span className={`tabular-nums ${deepShadow ? 'text-white font-semibold' : 'text-[#d4cfc7]'}`}>
                {hud.health}
              </span>
            </div>
            <div className={`h-1.5 border overflow-hidden ${barTrackClass}`}>
              <div
                className={`h-full transition-all duration-100 ${deepShadow ? 'bg-[#e2e8f0]' : 'bg-[#94a3b8]'}`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          {/* Diegetic Icon Strip: Noise, Suspicion, Bells, Weather */}
          <div
            className={`pt-1.5 border-t flex items-center justify-between gap-2 ${
              deepShadow ? 'border-[#3d4870]' : 'border-[#1d2233]'
            }`}
          >
            {/* Compact Acoustic Bar */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title="Ruído">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                <path
                  d="M2 6V10H5L9 13V3L5 6H2Z"
                  fill={hud.noiseLevel >= 65 ? '#ef4444' : hud.noiseLevel >= 30 ? '#facc15' : '#64748b'}
                />
                {hud.noiseLevel >= 25 && (
                  <path
                    d="M11 5.5C12.2 6.8 12.2 9.2 11 10.5"
                    fill="none"
                    stroke={hud.noiseLevel >= 65 ? '#ef4444' : '#facc15'}
                    strokeWidth="1.4"
                  />
                )}
              </svg>
              <div className={`h-1 flex-1 border overflow-hidden ${barTrackClass}`}>
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${Math.min(100, Math.max(0, hud.noiseLevel))}%`,
                    backgroundColor:
                      hud.noiseLevel >= 65 ? '#ef4444' : hud.noiseLevel >= 30 ? '#facc15' : '#6366f1',
                  }}
                />
              </div>
            </div>

            {/* Compact Suspicion Gauge */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title={`Suspeita: ${hud.suspicionTier}`}>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                <path
                  d="M8 2L13 4.2V8.2C13 11.4 10.9 13.7 8 14.6C5.1 13.7 3 11.4 3 8.2V4.2L8 2Z"
                  fill="none"
                  stroke={
                    hud.globalSuspicion >= 50
                      ? '#ef4444'
                      : hud.globalSuspicion >= 25
                      ? '#eab308'
                      : '#64748b'
                  }
                  strokeWidth="1.5"
                />
              </svg>
              <div className={`h-1 flex-1 border overflow-hidden ${barTrackClass}`}>
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${hud.globalSuspicion}%`,
                    backgroundColor:
                      hud.globalSuspicion >= 75
                        ? '#dc2626'
                        : hud.globalSuspicion >= 50
                        ? '#f97316'
                        : hud.globalSuspicion >= 25
                        ? '#eab308'
                        : '#6366f1',
                  }}
                />
              </div>
            </div>

            {/* Bells Icon Count */}
            <span
              className={`flex items-center gap-1 text-[10px] tabular-nums shrink-0 ${
                deepShadow ? 'text-[#dbe4ff]' : 'text-[#8c95b2]'
              }`}
              title="Sinos Sabotados"
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
                <path
                  d="M8 2.2A3.6 3.6 0 0 0 4.4 5.8V9.2L3 11.5H13L11.6 9.2V5.8A3.6 3.6 0 0 0 8 2.2Z"
                  fill="none"
                  stroke={hud.bellsSabotaged > 0 ? '#94b8ff' : '#64748b'}
                  strokeWidth="1.4"
                />
                <circle cx="8" cy="13" r="1.1" fill={hud.bellsSabotaged > 0 ? '#94b8ff' : '#64748b'} />
              </svg>
              {hud.bellsSabotaged}/{hud.totalBells}
            </span>

            {/* Weather Icon Only */}
            <span className="shrink-0" title={hud.weatherLabel}>
              {hud.weather === 'rain' ? (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M4 10L2.5 14M8 9L6.5 14M12 10L10.5 14" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3.5 7.5A2.5 2.5 0 0 1 5.8 3.6A3.2 3.2 0 0 1 11.8 4.4A2.2 2.2 0 0 1 12.5 8.5H4.2Z" fill="#93c5fd" opacity="0.85" />
                </svg>
              ) : hud.weather === 'fog' ? (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M2 5H13M4 8.5H14M2.5 12H11.5" stroke="#a5b4fc" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M9.8 2.2A5.8 5.8 0 1 0 13.8 11.4A4.6 4.6 0 1 1 9.8 2.2Z" fill="#cbd5e1" />
                </svg>
              )}
            </span>
          </div>

          {/* District & Regional Infamy */}
          <div
            className={`mt-1.5 pt-1.5 border-t flex items-center justify-between gap-2 text-[10px] ${
              deepShadow ? 'border-[#3d4870] text-[#dbe4ff]' : 'border-[#1d2233] text-[#94a0bd]'
            }`}
            title="Distrito Atual e Infâmia Regional"
          >
            <span className="truncate">{hud.currentDistrictName}</span>
            <span
              className={`tabular-nums shrink-0 font-semibold ${
                hud.isInSafeSanctuary
                  ? 'text-[#a5b4fc]'
                  : hud.isInSafeCemetery
                  ? 'text-[#6ee7b7]'
                  : hud.currentDistrictInfamy >= 45
                  ? 'text-[#ef4444]'
                  : hud.currentDistrictInfamy >= 25
                  ? 'text-[#facc15]'
                  : 'text-[#818cf8]'
              }`}
            >
              {hud.isInSafeSanctuary
                ? 'Cripta Segura'
                : hud.isInSafeCemetery
                ? 'Cemitério Seguro'
                : `Infâmia ${hud.currentDistrictInfamy}%`}
            </span>
          </div>

          {/* Concise Night Objective + Subtle Crypt Direction/Distance Compass */}
          <div
            className={`mt-1 pt-1 border-t flex items-center justify-between gap-2 text-[10px] ${
              deepShadow ? 'border-[#3d4870]' : 'border-[#1d2233]'
            }`}
          >
            {hud.canCompleteNight ? (
              <span className="text-[#86efac] font-semibold truncate">
                Retornar à Cripta · Caixão [E]
              </span>
            ) : (
              <span className="text-[#94a0bd] truncate">
                Alvo: <strong className="text-[#fcd34d] font-normal">{hud.mainTargetName}</strong>
              </span>
            )}

            {hud.showCryptCompass ? (
              <span
                className={`shrink-0 flex items-center gap-1 tabular-nums text-[10px] ${
                  hud.isDawnBurn
                    ? 'text-[#fde047] font-semibold'
                    : hud.isDawnApproaching
                    ? 'text-[#fcd34d]'
                    : hud.canCompleteNight
                    ? 'text-[#86efac]'
                    : 'text-[#a5b4fc]'
                }`}
                title={
                  hud.isInSafeSanctuary
                    ? 'Direção e distância até o Caixão da Cripta'
                    : 'Direção e distância até a Cripta no Adro da Catedral Norte'
                }
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-3 h-3 shrink-0 transition-transform duration-100"
                  style={{ transform: `rotate(${hud.cryptBearingDeg}deg)` }}
                  aria-hidden="true"
                >
                  <path d="M8 1.5L13 13.5L8 10.8L3 13.5Z" fill="currentColor" />
                </svg>
                <span>{hud.isInSafeSanctuary ? 'Caixão' : 'Cripta'}</span>
                <span>{hud.cryptDistance}m</span>
              </span>
            ) : (
              !hud.canCompleteNight && (
                <span
                  className={`shrink-0 text-[9px] uppercase tracking-wider ${
                    hud.mainTargetDefeated ? 'text-[#86efac]' : 'text-[#fca5a5]'
                  }`}
                >
                  {hud.mainTargetDefeated ? 'Abatido' : 'Ativo'}
                </span>
              )
            )}
          </div>
        </div>

        {/* Discrete Return-to-Crypt Strip when Dawn is Near / Active or Night Objective Met */}
        {(hud.isDawnApproaching || hud.isDawnBurn || hud.canCompleteNight) &&
          !(hud.isInSafeSanctuary && hud.cryptDistance <= 3) && (
            <div
              className={`mt-1.5 w-60 md:w-64 px-2.5 py-1.5 border flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                hud.isDawnBurn
                  ? 'bg-[#2a070b]/94 border-[#ef4444] text-[#fde047]'
                  : hud.isDawnApproaching
                  ? 'bg-[#211306]/92 border-[#d97706] text-[#fcd34d]'
                  : 'bg-[#081512]/90 border-[#2e6f56] text-[#86efac]'
              }`}
            >
              <span className="truncate font-semibold">
                {hud.isDawnBurn
                  ? 'Aurora · Volte à Cripta!'
                  : hud.isDawnApproaching
                  ? 'Amanhecer · Volte à Cripta'
                  : hud.isInSafeSanctuary
                  ? 'Repousar no Caixão [E]'
                  : 'Cota Pronta · Cripta [E]'}
              </span>
              <span className="shrink-0 flex items-center gap-1 tabular-nums">
                <svg
                  viewBox="0 0 16 16"
                  className="w-3 h-3 shrink-0 transition-transform duration-100"
                  style={{ transform: `rotate(${hud.cryptBearingDeg}deg)` }}
                  aria-hidden="true"
                >
                  <path d="M8 1.5L13 13.5L8 10.8L3 13.5Z" fill="currentColor" />
                </svg>
                <span>{hud.cryptDistance}m</span>
              </span>
            </div>
          )}

        {/* Top-Right: Essence & Quick Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className={`px-3 py-1.5 flex items-center gap-2 border transition-colors duration-200 ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#7c8cff] shadow-[0_0_0_1px_rgba(165,180,252,0.32)]'
                : 'bg-[#080a12]/88 border-[#3a2832]'
            }`}
            title={
              hud.pendingEssence > 0
                ? `Essência Consolidada: ${hud.essence} · Pendente nesta noite: +${hud.pendingEssence} (retorne ao Caixão na Cripta para consolidar)`
                : 'Essência Sanguínea Consolidada'
            }
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
              <polygon points="8,1 14,8 8,15 2,8" fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
            </svg>
            <span className="text-sm font-semibold tabular-nums text-white">{hud.essence}</span>
            {hud.pendingEssence > 0 && (
              <span className="text-[11px] font-semibold tabular-nums text-[#fcd34d]">
                +{hud.pendingEssence}
              </span>
            )}
          </div>

          <button
            onClick={onOpenGrimoire}
            className={`flex items-center gap-1.5 px-3 py-2 border text-xs uppercase tracking-[0.14em] transition-colors cursor-pointer ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#7c8cff] hover:border-[#f87171] text-white'
                : 'bg-[#080a12]/88 border-[#3a3f58] hover:border-[#ef4444] text-[#e7e2d8]'
            }`}
            title="Grimório (Tab)"
          >
            <BookOpen className="w-4 h-4 text-[#ef4444]" />
            <span className="hidden sm:inline">Grimório</span>
          </button>

          <button
            onClick={onToggleMute}
            className={`p-2 border transition-colors cursor-pointer ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#7c8cff] hover:border-white text-white'
                : 'bg-[#080a12]/88 border-[#2b3147] hover:border-[#94b8ff] text-[#cbd5e1]'
            }`}
            aria-label={muted ? 'Ativar som' : 'Silenciar som'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-[#ef4444]" /> : <Volume2 className="w-4 h-4 text-[#94b8ff]" />}
          </button>

          <button
            onClick={onPause}
            className={`p-2 border transition-colors cursor-pointer ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#7c8cff] hover:border-white text-white'
                : 'bg-[#080a12]/88 border-[#2b3147] hover:border-[#e7e2d8] text-[#cbd5e1]'
            }`}
            aria-label="Pausar (Esc)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Status Banner (subtle, non-blocking) */}
      <div className="relative flex flex-col items-center justify-center gap-2 my-auto pointer-events-none">
        {hud.statusBanner && (
          <div
            className={`px-4 py-1.5 border text-xs md:text-sm font-gothic tracking-[0.12em] ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#ef4444] text-white shadow-[0_0_0_1px_rgba(248,113,113,0.35)]'
                : 'bg-[#080a12]/90 border-[#7f1d1d] text-[#f3e8e8]'
            }`}
          >
            {hud.statusBanner}
          </div>
        )}
      </div>

      {/* Bottom Perimeter: Feeding Feedback + Context Prompt + Diegetic Eye Visibility Marker + Compact Ability Dock */}
      <div className="relative flex flex-col items-center gap-2">
        {hud.isFeeding && hud.feedTargetName && (
          <div
            className={`w-64 px-3 py-1.5 border shadow-lg transition-colors duration-150 ${
              deepShadow
                ? 'bg-[#03050b]/96 border-[#ef4444] text-white'
                : 'bg-[#080a12]/94 border-[#991b1b] text-[#fde8e8]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 -rotate-90" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#2a1218" strokeWidth="2.4" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.4"
                    strokeDasharray={56.55}
                    strokeDashoffset={56.55 * (1 - Math.max(0, Math.min(1, hud.feedProgress)))}
                    strokeLinecap="butt"
                  />
                </svg>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#fca5a5] truncate">
                    {hud.feedMethodLabel ?? 'O Beijo'}
                  </div>
                  <div className="text-xs font-gothic truncate text-white">{hud.feedTargetName}</div>
                </div>
              </div>
              <span className="text-[11px] tabular-nums font-semibold text-[#fca5a5] shrink-0">
                {Math.round(Math.max(0, Math.min(1, hud.feedProgress)) * 100)}%
              </span>
            </div>
            <div className={`h-1.5 border overflow-hidden ${barTrackClass}`}>
              <div
                className="h-full bg-gradient-to-r from-[#7f1d1d] via-[#dc2626] to-[#f87171] transition-all duration-75"
                style={{ width: `${Math.round(Math.max(0, Math.min(1, hud.feedProgress)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {hud.contextPrompt && (
          <div
            className={`px-3.5 py-1 border text-xs uppercase tracking-[0.14em] flex items-center gap-2 shadow-md ${
              deepShadow
                ? 'bg-[#03050b]/98 border-[#ef4444] text-white shadow-[0_0_0_1px_rgba(248,113,113,0.4)]'
                : 'bg-[#090b14]/95 border-[#b91c1c] text-[#fde8e8]'
            }`}
          >
            <span className="px-1.5 py-0.5 bg-[#b91c1c] text-white font-bold text-[11px]">
              {hud.contextPrompt.keyHint}
            </span>
            <span>{hud.contextPrompt.label}</span>
          </div>
        )}

        {/* Pure Diegetic Eye of Visibility (No text clutter) */}
        <div
          className={`px-3 py-1 border flex items-center justify-center transition-colors duration-150 ${panelClass}`}
          title={eyeTitle}
        >
          <svg viewBox="0 0 48 28" className="w-11 h-5" aria-label={eyeTitle}>
            <path
              d={`M2 14 Q24 ${14 - lidDelta} 46 14 Q24 ${14 + lidDelta} 2 14 Z`}
              fill="#04060e"
              stroke={exposureColor}
              strokeWidth="2"
            />
            {openNorm > 0.16 && (
              <circle cx="24" cy="14" r={pupilR} fill={exposureColor} opacity="0.92" />
            )}
            {openNorm > 0.28 && (
              <ellipse cx="24" cy="14" rx={Math.max(1.2, pupilR * 0.34)} ry={pupilR * 0.85} fill="#04060e" />
            )}
          </svg>
        </div>

        <div className={`flex flex-wrap justify-center items-center gap-1.5 border px-2 py-1.5 transition-colors duration-200 ${panelClass}`}>
          {skillSlots.map((slot) => {
            const locked = !slot.unlocked;
            const onCd = slot.cd > 0.05;
            const cdPct = onCd ? Math.min(100, (slot.cd / slot.cdMax) * 100) : 0;
            return (
              <div
                key={slot.id}
                className={`relative w-20 md:w-22 px-1.5 py-1 border text-left ${
                  locked
                    ? deepShadow
                      ? 'border-[#333c5e] bg-[#060811] opacity-50'
                      : 'border-[#1d2233] bg-[#0a0c15] opacity-40'
                    : slot.active
                    ? 'border-[#ef4444] bg-[#2a0c12]'
                    : deepShadow
                    ? 'border-[#5a6799] bg-[#0a0e1b]'
                    : 'border-[#323952] bg-[#0f1322]'
                }`}
              >
                {onCd && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#05070e]/75 pointer-events-none"
                    style={{ height: `${cdPct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <span className={deepShadow ? 'text-[#c7d2fe] font-semibold' : 'text-[#94b8ff] font-semibold'}>
                    [{slot.key}]
                  </span>
                  <span className={`tabular-nums ${deepShadow ? 'text-[#e2e8f0]' : 'text-[#9aa4c2]'}`}>
                    {locked ? '—' : onCd ? `${slot.cd.toFixed(1)}s` : `${slot.bloodCost}S`}
                  </span>
                </div>
                <div className={`relative text-[10px] truncate mt-0.5 ${deepShadow ? 'text-white' : 'text-[#e7e2d8]'}`}>
                  {slot.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
