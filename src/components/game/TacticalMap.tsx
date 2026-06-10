"use client";

import React from 'react';
import { Country, Alliance, Settlement } from '@/app/lib/game-logic';
import { Building2 } from 'lucide-react';

interface MapProps {
  countries: Country[];
  alliances: Alliance[];
  selection: string[];
  onSelectCountry: (c: Country) => void;
  onSelectSettlement: (s: Settlement, c: Country) => void;
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
    <div className="relative w-full h-full bg-[#87CEEB] overflow-hidden select-none map-container">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Territory Blobs */}
        {countries.map(c => {
          const color = getDisplayColor(c);
          const isSelected = selection.includes(c.id);
          
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
              {c.points.map((p, i) => (
                <circle 
                  key={`${c.id}-p-${i}`} 
                  cx={p.x} 
                  cy={p.y} 
                  r={isSelected ? 26 : 22} 
                  fill={color} 
                  fillOpacity={isSelected ? 1 : 0.8}
                  stroke={isSelected ? "#FFF" : "#000"}
                  strokeWidth={isSelected ? "2" : "0.5"}
                  className="transition-all duration-300 ease-out"
                />
              ))}
            </g>
          );
        })}

        {/* Country Labels */}
        {countries.map(c => (
          <g key={`${c.id}-label`} className="pointer-events-none">
            <text 
              x={c.center.x} 
              y={c.center.y + 35} 
              textAnchor="middle" 
              className="country-label fill-black/70 text-[10px] font-bold uppercase select-none"
            >
              {c.name}
            </text>
          </g>
        ))}

        {/* Settlements */}
        {countries.flatMap(c => c.settlements).map(s => {
          const owner = countries.find(c => c.id === s.ownerId);
          if (!owner) return null;

          return (
            <g key={s.id} className="pointer-events-none">
              <circle 
                cx={s.coords.x} 
                cy={s.coords.y} 
                r={10} 
                fill="white"
                stroke="#000"
                strokeWidth="1"
              />
              <g transform={`translate(${s.coords.x - 5}, ${s.coords.y - 5})`}>
                <Building2 size={10} className="text-black" strokeWidth={2.5} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
