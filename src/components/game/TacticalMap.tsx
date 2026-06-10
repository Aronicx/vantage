"use client";

import React from 'react';
import { Country, Alliance, Settlement, Province } from '@/app/lib/game-logic';
import { Landmark, Building2, ShieldAlert } from 'lucide-react';

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
  
  const getDisplayColor = (c: Country) => {
    if (alliances.length > 0) {
      const alliance = alliances.find(a => a.countryIds.includes(c.id));
      if (alliance) return alliance.color;
    }
    return c.color;
  };

  return (
    <div className="relative w-full h-full bg-[#E5F1F5] overflow-hidden select-none">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Territory Polygons */}
        {countries.map(c => {
          const color = getDisplayColor(c);
          const isSelected = selection.includes(c.id);
          
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
              {/* Internal Provinces */}
              {c.provinces.map((prov, pidx) => (
                <g key={`${c.id}-prov-${pidx}`}>
                  {prov.points.map((p, i) => (
                    <rect 
                      key={`${c.id}-p-${i}`} 
                      x={p.x - 5} 
                      y={p.y - 5} 
                      width={10.5} 
                      height={10.5} 
                      fill={color} 
                    />
                  ))}
                  {/* Subtle province boundaries */}
                  {prov.points.map((p, i) => (
                    <rect 
                      key={`${c.id}-pb-${i}`} 
                      x={p.x - 5} 
                      y={p.y - 5} 
                      width={10.5} 
                      height={10.5} 
                      fill="none" 
                      stroke="rgba(0,0,0,0.08)"
                      strokeWidth="0.4"
                    />
                  ))}
                </g>
              ))}

              {/* Country Highlight Overlay */}
              <g opacity={isSelected ? 1 : 0.8}>
                {c.points.map((p, i) => (
                  <rect 
                    key={`${c.id}-outline-${i}`} 
                    x={p.x - 5} 
                    y={p.y - 5} 
                    width={10.5} 
                    height={10.5} 
                    fill="none" 
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="0.3"
                  />
                ))}
              </g>
            </g>
          );
        })}

        {/* Crisp Selection Outline */}
        {selection.map(id => {
          const c = countries.find(curr => curr.id === id);
          if (!c) return null;
          return (
            <g key={`selection-${id}`} className="pointer-events-none">
              {c.points.map((p, i) => (
                <rect 
                  key={`sel-p-${i}`} 
                  x={p.x - 6} 
                  y={p.y - 6} 
                  width={12} 
                  height={12} 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2"
                  strokeOpacity="0.6"
                />
              ))}
            </g>
          );
        })}

        {/* Labels & Landmarks */}
        {countries.map(c => (
          <React.Fragment key={`${c.id}-entities`}>
            {/* Country Name Label */}
            <text 
              x={c.center.x} 
              y={c.center.y} 
              textAnchor="middle" 
              className="pointer-events-none uppercase font-headline font-bold text-[10px] tracking-widest fill-black/60"
              style={{ textShadow: '0 0 3px rgba(255,255,255,0.9)' }}
            >
              {c.name}
            </text>

            {/* Settlements */}
            {c.settlements.map(s => (
              <g key={s.id} className="pointer-events-none">
                <circle 
                  cx={s.coords.x} 
                  cy={s.coords.y} 
                  r={7} 
                  fill="white"
                  stroke="black"
                  strokeWidth="1.2"
                  filter="url(#shadow)"
                />
                <g transform={`translate(${s.coords.x - 4.5}, ${s.coords.y - 4.5})`}>
                  {s.type === 'capital' ? (
                    <Landmark size={9} className="text-black" />
                  ) : s.type === 'city' ? (
                    <Building2 size={7} className="text-black/60" />
                  ) : (
                    <ShieldAlert size={7} className="text-destructive" />
                  )}
                </g>
              </g>
            ))}
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
};
