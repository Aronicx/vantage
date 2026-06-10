"use client";

import React, { useState, useEffect } from 'react';
import { Country, Settlement, Point } from '@/app/lib/game-logic';
import { HeraldryIcon } from './HeraldryIcon';
import { MapPin, Shield, Building2, Radio } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  // Simple Voronoi is too complex for this prompt's scope without libraries, 
  // so we use a cluster-based visual representation of territories.
  // In a real game, D3-voronoi or similar would be used for crisp borders.
  
  return (
    <div className="relative w-full h-full bg-background overflow-hidden select-none map-container">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Defenitions for glow effects */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Ocean Graticule */}
        <g stroke="rgba(61, 188, 207, 0.05)" strokeWidth="1">
          {Array.from({ length: 20 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1={i * 50} y1="0" x2={i * 50} y2="1000" />
              <line x1="0" y1={i * 50} x2="1000" y2={i * 50} />
            </React.Fragment>
          ))}
        </g>

        {/* Territories */}
        {countries.map(c => (
          <g key={c.id} className="transition-all duration-500">
            {activeOverlays.borders && (
              <g>
                {c.points.map((p, i) => (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r={hoveredCountry === c.id ? 25 : 20} 
                    fill={c.color} 
                    fillOpacity={hoveredCountry === c.id ? 0.2 : 0.1}
                    className="transition-all duration-300"
                  />
                ))}
              </g>
            )}

            {/* Military Influence Overlay */}
            {activeOverlays.military && c.settlements.filter(s => s.type === 'outpost').map(s => (
              <circle 
                key={`${s.id}-reach`}
                cx={s.coords.x}
                cy={s.coords.y}
                r="80"
                fill="none"
                stroke={c.color}
                strokeWidth="1"
                strokeDasharray="4 4"
                className="animate-pulse-border"
                opacity="0.4"
              />
            ))}

            {/* Tactical Connections */}
            {activeOverlays.economic && (
              <g opacity="0.3">
                {c.settlements.slice(1).map((s, idx) => (
                  <line 
                    key={`${s.id}-conn`}
                    x1={c.center.x}
                    y1={c.center.y}
                    x2={s.coords.x}
                    y2={s.coords.y}
                    stroke={c.color}
                    strokeWidth="1"
                  />
                ))}
              </g>
            )}
          </g>
        ))}

        {/* Interactive Country Layer (Area Detection) */}
        {countries.map(c => (
          <circle 
            key={`${c.id}-area`}
            cx={c.center.x}
            cy={c.center.y}
            r="120"
            fill="transparent"
            onMouseEnter={() => setHoveredCountry(c.id)}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => onSelectCountry(c)}
            className="cursor-pointer"
          />
        ))}

        {/* Settlements Layer */}
        {countries.map(c => (
          <g key={`${c.id}-settlements`}>
            {c.settlements.map(s => (
              <g 
                key={s.id} 
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSettlement(s, c);
                }}
              >
                <circle 
                  cx={s.coords.x} 
                  cy={s.coords.y} 
                  r="6" 
                  fill={s.type === 'capital' ? '#FFFFFF' : c.color} 
                  className="transition-transform group-hover:scale-150"
                  filter="url(#glow)"
                />
                <circle 
                  cx={s.coords.x} 
                  cy={s.coords.y} 
                  r="12" 
                  fill="none" 
                  stroke={c.color} 
                  strokeWidth="1"
                  className="animate-ping"
                  style={{ animationDuration: '3s' }}
                />
                <text 
                  x={s.coords.x} 
                  y={s.coords.y + 20} 
                  textAnchor="middle" 
                  fill="#FFFFFF" 
                  fontSize="10" 
                  className="font-headline pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {s.name.toUpperCase()}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>

      {/* Dynamic Mini HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full pointer-events-none">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-accent uppercase font-headline">Status</span>
          <span className="text-xs text-white">READY</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-accent uppercase font-headline">Date</span>
          <span className="text-xs text-white font-code">2148.09.12</span>
        </div>
      </div>
    </div>
  );
};
