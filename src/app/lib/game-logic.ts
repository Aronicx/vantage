import { generateGameWorldLore } from '@/ai/flows/generate-game-world-lore';

export interface Point {
  x: number;
  y: number;
}

export interface Settlement {
  id: string;
  name: string;
  type: 'capital' | 'city' | 'outpost';
  coords: Point;
  ownerId: string; // Track who currently owns the settlement
}

export interface MilitaryStats {
  ground: number;
  air: number;
  naval: number;
}

export interface CountryStats {
  economy: number; // GDP in billions
  population: number; // In millions
  military: MilitaryStats;
  growthRate: number; // Base multiplier for economy/population
  lastGrowth: {
    economy: number;
    population: number;
    military: number;
  };
}

export interface Country {
  id: string;
  name: string;
  color: string;
  flagColors: string[];
  flagPattern: 'stripes' | 'cross' | 'circles' | 'diagonal';
  points: Point[]; // Boundary points for SVG representation
  center: Point;
  settlements: Settlement[];
  stats: CountryStats;
  lore?: {
    historicalNarrative: string;
    diplomaticRelationships: any[];
    namingConventions: any;
  };
}

export interface DiplomacyRelation {
  type: 'war' | 'alliance';
  participants: string[]; // Country IDs
}

export interface GameState {
  countries: Country[];
  width: number;
  height: number;
  gameYear: number;
  isPaused: boolean;
  relations: DiplomacyRelation[];
}

const FLAG_PALETTES = [
  ['#D32F2F', '#1976D2', '#FFFFFF'], // Reds/Blues
  ['#388E3C', '#FBC02D', '#212121'], // Greens/Yellows
  ['#7B1FA2', '#E64A19', '#F5F5F5'], // Purples/Oranges
  ['#0097A7', '#C2185B', '#FFFFFF'], // Cyans/Magentas
  ['#326194', '#3DBCCF', '#0F1216'], // Command Palette
  ['#5D4037', '#8D6E63', '#D7CCC8'], // Earthy
];

const PATTERNS: ('stripes' | 'cross' | 'circles' | 'diagonal')[] = ['stripes', 'cross', 'circles', 'diagonal'];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 6 + Math.floor(Math.random() * 3);
  const countries: Country[] = [];
  
  const countrySeeds: Point[] = [];
  for (let i = 0; i < countryCount; i++) {
    const angle = (i / countryCount) * Math.PI * 2;
    const dist = (0.2 + Math.random() * 0.25) * Math.min(width, height);
    countrySeeds.push({
      x: width / 2 + Math.cos(angle) * dist,
      y: height / 2 + Math.sin(angle) * dist,
    });
  }

  countrySeeds.forEach((seed, idx) => {
    const palette = FLAG_PALETTES[idx % FLAG_PALETTES.length];
    countries.push({
      id: `country-${idx}`,
      name: `Sovereignty ${String.fromCharCode(65 + idx)}`,
      color: palette[0],
      flagColors: [...palette],
      flagPattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      points: [],
      center: seed,
      settlements: [],
      stats: {
        economy: 150 + Math.random() * 800,
        population: 12 + Math.random() * 80,
        military: {
          ground: 60 + Math.random() * 150,
          air: 20 + Math.random() * 60,
          naval: 10 + Math.random() * 40,
        },
        growthRate: 1.015 + Math.random() * 0.035,
        lastGrowth: { economy: 0, population: 0, military: 0 }
      }
    });
  });

  const gridSize = 30;
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      const distToWorldCenter = getDistance(p, { x: width / 2, y: height / 2 });
      if (distToWorldCenter > Math.min(width, height) * 0.48) continue;

      let closestId = '';
      let minDist = Infinity;
      
      countries.forEach(c => {
        const d = getDistance(p, c.center);
        if (d < minDist) {
          minDist = d;
          closestId = c.id;
        }
      });
      
      if (closestId) {
        countries.find(c => c.id === closestId)?.points.push(p);
      }
    }
  }

  countries.forEach(c => {
    if (c.points.length === 0) return;

    c.settlements.push({
      id: `${c.id}-cap`,
      name: `Capital Prime`,
      type: 'capital',
      coords: c.center,
      ownerId: c.id
    });

    const cityCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cityCount; i++) {
      const p = c.points[Math.floor(Math.random() * c.points.length)];
      if (getDistance(p, c.center) < 60) continue;
      c.settlements.push({
        id: `${c.id}-city-${i}`,
        name: `City ${i + 1}`,
        type: 'city',
        coords: p,
        ownerId: c.id
      });
    }

    const outpostCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < outpostCount; i++) {
      const p = c.points[Math.floor(Math.random() * c.points.length)];
      c.settlements.push({
        id: `${c.id}-post-${i}`,
        name: `Military Outpost ${i + 1}`,
        type: 'outpost',
        coords: p,
        ownerId: c.id
      });
    }
  });

  try {
    const worldLore = await generateGameWorldLore({
      countries: countries.map(c => ({ id: c.id, name: c.name }))
    });
    
    countries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = countryLore.name;
        c.lore = {
          historicalNarrative: countryLore.historicalNarrative,
          diplomaticRelationships: countryLore.diplomaticRelationships,
          namingConventions: countryLore.namingConventions,
        };

        const { cityNamesExamples } = countryLore.namingConventions;
        c.settlements.forEach((s, idx) => {
          if (s.type === 'capital') s.name = cityNamesExamples[0] || s.name;
          else if (s.type === 'city') s.name = cityNamesExamples[idx + 1] || s.name;
          else if (s.type === 'outpost') s.name = `${cityNamesExamples[idx + 1] || 'Border'} Station`;
        });
      }
    });
  } catch (err) {
    console.error("Lore generation failed, using defaults", err);
  }

  return { 
    countries, 
    width, 
    height, 
    gameYear: 2148, 
    isPaused: false,
    relations: []
  };
}

