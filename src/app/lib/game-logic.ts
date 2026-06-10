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
  ownerId: string;
}

export interface MilitaryStats {
  ground: number;
  air: number;
  naval: number;
}

export interface CountryStats {
  economy: number;
  population: number;
  military: MilitaryStats;
  growthRate: number;
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
  points: Point[];
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
  participants: string[];
}

export interface GameEvent {
  id: string;
  type: 'boom' | 'disaster' | 'breakthrough' | 'unrest';
  title: string;
  description: string;
  countryId: string;
  countryName: string;
}

export interface GameState {
  countries: Country[];
  width: number;
  height: number;
  gameYear: number;
  isPaused: boolean;
  simulationSpeed: number; // 1, 2, or 4
  relations: DiplomacyRelation[];
  recentEvents: GameEvent[];
}

const FLAG_PALETTES = [
  ['#D32F2F', '#1976D2', '#FFFFFF'],
  ['#388E3C', '#FBC02D', '#212121'],
  ['#7B1FA2', '#E64A19', '#F5F5F5'],
  ['#0097A7', '#C2185B', '#FFFFFF'],
  ['#FFEB3B', '#4CAF50', '#2196F3'], // Brighter palette for map
  ['#E91E63', '#9C27B0', '#00BCD4'],
];

const PATTERNS: ('stripes' | 'cross' | 'circles' | 'diagonal')[] = ['stripes', 'cross', 'circles', 'diagonal'];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Scramble letters for a more "mixed up" feel if needed, but we prefer generated lore
function scrambleName(name: string): string {
  const letters = name.split('');
  if (letters.length < 4) return name;
  const idx = Math.floor(Math.random() * (letters.length - 1));
  [letters[idx], letters[idx+1]] = [letters[idx+1], letters[idx]];
  return letters.join('');
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 12 + Math.floor(Math.random() * 5); // More countries for a packed map
  const countries: Country[] = [];
  
  // Create a more irregular landmass using multiple centers
  const landCenters: Point[] = [];
  const landCenterCount = 3 + Math.floor(Math.random() * 3);
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      x: width * (0.3 + Math.random() * 0.4),
      y: height * (0.3 + Math.random() * 0.4)
    });
  }

  const countrySeeds: Point[] = [];
  for (let i = 0; i < countryCount; i++) {
    // Pick a point near one of the land centers
    const center = landCenters[Math.floor(Math.random() * landCenters.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (width * 0.35);
    countrySeeds.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    });
  }

  countrySeeds.forEach((seed, idx) => {
    const palette = FLAG_PALETTES[idx % FLAG_PALETTES.length];
    countries.push({
      id: `country-${idx}`,
      name: `Nation ${String.fromCharCode(65 + idx)}`,
      color: palette[0],
      flagColors: [...palette],
      flagPattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      points: [],
      center: seed,
      settlements: [],
      stats: {
        economy: 100 + Math.random() * 500,
        population: 5 + Math.random() * 40,
        military: {
          ground: 40 + Math.random() * 100,
          air: 10 + Math.random() * 40,
          naval: 5 + Math.random() * 30,
        },
        growthRate: 1.01 + Math.random() * 0.03,
        lastGrowth: { economy: 0, population: 0, military: 0 }
      }
    });
  });

  const gridSize = 20; // Finer grid for more detailed borders
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      
      // Landmass check: point must be close enough to at least one land center
      const isLand = landCenters.some(c => getDistance(p, c) < width * 0.38 + (Math.random() * 50));
      if (!isLand) continue;

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

  // Cleanup: Remove countries with no land
  const finalCountries = countries.filter(c => c.points.length > 5);

  finalCountries.forEach(c => {
    c.settlements.push({
      id: `${c.id}-cap`,
      name: `Capital`,
      type: 'capital',
      coords: c.center,
      ownerId: c.id
    });

    const cityCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cityCount; i++) {
      const p = c.points[Math.floor(Math.random() * c.points.length)];
      if (getDistance(p, c.center) < 40) continue;
      c.settlements.push({
        id: `${c.id}-city-${i}`,
        name: `City`,
        type: 'city',
        coords: p,
        ownerId: c.id
      });
    }
  });

  try {
    const worldLore = await generateGameWorldLore({
      countries: finalCountries.map(c => ({ id: c.id, name: c.name }))
    });
    
    finalCountries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = scrambleName(countryLore.name);
        c.lore = {
          historicalNarrative: countryLore.historicalNarrative,
          diplomaticRelationships: countryLore.diplomaticRelationships,
          namingConventions: countryLore.namingConventions,
        };
        const { cityNamesExamples } = countryLore.namingConventions;
        c.settlements.forEach((s, idx) => {
          if (s.type === 'capital') s.name = cityNamesExamples[0] || s.name;
          else if (s.type === 'city') s.name = cityNamesExamples[idx + 1] || s.name;
        });
      }
    });
  } catch (err) {
    console.error("Lore generation failed", err);
  }

  return { 
    countries: finalCountries, 
    width, 
    height, 
    gameYear: 2024, 
    isPaused: false,
    simulationSpeed: 1,
    relations: [],
    recentEvents: []
  };
}

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

  const newEvents: GameEvent[] = [];

  // 1. Growth Phase
  let updatedCountries = state.countries.map(c => {
    const prevStats = c.stats;
    const newStats = { ...prevStats, military: { ...prevStats.military } };
    
    const popGrowth = prevStats.population * (prevStats.growthRate - 1) * 0.4;
    newStats.population += popGrowth;
    const econGrowth = prevStats.economy * (prevStats.growthRate - 1);
    newStats.economy += econGrowth;
    const milInvestment = econGrowth * 0.1; 
    newStats.military.ground += milInvestment * 0.5;
    newStats.military.air += milInvestment * 0.3;
    newStats.military.naval += milInvestment * 0.2;

    newStats.lastGrowth = { economy: econGrowth, population: popGrowth, military: milInvestment };

    if (Math.random() < 0.015) {
      const roll = Math.random();
      if (roll < 0.3) {
        newStats.economy *= 1.08;
        newEvents.push({ id: Math.random().toString(), type: 'boom', title: 'Economic Boom', description: `${c.name} markets are thriving.`, countryId: c.id, countryName: c.name });
      } else if (roll < 0.6) {
        newStats.population *= 0.98;
        newEvents.push({ id: Math.random().toString(), type: 'disaster', title: 'Crisis', description: `A health crisis strikes ${c.name}.`, countryId: c.id, countryName: c.name });
      }
    }

    return { ...c, stats: newStats };
  });

  // 2. War Phase
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

      const calcPower = (ids: string[]) => ids.reduce((total, id) => {
        const c = updatedCountries.find(curr => curr.id === id);
        return total + (c ? (c.stats.military.ground + c.stats.military.air * 0.6) : 0);
      }, 0);

      const power1 = calcPower(coalition1);
      const power2 = calcPower(coalition2);
      const winnerIds = power1 > power2 ? coalition1 : coalition2;
      const loserIds = power1 > power2 ? coalition2 : coalition1;
      const powerDiff = Math.abs(power1 - power2);
      const flipTotal = Math.max(1, Math.floor(powerDiff / 15));

      loserIds.forEach(lId => {
        const loser = updatedCountries.find(c => c.id === lId);
        if (!loser || loser.points.length === 0) return;

        const borderPointsIndices: number[] = [];
        loser.points.forEach((lp, idx) => {
          if (winnerIds.some(wId => updatedCountries.find(c => c.id === wId)?.points.some(wp => getDistance(lp, wp) <= 35))) {
            borderPointsIndices.push(idx);
          }
        });

        const countryFlipCount = Math.min(borderPointsIndices.length, Math.ceil(flipTotal / loserIds.length));
        const toFlip = borderPointsIndices.sort(() => Math.random() - 0.5).slice(0, countryFlipCount);
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
              if (d < minDist) { minDist = d; closestWinner = w; }
            });
            if (closestWinner) (closestWinner as Country).points.push(pt);
          });
        }
      });
    });

    updatedCountries.forEach(country => {
      country.settlements.forEach(s => {
        let bestClaimId = s.ownerId;
        let minClaimDist = 25;
        updatedCountries.forEach(c => {
          const distToTerritory = c.points.reduce((min, p) => Math.min(min, getDistance(p, s.coords)), Infinity);
          if (distToTerritory < minClaimDist) { bestClaimId = c.id; minClaimDist = distToTerritory; }
        });
        s.ownerId = bestClaimId;
      });
    });
  }

  // 3. Elimination
  const conqueredIds = updatedCountries.filter(c => c.points.length === 0).map(c => c.id);
  if (conqueredIds.length > 0) {
    updatedCountries = updatedCountries.filter(c => !conqueredIds.includes(c.id));
    state.relations = state.relations.filter(r => !r.participants.some(pId => conqueredIds.includes(pId)));
    updatedCountries.forEach(c => {
      c.settlements.forEach(s => {
        if (conqueredIds.includes(s.ownerId)) {
          let actualOwnerId = c.id;
          let minD = Infinity;
          updatedCountries.forEach(oc => {
            const d = oc.points.reduce((m, p) => Math.min(m, getDistance(p, s.coords)), Infinity);
            if (d < minD) { minD = d; actualOwnerId = oc.id; }
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
    recentEvents: newEvents,
  };
}

export function setDiplomacy(state: GameState, countryId1: string, countryId2: string, type: 'war' | 'alliance' | 'neutral'): GameState {
  const filteredRelations = state.relations.filter(r => !(r.participants.includes(countryId1) && r.participants.includes(countryId2)));
  if (type === 'neutral') return { ...state, relations: filteredRelations };
  return { ...state, relations: [...filteredRelations, { type, participants: [countryId1, countryId2] }] };
}
