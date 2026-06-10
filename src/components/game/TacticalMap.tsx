"use client";

import React, { useState } from 'react';
import { Country, Settlement } from '@/app/lib/game-logic';
import { Shield, MapPin, Building2 } from 'lucide-react';

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
    <div className="relative w-full h-full bg-[#0a0c10] overflow-hidden select-none map-container">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Global Grid Overlay */}
        <g stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5">
          {Array.from({ length: 40 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1={i * 25} y1="0" x2={i * 25} y2="1000" />
              <line x1="0" y1={i * 25} x2="1000" y2={i * 25} />
            </React.Fragment>
          ))}
        </g>

        {/* Territory Blobs - Render dynamic points */}
        {countries.map(c => (
          <g key={c.id}>
            {activeOverlays.borders && c.points.map((p, i) => (
              <circle 
                key={`${c.id}-p-${i}`} 
                cx={p.x} 
                cy={p.y} 
                r={26} // Slightly larger for better overlap coverage
                fill={c.color} 
                fillOpacity={hoveredCountry === c.id ? 0.18 : 0.1}
                className="transition-all duration-700 ease-in-out" // Slower transition for "gradual" feel
              />
            ))}
          </g>
        ))}

        {/* Interaction layer for countries */}
        {countries.map(c => (
          <circle 
            key={`${c.id}-hitzone`}
            cx={c.center.x}
            cy={c.center.y}
            r="150"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredCountry(c.id)}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => onSelectCountry(c)}
          />
        ))}

        {/* Settlements */}
        {countries.flatMap(c => c.settlements).map(s => {
          // Find the current owner's color
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
              {/* Pulse effect for captured/warring areas */}
              <circle 
                cx={s.coords.x} 
                cy={s.coords.y} 
                r={s.type === 'capital' ? 18 : 12} 
                fill={owner.color}
                fillOpacity="0.1"
                className="animate-pulse"
              />

              <circle 
                cx={s.coords.x} 
                cy={s.coords.y} 
                r={s.type === 'capital' ? 14 : 8} 
                fill="none" 
                stroke={owner.color} 
                strokeWidth="2"
                className="transition-colors duration-500"
              />

              <g transform={`translate(${s.coords.x - 6}, ${s.coords.y - 6})`}>
                {s.type === 'capital' && <Building2 size={12} className="text-white" strokeWidth={2.5} />}
                {s.type === 'city' && <MapPin size={10} className="text-white/80" strokeWidth={2} />}
                {s.type === 'outpost' && <Shield size={10} className="text-accent" strokeWidth={2} />}
              </g>

              {/* Label */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <rect 
                  x={s.coords.x - 40} 
                  y={s.coords.y - 35} 
                  width={80} 
                  height={18} 
                  rx={4} 
                  fill="black" 
                  fillOpacity={0.9} 
                />
                <text 
                  x={s.coords.x} 
                  y={s.coords.y - 22} 
                  textAnchor="middle" 
                  fill="white" 
                  fontSize="9" 
                  className="font-headline tracking-tighter uppercase"
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
