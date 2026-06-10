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

  // 2. War Phase (Territory Conquest)
  const warRelations = state.relations.filter(r => r.type === 'war');
  if (warRelations.length > 0) {
    warRelations.forEach(war => {
      const [id1, id2] = war.participants;
      const c1 = updatedCountries.find(c => c.id === id1);
      const c2 = updatedCountries.find(c => c.id === id2);

      if (!c1 || !c2 || c1.points.length === 0 || c2.points.length === 0) return;

      // Calculate relative strength
      const power1 = c1.stats.military.ground * 1.0 + c1.stats.military.air * 0.5;
      const power2 = c2.stats.military.ground * 1.0 + c2.stats.military.air * 0.5;
      const totalPower = power1 + power2;

      // Identify border points
      const thresholdDist = 45; // Grid size is 30, so check slightly beyond adjacent
      
      // We flip a fixed number of points each tick based on power difference
      const flipCount = Math.max(1, Math.floor(Math.abs(power1 - power2) / 20));
      const winner = power1 > power2 ? c1 : c2;
      const loser = power1 > power2 ? c2 : c1;

      // Find border points belonging to the loser
      const borderPointsIndices: number[] = [];
      loser.points.forEach((lp, idx) => {
        const isNearWinner = winner.points.some(wp => getDistance(lp, wp) <= thresholdDist);
        if (isNearWinner) {
          borderPointsIndices.push(idx);
        }
      });

      // Shuffle and take top flipCount
      const toFlip = borderPointsIndices
        .sort(() => Math.random() - 0.5)
        .slice(0, flipCount);

      if (toFlip.length > 0) {
        // Transfer points
        const pointsToMove = toFlip.map(idx => loser.points[idx]);
        
        // Update loser points
        loser.points = loser.points.filter((_, idx) => !toFlip.includes(idx));
        // Update winner points
        winner.points.push(...pointsToMove);

        // Check for settlement capture
        updatedCountries.forEach(country => {
          country.settlements.forEach(s => {
            // A settlement is captured if its location is now surrounded by the enemy
            // Simplification: If the winner now has a point very close to the settlement
            const distToWinner = winner.points.reduce((min, p) => Math.min(min, getDistance(p, s.coords)), Infinity);
            if (distToWinner < 15 && s.ownerId !== winner.id) {
              s.ownerId = winner.id;
            }
          });
        });
      }
    });
  }

  return {
    ...state,
    countries: updatedCountries,
    gameYear: state.gameYear + 1
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
