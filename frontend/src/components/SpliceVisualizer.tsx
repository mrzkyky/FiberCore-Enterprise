import React from 'react';

interface Splice {
  splice_id: string;
  core_a: { tube_number: number, core_number: number, color: string };
  core_b: { tube_number: number, core_number: number, color: string };
  attenuation: number;
}

export default function SpliceVisualizer({ splices }: { splices: Splice[] }) {
  const getStrokeColor = (color: string) => {
    const map: Record<string, string> = {
      Blue: '#3b82f6', Orange: '#f97316', Green: '#22c55e',
      Brown: '#92400e', Slate: '#94a3b8', White: '#e2e8f0',
      Red: '#ef4444', Black: '#1e293b', Yellow: '#facc15',
      Violet: '#a855f7', Rose: '#fb7185', Aqua: '#5eead4'
    };
    return map[color] || '#cbd5e1';
  };

  const SPACING = 40;
  
  if (!splices || splices.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto bg-[#0B1120] p-8 rounded-xl border border-dark-border mt-6">
      <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
        Splice Matrix Diagram
      </h3>
      <svg width={800} height={splices.length * SPACING + 40} className="mx-auto overflow-visible">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1}/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0.8}/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.1}/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Labels */}
        <text x="50" y="20" fill="#94a3b8" fontSize="12" fontWeight="bold">Cable A (IN)</text>
        <text x="750" y="20" fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="end">Cable B (OUT)</text>

        {splices.map((splice, i) => {
          const y = (i * SPACING) + 60;
          const strokeA = getStrokeColor(splice.core_a.color);
          const strokeB = getStrokeColor(splice.core_b.color);
          
          return (
            <g key={splice.splice_id} className="hover:opacity-80 transition-opacity cursor-pointer">
              {/* Nodes */}
              <circle cx="150" cy={y} r="6" fill={strokeA} stroke="#1e293b" strokeWidth="2" filter="url(#glow)"/>
              <circle cx="650" cy={y} r="6" fill={strokeB} stroke="#1e293b" strokeWidth="2" filter="url(#glow)"/>

              {/* Connecting Line (Splice) */}
              <path 
                d={`M 150 ${y} C 300 ${y}, 500 ${y}, 650 ${y}`} 
                fill="none" 
                stroke="url(#lineGrad)" 
                strokeWidth="2" 
                strokeDasharray="4,4"
              />
              <path 
                d={`M 150 ${y} C 300 ${y}, 500 ${y}, 650 ${y}`} 
                fill="none" 
                stroke={strokeA} 
                strokeWidth="1.5" 
                opacity="0.7"
              />

              {/* Loss Badge */}
              <rect x="375" y={y - 12} width="50" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
              <text x="400" y={y + 4} fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
                {splice.attenuation} dB
              </text>

              {/* Text A */}
              <text x="130" y={y + 4} fill="#e2e8f0" fontSize="12" textAnchor="end">
                T{splice.core_a.tube_number}-C{splice.core_a.core_number}
              </text>
              <text x="40" y={y + 4} fill="#64748b" fontSize="10" textAnchor="start">
                ({splice.core_a.color})
              </text>

              {/* Text B */}
              <text x="670" y={y + 4} fill="#e2e8f0" fontSize="12" textAnchor="start">
                T{splice.core_b.tube_number}-C{splice.core_b.core_number}
              </text>
              <text x="760" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                ({splice.core_b.color})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
