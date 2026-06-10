"use client";

import React, { useState } from 'react';
import { Country, Settlement } from '@/app/lib/game-logic';
import { Building2, MapPin, Shield } from 'lucide-react';

interface MapProps {
  countries: Country[];
  activeOverlays: {
    borders: boolean;
    military: boolean;
    economic: boolean;
  };
  onSelectCountry: (c: Country) => void;
  onSelectSettlement: (s: Settlement, c: Country) => void;
}

export const TacticalMap: React.FC<MapProps> = ({ 
  countries, 
  activeOverlays, 
  onSelectCountry, 
  onSelectSettlement 
}) => {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  return (
    <div className="relative w-full h-full bg-[#87CEEB] overflow-hidden select-none map-container">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Territory Blobs with Black Borders */}
        {countries.map(c => (
          <g key={c.id}>
            {c.points.map((p, i) => (
              <circle 
                key={`${c.id}-p-${i}`} 
                cx={p.x} 
                cy={p.y} 
                r={22} 
                fill={c.color} 
                fillOpacity={hoveredCountry === c.id ? 1 : 0.85}
                stroke="#000000"
                strokeWidth="0.5"
                className="transition-all duration-500 ease-in-out"
              />
            ))}
          </g>
        ))}

        {/* Labels Layer (Drawn after colors so they stay on top) */}
        {countries.map(c => (
          <g key={`${c.id}-label`} className="pointer-events-none">
            <text 
              x={c.center.x} 
              y={c.center.y + 35} 
              textAnchor="middle" 
              className="country-label fill-black/60 text-[10px]"
            >
              {c.name}
            </text>
          </g>
        ))}

        {/* Interaction layer */}
        {countries.map(c => (
          <circle 
            key={`${c.id}-hitzone`}
            cx={c.center.x}
            cy={c.center.y}
            r="80"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredCountry(c.id)}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => onSelectCountry(c)}
          />
        ))}

        {/* Settlements */}
        {countries.flatMap(c => c.settlements).map(s => {
          const owner = countries.find(c => c.id === s.ownerId) || countries.find(c => c.settlements.some(cs => cs.id === s.id));
          if (!owner) return null;

          return (
            <g 
              key={s.id} 
              className="cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSettlement(s, owner);
              }}
            >
              <circle 
                cx={s.coords.x} 
                cy={s.coords.y} 
                r={s.type === 'capital' ? 12 : 8} 
                fill="white"
                stroke="#000"
                strokeWidth="1.5"
              />
              <g transform={`translate(${s.coords.x - 5}, ${s.coords.y - 5})`}>
                {s.type === 'capital' && <Building2 size={10} className="text-black" strokeWidth={2.5} />}
                {s.type === 'city' && <MapPin size={10} className="text-black/70" strokeWidth={2} />}
              </g>

              {/* Interaction label */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <rect 
                  x={s.coords.x - 30} 
                  y={s.coords.y - 25} 
                  width={60} 
                  height={14} 
                  rx={2} 
                  fill="white" 
                  stroke="#000"
                  strokeWidth="0.5"
                />
                <text 
                  x={s.coords.x} 
                  y={s.coords.y - 15} 
                  textAnchor="middle" 
                  fill="black" 
                  fontSize="7" 
                  className="font-headline uppercase font-bold"
                >
                  {s.name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
