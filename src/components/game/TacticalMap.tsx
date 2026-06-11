"use client";

import React from 'react';
import { Country, Alliance, Settlement } from '@/app/lib/game-logic';

interface MapProps {
  countries: Country[];
  alliances: Alliance[];
  selection: string[];
  onSelectCountry: (c: Country) => void;
}

export const TacticalMap: React.FC<MapProps> = ({ 
  countries, 
  alliances,
  selection,
  onSelectCountry, 
}) => {
  
  return (
    <div className="relative w-full h-full bg-[#E5F1F5] overflow-hidden select-none">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="organic-borders">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -18" 
              result="contrast" 
            />
            <feMorphology in="contrast" operator="dilate" radius="2" result="dilated" />
            <feComposite in="dilated" in2="contrast" operator="out" result="outline" />
            <feFlood floodColor="black" result="black" />
            <feComposite in="black" in2="outline" operator="in" result="stroke" />
            <feComposite in="SourceGraphic" in2="contrast" operator="atop" result="main" />
            <feMerge>
              <feMergeNode in="main" />
              <feMergeNode in="stroke" />
            </feMerge>
          </filter>

          <filter id="alliance-borders">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -18" 
              result="contrast" 
            />
            <feMorphology in="contrast" operator="dilate" radius="2.5" result="dilated" />
            <feComposite in="dilated" in2="contrast" operator="out" result="outline" />
            <feFlood floodColor="currentColor" result="flood" />
            <feComposite in="flood" in2="outline" operator="in" result="stroke" />
            <feComposite in="SourceGraphic" in2="contrast" operator="atop" result="main" />
            <feMerge>
              <feMergeNode in="main" />
              <feMergeNode in="stroke" />
            </feMerge>
          </filter>

          <filter id="settlement-glow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Territory Masses */}
        {countries.map(c => {
          const alliance = alliances.find(a => a.id === c.allianceId);
          return (
            <g 
              key={c.id} 
              filter={alliance ? "url(#alliance-borders)" : "url(#organic-borders)"} 
              className="cursor-pointer"
              color={alliance ? alliance.color : "black"}
              onClick={() => onSelectCountry(c)}
            >
              {c.points.map((p, i) => (
                <rect 
                  key={`${c.id}-p-${i}`} 
                  x={p.x - 3} 
                  y={p.y - 3} 
                  width={6} 
                  height={6} 
                  fill={c.color} 
                />
              ))}
            </g>
          );
        })}

        {/* Selection Indicator */}
        {selection.map(id => {
          const c = countries.find(x => x.id === id);
          if (!c) return null;
          return (
            <g key={`sel-${id}`} pointerEvents="none" filter="url(#organic-borders)">
              {c.points.map((p, i) => (
                <rect key={`sel-p-${i}`} x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1" />
              ))}
            </g>
          );
        })}

        {/* Cities & Checkpoints System */}
        {countries.map(c => (
          <g key={`${c.id}-infrastructure`} pointerEvents="none">
            {c.settlements.map(s => (
              <g key={s.id} filter="url(#settlement-glow)">
                {s.type === 'capital' ? (
                  // Capital Icon (Star-like)
                  <path 
                    d={`M ${s.coords.x} ${s.coords.y-5} L ${s.coords.x+1.5} ${s.coords.y-1.5} L ${s.coords.x+5} ${s.coords.y} L ${s.coords.x+1.5} ${s.coords.y+1.5} L ${s.coords.x} ${s.coords.y+5} L ${s.coords.x-1.5} ${s.coords.y+1.5} L ${s.coords.x-5} ${s.coords.y} L ${s.coords.x-1.5} ${s.coords.y-1.5} Z`}
                    fill="white"
                    stroke="black"
                    strokeWidth="1.5"
                  />
                ) : (
                  // City / Outpost Dot
                  <circle 
                    cx={s.coords.x} 
                    cy={s.coords.y} 
                    r={s.type === 'city' ? 2.5 : 1.5} 
                    fill={s.type === 'city' ? "black" : "rgba(0,0,0,0.6)"}
                    stroke="white"
                    strokeWidth="1"
                  />
                )}
              </g>
            ))}
            
            <text 
              x={c.center.x} 
              y={c.center.y} 
              textAnchor="middle" 
              className="font-headline font-bold text-[8px] uppercase tracking-[0.2em] fill-black pointer-events-none"
              style={{ textShadow: '0 0 4px white, 0 0 4px white' }}
            >
              {c.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