/**
 * Finds all countries in a coalition with the given country based on active alliances.
 */
function getCoalition(countryId: string, relations: DiplomacyRelation[]): string[] {
  const coalition = new Set<string>([countryId]);
  let added = true;
  while (added) {
    added = false;
    relations.forEach(r => {
      if (r.type === 'alliance') {
        const [c1, c2] = r.participants;
        if (coalition.has(c1) && !coalition.has(c2)) {
          coalition.add(c2);
          added = true;
        } else if (coalition.has(c2) && !coalition.has(c1)) {
          coalition.add(c1);
          added = true;
        }
      }
    });
  }
  return Array.from(coalition);
}

export function processTick(state: GameState): GameState {
  if (state.isPaused) return state;

  // 1. Growth Phase
  let updatedCountries = state.countries.map(c => {
    const prevStats = c.stats;
    const newStats = { ...prevStats, military: { ...prevStats.military } };
    
    const popGrowth = prevStats.population * (prevStats.growthRate - 1) * 0.4;
    newStats.population += popGrowth;

    const econGrowth = prevStats.economy * (prevStats.growthRate - 1);
    newStats.economy += econGrowth;

    const milInvestment = econGrowth * 0.12; 
    newStats.military.ground += milInvestment * 0.5;
    newStats.military.air += milInvestment * 0.3;
    newStats.military.naval += milInvestment * 0.2;

    newStats.lastGrowth = {
      economy: econGrowth,
      population: popGrowth,
      military: milInvestment
    };

    return { ...c, stats: newStats };
  });

  // 2. War Phase (Alliance-Aware Territory Conquest)
  const warRelations = state.relations.filter(r => r.type === 'war');
  if (warRelations.length > 0) {
    const processedWars = new Set<string>();

    warRelations.forEach(war => {
      const [id1, id2] = war.participants;
      const key = [id1, id2].sort().join('-');
      if (processedWars.has(key)) return;
      processedWars.add(key);

      const coalition1 = getCoalition(id1, state.relations);
      const coalition2 = getCoalition(id2, state.relations);

      const calcPower = (ids: string[]) => {
        return ids.reduce((total, id) => {
          const c = updatedCountries.find(curr => curr.id === id);
          if (!c) return total;
          return total + (c.stats.military.ground * 1.0 + c.stats.military.air * 0.5);
        }, 0);
      };

      const power1 = calcPower(coalition1);
      const power2 = calcPower(coalition2);

      const winnerIds = power1 > power2 ? coalition1 : coalition2;
      const loserIds = power1 > power2 ? coalition2 : coalition1;
      
      const powerDiff = Math.abs(power1 - power2);
      const flipTotal = Math.max(1, Math.floor(powerDiff / 25));

      loserIds.forEach(lId => {
        const loser = updatedCountries.find(c => c.id === lId);
        if (!loser || loser.points.length === 0) return;

        const borderPointsIndices: number[] = [];
        const thresholdDist = 45;

        loser.points.forEach((lp, idx) => {
          const isNearAnyWinner = winnerIds.some(wId => {
            const winner = updatedCountries.find(c => c.id === wId);
            return winner?.points.some(wp => getDistance(lp, wp) <= thresholdDist);
          });
          
          if (isNearAnyWinner) {
            borderPointsIndices.push(idx);
          }
        });

        const countryFlipCount = Math.min(borderPointsIndices.length, Math.ceil(flipTotal / loserIds.length));
        const toFlip = borderPointsIndices
          .sort(() => Math.random() - 0.5)
          .slice(0, countryFlipCount);

        if (toFlip.length > 0) {
          const pointsToMove = toFlip.map(idx => loser.points[idx]);
          loser.points = loser.points.filter((_, idx) => !toFlip.includes(idx));

          pointsToMove.forEach(pt => {
            let closestWinner: Country | null = null;
            let minDist = Infinity;
            
            winnerIds.forEach(wId => {
              const w = updatedCountries.find(c => c.id === wId);
              if (!w) return;
              const d = getDistance(pt, w.center);
              if (d < minDist) {
                minDist = d;
                closestWinner = w;
              }
            });

            if (closestWinner) {
              (closestWinner as Country).points.push(pt);
            }
          });
        }
      });
    });

    // Settlement Capture based on updated borders
    updatedCountries.forEach(country => {
      country.settlements.forEach(s => {
        let bestClaimId = s.ownerId;
        let minClaimDist = 20;

        updatedCountries.forEach(c => {
          const distToTerritory = c.points.reduce((min, p) => Math.min(min, getDistance(p, s.coords)), Infinity);
          if (distToTerritory < minClaimDist) {
            bestClaimId = c.id;
            minClaimDist = distToTerritory;
          }
        });

        if (s.ownerId !== bestClaimId) {
          s.ownerId = bestClaimId;
        }
      });
    });
  }

  // 3. Part 6: Cleanup Conquered Nations (Territory Elimination)
  const conqueredIds = updatedCountries.filter(c => c.points.length === 0).map(c => c.id);
  let updatedRelations = state.relations;

  if (conqueredIds.length > 0) {
    // Remove the countries that have lost all land
    updatedCountries = updatedCountries.filter(c => !conqueredIds.includes(c.id));
    
    // Purge diplomatic relations involving defunct nations
    updatedRelations = state.relations.filter(r => 
      !r.participants.some(pId => conqueredIds.includes(pId))
    );

    // Any settlements owned by defunct countries should be assigned to the current territorial holder
    updatedCountries.forEach(c => {
      c.settlements.forEach(s => {
        if (conqueredIds.includes(s.ownerId)) {
          // Find the new owner of this spot on the map
          let actualOwnerId = c.id;
          let minD = Infinity;
          updatedCountries.forEach(oc => {
            const d = oc.points.reduce((m, p) => Math.min(m, getDistance(p, s.coords)), Infinity);
            if (d < minD) {
              minD = d;
              actualOwnerId = oc.id;
            }
          });
          s.ownerId = actualOwnerId;
        }
      });
    });
  }

  return {
    ...state,
    countries: updatedCountries,
    gameYear: state.gameYear + 1,
    relations: updatedRelations
  };
}

export function setDiplomacy(state: GameState, countryId1: string, countryId2: string, type: 'war' | 'alliance' | 'neutral'): GameState {
  const filteredRelations = state.relations.filter(r => 
    !(r.participants.includes(countryId1) && r.participants.includes(countryId2))
  );

  if (type === 'neutral') {
    return { ...state, relations: filteredRelations };
  }

  return {
    ...state,
    relations: [...filteredRelations, { type, participants: [countryId1, countryId2] }]
  };
}
