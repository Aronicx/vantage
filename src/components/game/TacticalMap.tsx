"use client";

import React from 'react';
import { Country, Alliance } from '@/app/lib/game-logic';

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
          {/* Natural Organic Outline Filter (Gooey effect for smoother borders) */}
          <filter id="crisp-geo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.0" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -15" 
              result="crisp" 
            />
            <feMorphology in="crisp" operator="dilate" radius="2.5" result="dilated" />
            <feComposite in="dilated" in2="crisp" operator="out" result="outline" />
            <feFlood floodColor="#000000" result="black" />
            <feComposite in="black" in2="outline" operator="in" result="blackOutline" />
            <feComposite in="SourceGraphic" in2="crisp" operator="atop" result="mainFill" />
            <feMerge>
              <feMergeNode in="mainFill" />
              <feMergeNode in="blackOutline" />
            </feMerge>
          </filter>

          {/* Internal Administrative Filter (Gooey smoothed internal borders) */}
          <filter id="crisp-geo-grey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 45 -13" 
              result="crisp" 
            />
            <feMorphology in="crisp" operator="dilate" radius="1.8" result="dilated" />
            <feComposite in="dilated" in2="crisp" operator="out" result="outline" />
            <feFlood floodColor="#475569" result="grey" />
            <feComposite in="grey" in2="outline" operator="in" result="greyOutline" />
            <feComposite in="SourceGraphic" in2="crisp" operator="atop" result="mainFill" />
            <feMerge>
              <feMergeNode in="mainFill" />
              <feMergeNode in="greyOutline" />
            </feMerge>
          </filter>
          
          <filter id="label-buffer">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blur" />
            <feFlood floodColor="white" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Internal Grey Borders Layer (Alliances Only) */}
        {alliances.map(alliance => (
          <g key={`${alliance.id}-internal`} filter="url(#crisp-geo-grey)">
            {countries.filter(c => c.allianceId === alliance.id).map(c => (
              <g key={`${c.id}-int-mass`}>
                {c.points.map((p, i) => (
                  <rect 
                    key={`${c.id}-p-int-${i}`} 
                    x={p.x - 2.8} 
                    y={p.y - 2.8} 
                    width={5.6} 
                    height={5.6} 
                    fill={alliance.color} 
                  />
                ))}
              </g>
            ))}
          </g>
        ))}

        {/* 2. Outer Black Borders Layer (Independent Countries) */}
        {countries.filter(c => !c.allianceId).map(c => (
          <g key={`${c.id}-outer`} filter="url(#crisp-geo)" className="cursor-pointer" onClick={() => onSelectCountry(c)}>
            {c.points.map((p, i) => (
              <rect 
                key={`${c.id}-p-${i}`} 
                x={p.x - 2.8} 
                y={p.y - 2.8} 
                width={5.6} 
                height={5.6} 
                fill={c.color} 
              />
            ))}
          </g>
        ))}

        {/* 3. Outer Black Borders Layer (Alliances - Grouped for shared outlines) */}
        {alliances.map(alliance => (
          <g key={`${alliance.id}-outer`} filter="url(#crisp-geo)">
            {countries.filter(c => c.allianceId === alliance.id).map(c => (
              <g key={`${c.id}-ext-mass`} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
                {c.points.map((p, i) => (
                  <rect 
                    key={`${c.id}-p-ext-${i}`} 
                    x={p.x - 2.8} 
                    y={p.y - 2.8} 
                    width={5.6} 
                    height={5.6} 
                    fill={alliance.color} 
                  />
                ))}
              </g>
            ))}
          </g>
        ))}

        {/* 4. Active Selection Layer */}
        {selection.map(id => {
          const c = countries.find(curr => curr.id === id);
          if (!c) return null;
          return (
            <g key={`selection-${id}`} className="pointer-events-none" filter="url(#crisp-geo)">
              {c.points.map((p, i) => (
                <rect 
                  key={`sel-p-${i}`} 
                  x={p.x - 3.2} 
                  y={p.y - 3.2} 
                  width={6.4} 
                  height={6.4} 
                  fill="white" 
                  fillOpacity="0.3"
                  stroke="white" 
                  strokeWidth="1.5"
                />
              ))}
            </g>
          );
        })}

        {/* 5. Labels & Markers */}
        {countries.map(c => {
          const capital = c.settlements.find(s => s.type === 'capital');
          if (!capital) return null;

          return (
            <g key={`${c.id}-labels`} className="pointer-events-none">
              <circle 
                cx={capital.coords.x} 
                cy={capital.coords.y} 
                r={4} 
                fill="black"
                stroke="white"
                strokeWidth="1.5"
                filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.3))"
              />
              <text 
                x={capital.coords.x} 
                y={capital.coords.y - 14} 
                textAnchor="middle" 
                className="uppercase font-headline font-bold text-[10px] tracking-[0.25em] fill-black"
                filter="url(#label-buffer)"
              >
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
