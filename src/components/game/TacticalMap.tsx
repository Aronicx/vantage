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
  
  // Group countries by their political entity (Alliance or Independent)
  const countriesInAlliances = new Set();
  const allianceEntities = alliances.map(alliance => {
    const allianceCountries = countries.filter(c => c.allianceId === alliance.id);
    allianceCountries.forEach(c => countriesInAlliances.add(c.id));
    return {
      id: alliance.id,
      color: alliance.color,
      countries: allianceCountries,
      isAlliance: true
    };
  });

  const independentEntities = countries
    .filter(c => !countriesInAlliances.has(c.id))
    .map(c => ({
      id: c.id,
      color: c.color,
      countries: [c],
      isAlliance: false
    }));

  const allEntities = [...allianceEntities, ...independentEntities];

  return (
    <div className="relative w-full h-full bg-[#E5F1F5] overflow-hidden select-none">
      <svg 
        viewBox="0 0 1000 1000" 
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="crisp-geo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9" 
              result="crisp" 
            />
            <feMorphology in="crisp" operator="dilate" radius="1.2" result="dilated" />
            <feComposite in="dilated" in2="crisp" operator="out" result="outline" />
            <feFlood floodColor="#000000" result="black" />
            <feComposite in="black" in2="outline" operator="in" result="blackOutline" />
            <feComposite in="SourceGraphic" in2="crisp" operator="atop" result="mainFill" />
            <feMerge>
              <feMergeNode in="mainFill" />
              <feMergeNode in="blackOutline" />
            </feMerge>
          </filter>

          <filter id="crisp-geo-grey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9" 
              result="crisp" 
            />
            <feMorphology in="crisp" operator="dilate" radius="0.8" result="dilated" />
            <feComposite in="dilated" in2="crisp" operator="out" result="outline" />
            <feFlood floodColor="#334155" result="grey" />
            <feComposite in="grey" in2="outline" operator="in" result="greyOutline" />
            <feComposite in="SourceGraphic" in2="crisp" operator="atop" result="mainFill" />
            <feMerge>
              <feMergeNode in="mainFill" />
              <feMergeNode in="greyOutline" />
            </feMerge>
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

        {/* Territory Rendering */}
        {allEntities.map(entity => (
          <g key={entity.id}>
            {entity.isAlliance ? (
              <>
                {/* Unified Alliance Block with Black Outer Border */}
                <g filter="url(#crisp-geo)">
                  {entity.countries.map(c => (
                    <g key={`${c.id}-alliance-mass`} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
                      {c.points.map((p, i) => (
                        <rect 
                          key={`${c.id}-p-${i}`} 
                          x={p.x - 5.5} 
                          y={p.y - 5.5} 
                          width={11.5} 
                          height={11.5} 
                          fill={entity.color} 
                        />
                      ))}
                    </g>
                  ))}
                </g>
                {/* Individual Countries within Alliance with Dark Grey Internal Borders */}
                <g filter="url(#crisp-geo-grey)">
                  {entity.countries.map(c => (
                    <g key={`${c.id}-alliance-internal`} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
                      {c.points.map((p, i) => (
                        <rect 
                          key={`${c.id}-p-int-${i}`} 
                          x={p.x - 5.5} 
                          y={p.y - 5.5} 
                          width={11.5} 
                          height={11.5} 
                          fill={entity.color} 
                        />
                      ))}
                    </g>
                  ))}
                </g>
              </>
            ) : (
              /* Independent Country with Black Border */
              <g filter="url(#crisp-geo)">
                {entity.countries.map(c => (
                  <g key={c.id} className="cursor-pointer" onClick={() => onSelectCountry(c)}>
                    {c.points.map((p, i) => (
                      <rect 
                        key={`${c.id}-p-${i}`} 
                        x={p.x - 5.5} 
                        y={p.y - 5.5} 
                        width={11.5} 
                        height={11.5} 
                        fill={entity.color} 
                      />
                    ))}
                  </g>
                ))}
              </g>
            )}
          </g>
        ))}

        {/* Internal Province Boundaries (Very Subtle) */}
        <g opacity="0.05" className="pointer-events-none">
          {countries.map(c => (
            c.provinces.map((prov, pidx) => (
              prov.points.map((p, i) => (
                <rect 
                  key={`${c.id}-prov-${pidx}-${i}`} 
                  x={p.x - 5} 
                  y={p.y - 5} 
                  width={10} 
                  height={10} 
                  fill="none" 
                  stroke="black"
                  strokeWidth="0.2"
                />
              ))
            ))
          ))}
        </g>

        {/* Active Selection Indicator */}
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
                  strokeOpacity="0.8"
                />
              ))}
            </g>
          );
        })}

        {/* Labels: Capitals & Country Names Only */}
        {countries.map(c => {
          const capital = c.settlements.find(s => s.type === 'capital');
          if (!capital) return null;

          return (
            <g key={`${c.id}-labels`} className="pointer-events-none">
              <circle 
                cx={capital.coords.x} 
                cy={capital.coords.y} 
                r={3.5} 
                fill="black"
                stroke="white"
                strokeWidth="1"
              />
              <text 
                x={capital.coords.x} 
                y={capital.coords.y - 12} 
                textAnchor="middle" 
                className="pointer-events-none uppercase font-headline font-bold text-[9px] tracking-[0.2em] fill-black"
                filter="url(#text-glow)"
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
