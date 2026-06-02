import React, { useState, useEffect } from 'react';

const FRAMES = [
  {
    label: 'Writing your recipe…',
    animation: (
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
        {/* Book */}
        <rect x="10" y="20" width="28" height="40" rx="3" fill="#6BAEE0" opacity="0.3" />
        <rect x="42" y="20" width="28" height="40" rx="3" fill="#6BAEE0" opacity="0.3" />
        <rect x="36" y="18" width="8" height="44" rx="2" fill="#4d96d1" />
        {/* Animated pen lines */}
        <line x1="16" y1="32" x2="32" y2="32" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;32;16" dur="1.2s" repeatCount="indefinite" />
        </line>
        <line x1="16" y1="39" x2="32" y2="39" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;28;16" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
        </line>
        <line x1="16" y1="46" x2="32" y2="46" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;30;16" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
        </line>
        {/* Pen */}
        <g>
          <animateTransform attributeName="transform" type="translate" values="0,0; 4,-2; 0,0" dur="0.6s" repeatCount="indefinite" />
          <rect x="28" y="24" width="5" height="14" rx="1" fill="#FFB347" transform="rotate(-30 30 30)" />
          <polygon points="28,38 33,38 30.5,44" fill="#FF7F50" transform="rotate(-30 30 30)" />
        </g>
      </svg>
    ),
  },
  {
    label: 'Chef is thinking…',
    animation: (
      <svg viewBox="0 0 100 100" className="w-24 h-24" fill="none">
        {/* Whole hat gently tilts */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-5,50,78; 5,50,78; -5,50,78" dur="1.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />

          {/* ── Brim ── */}
          <rect x="18" y="70" width="64" height="12" rx="6" fill="#6BAEE0" />
          <rect x="22" y="70" width="56" height="5" rx="2" fill="#4d96d1" />

          {/* ── Dome body ── */}
          <path d="M 32 72 L 30 52 C 28 32 35 16 50 14 C 65 16 72 32 70 52 L 68 72 Z" fill="white" />

          {/* Subtle shadow on dome sides */}
          <path d="M 32 72 L 30 52 C 29 40 30 28 36 20" stroke="#e2f0fb" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 68 72 L 70 52 C 71 40 70 28 64 20" stroke="#e2f0fb" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Pleat crease lines */}
          <line x1="40" y1="70" x2="38" y2="25" stroke="#e2f0fb" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="70" x2="50" y2="15" stroke="#e2f0fb" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="60" y1="70" x2="62" y2="25" stroke="#e2f0fb" strokeWidth="1.5" strokeLinecap="round" />

          {/* Top rounded puff */}
          <ellipse cx="50" cy="18" rx="14" ry="8" fill="white" />
          <ellipse cx="50" cy="15" rx="10" ry="6" fill="white" />

          {/* Steam dots above hat */}
          <circle cx="44" cy="8" r="2.5" fill="#6BAEE0" opacity="0.5">
            <animate attributeName="cy" values="8;2;8" dur="1.4s" begin="0s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1.4s" begin="0s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="5" r="2" fill="#6BAEE0" opacity="0.5">
            <animate attributeName="cy" values="5;-1;5" dur="1.4s" begin="0.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1.4s" begin="0.3s" repeatCount="indefinite" />
          </circle>
          <circle cx="56" cy="8" r="2.5" fill="#6BAEE0" opacity="0.5">
            <animate attributeName="cy" values="8;2;8" dur="1.4s" begin="0.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1.4s" begin="0.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    ),
  },
  {
    label: 'Stirring up something good…',
    animation: (
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
        {/* Pot */}
        <ellipse cx="40" cy="58" rx="24" ry="8" fill="#6BAEE0" opacity="0.3" />
        <path d="M16 42 Q16 68 40 68 Q64 68 64 42 Z" fill="#6BAEE0" />
        <rect x="14" y="38" width="52" height="8" rx="4" fill="#4d96d1" />
        {/* Handles */}
        <rect x="6" y="40" width="10" height="5" rx="2.5" fill="#4d96d1" />
        <rect x="64" y="40" width="10" height="5" rx="2.5" fill="#4d96d1" />
        {/* Bubbles */}
        <circle cx="30" cy="52" r="3" fill="white" opacity="0.4">
          <animate attributeName="cy" values="52;44;52" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="54" r="2.5" fill="white" opacity="0.4">
          <animate attributeName="cy" values="54;46;54" dur="1s" begin="0.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" begin="0.4s" repeatCount="indefinite" />
        </circle>
        {/* Spoon */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-20,40,45; 20,40,45; -20,40,45" dur="0.9s" repeatCount="indefinite" />
          <rect x="38" y="18" width="4" height="28" rx="2" fill="#FFB347" />
          <ellipse cx="40" cy="50" rx="5" ry="4" fill="#FFB347" />
        </g>
      </svg>
    ),
  },
];

export default function AiLoadingAnimation({ label }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 2000);
    return () => clearInterval(id);
  }, []);

  const { animation, label: frameLabel } = FRAMES[frame];

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5 animate-in fade-in duration-300">
      <div className="transition-all duration-500">
        {animation}
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-black text-slate-700">{label || frameLabel}</p>
        <div className="flex gap-1 justify-center">
          {FRAMES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === frame ? 'bg-[#6BAEE0] w-4' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
