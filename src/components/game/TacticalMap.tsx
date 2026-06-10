
"use client";

import React from 'react';
import { Country, Alliance } from '@/app/lib/game-logic';
import { Landmark } from 'lucide-react';

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
          {/* Crisp Geo Filter: Merges the grid cells into solid organic shapes */}
          <filter id="crisp-geo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9" 
              result="crisp" 
            />
            <feComposite in="SourceGraphic" in2="crisp" operator="atop" />
          </filter>
          
          <filter id="text-glow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feFlood floodColor="white" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Territory Polygons (Layered for solid look) */}
        <g filter="url(#crisp-geo)">
          {countries.map(c => {
            const color = getDisplayColor(c);
            return (
              <g key={c.id} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
                {c.points.map((p, i) => (
                  <rect 
                    key={`${c.id}-p-${i}`} 
                    x={p.x - 5.5} 
                    y={p.y - 5.5} 
                    width={11.5} 
                    height={11.5} 
                    fill={color} 
                  />
                ))}
              </g>
            );
          })}
        </g>

        {/* Province Outlines (Natural Borders) */}
        <g opacity="0.15" className="pointer-events-none">
          {countries.map(c => (
            c.provinces.map((prov, pidx) => (
              prov.points.map((p, i) => (
                <rect 
                  key={`${c.id}-prov-${pidx}-${i}`} 
                  x={p.x - 5} 
                  y={p.y - 5} 
                  width={10.5} 
                  height={10.5} 
                  fill="none" 
                  stroke="black"
                  strokeWidth="0.5"
                />
              ))
            ))
          ))}
        </g>

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
                  strokeWidth="2.5"
                  strokeOpacity="0.8"
                />
              ))}
            </g>
          );
        })}

        {/* Labels & Landmarks */}
        {countries.map(c => {
          // Find the capital settlement
          const capital = c.settlements.find(s => s.type === 'capital');
          if (!capital) return null;

          return (
            <React.Fragment key={`${c.id}-hud`}>
              {/* Capital Marker */}
              <g className="pointer-events-none">
                <circle 
                  cx={capital.coords.x} 
                  cy={capital.coords.y} 
                  r={8} 
                  fill="white"
                  stroke="black"
                  strokeWidth="1.5"
                />
                <g transform={`translate(${capital.coords.x - 4.5}, ${capital.coords.y - 4.5})`}>
                  <Landmark size={9} className="text-black" />
                </g>
              </g>

              {/* Country Name Label - Offset from capital to avoid overlap */}
              <text 
                x={capital.coords.x} 
                y={capital.coords.y - 18} 
                textAnchor="middle" 
                className="pointer-events-none uppercase font-headline font-bold text-[11px] tracking-[0.2em] fill-black"
                filter="url(#text-glow)"
              >
                {c.name}
              </text>
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
};
