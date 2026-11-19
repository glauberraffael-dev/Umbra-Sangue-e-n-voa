import { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({ onStart, muted, onToggleMute }: TitleScreenProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none bg-gradient-to-r from-[#05070e]/92 via-[#05070e]/50 to-transparent">
      {/* Top Bar: Audio Toggle Only */}
      <div className="flex justify-end pointer-events-auto">
        <button
          onClick={onToggleMute}
          className="flex items-center gap-2 px-3 py-2 text-xs tracking-widest uppercase border border-[#3a3f58] bg-[#0b0e18]/90 text-[#c7cbe0] hover:border-[#b91c1c] hover:text-white transition-colors cursor-pointer"
          aria-label={muted ? 'Ativar som' : 'Silenciar som'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#ef4444]" /> : <Volume2 className="w-4 h-4 text-[#94b8ff]" />}
          <span>{muted ? 'Mudo' : 'Áudio'}</span>
        </button>
      </div>

      {/* Left/Center-Left Hero Lockup over calm negative space */}
      <div className="max-w-xl my-auto pointer-events-auto">
        {/* Bespoke Gothic Vampire Crest SVG */}
        <div className="mb-5">
          <svg
            viewBox="0 0 360 112"
            className="w-full max-w-[360px] h-auto overflow-visible"
            role="img"
            aria-label="UMBRA: Sangue e Névoa"
          >
            {/* Ornamental crescent & fangs emblem */}
            <g transform="translate(26, 48)">
              <path
                d="M0,-32 A32,32 0 1,0 24,20 A24,24 0 1,1 0,-32 Z"
                fill="#94b8ff"
                opacity="0.88"
              />
              <path
                d="M-5,-12 L0,24 L5,-12 L0,-4 Z"
                fill="#dc2626"
              />
              <path
                d="M-16,-2 L-10,12 L-7,-4 Z M16,-2 L10,12 L7,-4 Z"
                fill="#e7e2d8"
              />
            </g>

            {/* Title Typography */}
            <text
              x="76"
              y="52"
              fill="#f1ede4"
              fontFamily="Georgia, Times New Roman, serif"
              fontSize="44"
              fontWeight="700"
              letterSpacing="8"
            >
              UMBRA
            </text>
            <line x1="78" y1="64" x2="340" y2="64" stroke="#991b1b" strokeWidth="1.5" />
            <text
              x="79"
              y="84"
              fill="#b8c4e0"
              fontFamily="Georgia, Times New Roman, serif"
              fontSize="13.5"
              letterSpacing="5.2"
            >
              SANGUE &amp; NÉVOA
            </text>
          </svg>
        </div>

        <p className="text-sm md:text-base leading-relaxed text-[#b4bbd0] max-w-md mb-8">
          Percorra as vielas de Ravencroft sob o luar. Apague lampiões, oculte-se nas sombras,
          embosque nobres e guardas da Vigília e desperte poderes ancestrais no Grimório.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onStart}
            className="px-8 py-3.5 bg-[#8f161b] hover:bg-[#b91c1c] text-[#f8f5ef] font-gothic text-sm md:text-base uppercase tracking-[0.2em] border border-[#ef4444]/60 shadow-[0_0_24px_rgba(185,28,28,0.45)] transition-colors cursor-pointer"
          >
            Iniciar Caçada
          </button>
          <span className="text-xs uppercase tracking-[0.18em] text-[#838ca6]">
            Pressione Enter ou Espaço
          </span>
        </div>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="pt-4 border-t border-[#23283b]/80 flex items-center justify-between text-[11px] md:text-xs tracking-[0.12em] uppercase text-[#8f97b2]">
        <span>
          WASD Mover · Espaço Pular/Escalar · Shift/C Furtividade · X/Clique Garras · F Drenar · G Ocultar Corpo · Q Passo Sombrio · E Apagar/Sabotar Sino · V Sentido · R Morcegos · Tab Grimório
        </span>
      </div>
    </div>
  );
}
