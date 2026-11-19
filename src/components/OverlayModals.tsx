import type { HudSnapshot } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onOpenGrimoire: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({
  onResume,
  onOpenGrimoire,
  onRestart,
  onQuitToTitle,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#05070e]/85">
      <div className="w-full max-w-md bg-[#0b0e18] border border-[#323850] p-7 text-center shadow-2xl">
        <h2 className="font-gothic text-2xl tracking-[0.18em] uppercase text-[#f1ede4] mb-2">
          Caçada Pausada
        </h2>
        <p className="text-xs text-[#8e98b8] mb-6 tracking-wide">
          As sombras de Ravencroft aguardam seu próximo passo.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="py-3 bg-[#8f161b] hover:bg-[#b91c1c] text-white text-xs uppercase tracking-[0.18em] border border-[#ef4444]/60 cursor-pointer"
          >
            Continuar Caçada [Esc]
          </button>
          <button
            onClick={onOpenGrimoire}
            className="py-3 bg-[#121626] hover:bg-[#1a2036] text-[#e7e2d8] text-xs uppercase tracking-[0.18em] border border-[#333b56] cursor-pointer"
          >
            Abrir Grimório [Tab]
          </button>
          <button
            onClick={onRestart}
            className="py-3 bg-[#0e111d] hover:bg-[#161b2d] text-[#cbd5e1] text-xs uppercase tracking-[0.18em] border border-[#282e44] cursor-pointer"
          >
            Reiniciar Noite I
          </button>
          <button
            onClick={onQuitToTitle}
            className="py-2.5 text-[#8c95b2] hover:text-white text-xs uppercase tracking-[0.16em] cursor-pointer"
          >
            Voltar ao Título
          </button>
        </div>
      </div>
    </div>
  );
}

interface VictoryModalProps {
  hud: HudSnapshot;
  onNextNight: () => void;
  onOpenGrimoire: () => void;
}

export function VictoryModal({ hud, onNextNight, onOpenGrimoire }: VictoryModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#05070e]/88">
      <div className="w-full max-w-lg bg-[#0b0e18] border border-[#7f1d1d] p-8 text-center shadow-2xl">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#ef4444] mb-2">
          Domínio Noturno Alcançado
        </div>
        <h2 className="font-gothic text-3xl tracking-[0.14em] uppercase text-[#f8f5ef] mb-3">
          Noite {hud.nightNumber} Conquistada
        </h2>
        <p className="text-sm text-[#a6b0cc] mb-6">
          Você retornou ao caixão da Cripta antes da aurora, preservou sua Essência e consolidou seu território em Ravencroft.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-7 bg-[#080a12] border border-[#242a3d] p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8590ad]">Total Presas</div>
            <div className="text-xl font-bold tabular-nums text-[#f1ede4]">{hud.totalKills}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8590ad]">Nobres</div>
            <div className="text-xl font-bold tabular-nums text-[#fca5a5]">{hud.noblesDrained}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8590ad]">Essência</div>
            <div className="text-xl font-bold tabular-nums text-[#94b8ff]">{hud.essence}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onOpenGrimoire}
            className="flex-1 py-3 bg-[#131828] hover:bg-[#1c233a] text-[#e7e2d8] text-xs uppercase tracking-[0.16em] border border-[#3a425e] cursor-pointer"
          >
            Evoluir Poderes
          </button>
          <button
            onClick={onNextNight}
            className="flex-1 py-3 bg-[#8f161b] hover:bg-[#b91c1c] text-white text-xs uppercase tracking-[0.16em] border border-[#ef4444]/60 cursor-pointer"
          >
            Avançar para Noite {hud.nightNumber + 1}
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function GameOverModal({ hud, onRestart, onQuitToTitle }: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#080407]/90">
      <div className="w-full max-w-md bg-[#0e0a10] border border-[#991b1b] p-8 text-center shadow-2xl">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#ef4444] mb-2">
          Fim da Linhagem
        </div>
        <h2 className="font-gothic text-3xl tracking-[0.14em] uppercase text-[#f8f5ef] mb-3">
          Cinzas ao Luar
        </h2>
        <p className="text-sm text-[#c4b5bb] mb-6">
          {hud.deathReason ?? 'O predador sucumbiu nas ruas da cidade gótica.'}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-7 bg-[#09070b] border border-[#2d1e26] p-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9c8c94]">Noite</div>
            <div className="text-lg font-bold tabular-nums text-white">{hud.nightNumber}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9c8c94]">Vítimas</div>
            <div className="text-lg font-bold tabular-nums text-[#ef4444]">{hud.totalKills}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9c8c94]">Guardas</div>
            <div className="text-lg font-bold tabular-nums text-[#94b8ff]">{hud.guardsSlain}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="py-3 bg-[#8f161b] hover:bg-[#b91c1c] text-white text-xs uppercase tracking-[0.18em] border border-[#ef4444]/60 cursor-pointer"
          >
            Renascer nas Sombras
          </button>
          <button
            onClick={onQuitToTitle}
            className="py-2.5 text-[#a1959b] hover:text-white text-xs uppercase tracking-[0.16em] cursor-pointer"
          >
            Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
}
