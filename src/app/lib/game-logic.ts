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
  ['#326194', '#3DBCCF', '#0F1216'],
  ['#5D4037', '#8D6E63', '#D7CCC8'],
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
        });
      }
    });
  } catch (err) {
    console.error("Lore generation failed", err);
  }

  return { 
    countries, 
    width, 
    height, 
    gameYear: 2148, 
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

  // 1. Growth Phase & Random Events
  let updatedCountries = state.countries.map(c => {
    const prevStats = c.stats;
    const newStats = { ...prevStats, military: { ...prevStats.military } };
    
    // Base Growth
    const popGrowth = prevStats.population * (prevStats.growthRate - 1) * 0.4;
    newStats.population += popGrowth;
    const econGrowth = prevStats.economy * (prevStats.growthRate - 1);
    newStats.economy += econGrowth;
    const milInvestment = econGrowth * 0.12; 
    newStats.military.ground += milInvestment * 0.5;
    newStats.military.air += milInvestment * 0.3;
    newStats.military.naval += milInvestment * 0.2;

    newStats.lastGrowth = { economy: econGrowth, population: popGrowth, military: milInvestment };

    // Random Event Check (approx 2% chance per country per tick)
    if (Math.random() < 0.02) {
      const roll = Math.random();
      if (roll < 0.25) {
        newStats.economy *= 1.1;
        newEvents.push({ id: Math.random().toString(), type: 'boom', title: 'Economic Boom', description: `${c.name} experiences unprecedented market growth.`, countryId: c.id, countryName: c.name });
      } else if (roll < 0.5) {
        newStats.population *= 0.95;
        newStats.economy *= 0.95;
        newEvents.push({ id: Math.random().toString(), type: 'disaster', title: 'Natural Disaster', description: `A massive storm devastates the coastlines of ${c.name}.`, countryId: c.id, countryName: c.name });
      } else if (roll < 0.75) {
        newStats.military.air *= 1.15;
        newStats.military.ground *= 1.15;
        newEvents.push({ id: Math.random().toString(), type: 'breakthrough', title: 'Tech Breakthrough', description: `${c.name} engineers develop superior alloy plating.`, countryId: c.id, countryName: c.name });
      } else {
        newStats.growthRate *= 0.99;
        newEvents.push({ id: Math.random().toString(), type: 'unrest', title: 'Civil Unrest', description: `Protests in ${c.name} slow down national development.`, countryId: c.id, countryName: c.name });
      }
    }

    return { ...c, stats: newStats };
  });

  // 2. War Phase (Alliance-Aware)
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
        return total + (c ? (c.stats.military.ground + c.stats.military.air * 0.5) : 0);
      }, 0);

      const power1 = calcPower(coalition1);
      const power2 = calcPower(coalition2);
      const winnerIds = power1 > power2 ? coalition1 : coalition2;
      const loserIds = power1 > power2 ? coalition2 : coalition1;
      const powerDiff = Math.abs(power1 - power2);
      const flipTotal = Math.max(1, Math.floor(powerDiff / 20));

      loserIds.forEach(lId => {
        const loser = updatedCountries.find(c => c.id === lId);
        if (!loser || loser.points.length === 0) return;

        const borderPointsIndices: number[] = [];
        loser.points.forEach((lp, idx) => {
          if (winnerIds.some(wId => updatedCountries.find(c => c.id === wId)?.points.some(wp => getDistance(lp, wp) <= 45))) {
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
        let minClaimDist = 20;
        updatedCountries.forEach(c => {
          const distToTerritory = c.points.reduce((min, p) => Math.min(min, getDistance(p, s.coords)), Infinity);
          if (distToTerritory < minClaimDist) { bestClaimId = c.id; minClaimDist = distToTerritory; }
        });
        s.ownerId = bestClaimId;
      });
    });
  }

  // 3. Cleanup & Elimination
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
