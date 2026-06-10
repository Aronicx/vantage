"use client";

import React, { useState } from 'react';
import { Country, Settlement } from '@/app/lib/game-logic';
import { Shield, MapPin, Crosshair, Building2, Anchor } from 'lucide-react';

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

        {/* Territory Blobs */}
        {countries.map(c => (
          <g key={c.id}>
            {activeOverlays.borders && c.points.map((p, i) => (
              <circle 
                key={i} 
                cx={p.x} 
                cy={p.y} 
                r={24} 
                fill={c.color} 
                fillOpacity={hoveredCountry === c.id ? 0.15 : 0.08}
                className="transition-all duration-300"
              />
            ))}
          </g>
        ))}

        {/* Hover/Select Area Interaction Layer */}
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

        {/* Settlement Icons */}
        {countries.map(c => (
          <g key={`${c.id}-markers`}>
            {c.settlements.map(s => {
              const isHovered = hoveredCountry === c.id;
              
              return (
                <g 
                  key={s.id} 
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSettlement(s, c);
                  }}
                >
                  {/* Outer Ring */}
                  <circle 
                    cx={s.coords.x} 
                    cy={s.coords.y} 
                    r={s.type === 'capital' ? 14 : 8} 
                    fill="none" 
                    stroke={c.color} 
                    strokeWidth="1.5"
                    className={s.type === 'capital' ? "animate-pulse" : ""}
                    opacity={isHovered ? 1 : 0.5}
                  />

                  {/* Icon Representation */}
                  <g transform={`translate(${s.coords.x - 6}, ${s.coords.y - 6})`}>
                    {s.type === 'capital' && (
                      <Building2 
                        size={12} 
                        className="text-white" 
                        strokeWidth={2.5} 
                      />
                    )}
                    {s.type === 'city' && (
                      <MapPin 
                        size={10} 
                        className="text-white/80" 
                        strokeWidth={2} 
                      />
                    )}
                    {s.type === 'outpost' && (
                      <Shield 
                        size={10} 
                        className="text-accent" 
                        strokeWidth={2} 
                      />
                    )}
                  </g>

                  {/* Label (Visible on Hover) */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <rect 
                      x={s.coords.x - 40} 
                      y={s.coords.y - 32} 
                      width={80} 
                      height={18} 
                      rx={4} 
                      fill="black" 
                      fillOpacity={0.8} 
                    />
                    <text 
                      x={s.coords.x} 
                      y={s.coords.y - 19} 
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
          </g>
        ))}
      </svg>
    </div>
  );
};
