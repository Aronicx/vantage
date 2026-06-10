"use client";

import React from 'react';
import { Country, Alliance, Settlement } from '@/app/lib/game-logic';
import { Building2, Landmark, ShieldAlert } from 'lucide-react';

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
    <div className="relative w-full h-full map-container overflow-hidden select-none">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gooey Filter for organic solid shapes */}
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>

          {/* Map Paper Texture Overlay */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Ocean Grid Background */}
        <rect width="1000" height="1000" fill="url(#grid)" />

        {/* Territory Regions with Gooey Filter */}
        <g className="gooey-filter">
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
                    r={26} 
                    fill={color} 
                    stroke={isSelected ? "#FFF" : "none"}
                    strokeWidth={isSelected ? "2" : "0"}
                    className="transition-all duration-500 ease-in-out"
                  />
                ))}
              </g>
            );
          })}
        </g>

        {/* Sharp Borders (Black Outline Layer) */}
        <g opacity="0.4">
          {countries.map(c => {
             const isSelected = selection.includes(c.id);
             return (
               <g key={`${c.id}-border`} className="pointer-events-none">
                 {c.points.map((p, i) => (
                   <circle 
                     key={`${c.id}-bp-${i}`} 
                     cx={p.x} 
                     cy={p.y} 
                     r={27} 
                     fill="none" 
                     stroke="rgba(0,0,0,0.8)" 
                     strokeWidth="0.5"
                   />
                 ))}
               </g>
             );
          })}
        </g>

        {/* Labels & Landmarks */}
        {countries.map(c => (
          <React.Fragment key={`${c.id}-entities`}>
            {/* Country Name */}
            <text 
              x={c.center.x} 
              y={c.center.y + 40} 
              textAnchor="middle" 
              className="country-label select-none pointer-events-none text-[12px]"
            >
              {c.name}
            </text>

            {/* Settlements */}
            {c.settlements.map(s => (
              <g key={s.id} className="pointer-events-none">
                <circle 
                  cx={s.coords.x} 
                  cy={s.coords.y} 
                  r={12} 
                  fill="white"
                  stroke="black"
                  strokeWidth="1.5"
                  className="shadow-xl"
                />
                <g transform={`translate(${s.coords.x - 7}, ${s.coords.y - 7})`}>
                  {s.type === 'capital' ? (
                    <Landmark size={14} className="text-primary" />
                  ) : s.type === 'city' ? (
                    <Building2 size={12} className="text-slate-700" />
                  ) : (
                    <ShieldAlert size={12} className="text-destructive" />
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
