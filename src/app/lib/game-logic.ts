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
  isAtWar?: boolean;
  lore?: {
    historicalNarrative: string;
    diplomaticRelationships: any[];
    namingConventions: any;
  };
}

export interface GameState {
  countries: Country[];
  width: number;
  height: number;
  gameYear: number;
  isPaused: boolean;
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
  
  // 1. Generate unique country seeds
  const countrySeeds: Point[] = [];
  for (let i = 0; i < countryCount; i++) {
    const angle = (i / countryCount) * Math.PI * 2;
    const dist = (0.2 + Math.random() * 0.25) * Math.min(width, height);
    countrySeeds.push({
      x: width / 2 + Math.cos(angle) * dist,
      y: height / 2 + Math.sin(angle) * dist,
    });
  }

  // 2. Initialize countries with seeds
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

  // 3. Simple Voronoi territory generation via grid sampling
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

  // 4. Generate Settlements
  countries.forEach(c => {
    if (c.points.length === 0) return;

    c.settlements.push({
      id: `${c.id}-cap`,
      name: `Capital Prime`,
      type: 'capital',
      coords: c.center,
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
      });
    }
  });

  // 5. Generate Lore and specific names via Genkit
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

  return { countries, width, height, gameYear: 2148, isPaused: false };
}

export function processTick(state: GameState): GameState {
  if (state.isPaused) return state;

  const updatedCountries = state.countries.map(c => {
    const prevStats = c.stats;
    const newStats = { ...prevStats, military: { ...prevStats.military } };
    
    // 1. Population Growth (affected by stability)
    const popGrowth = prevStats.population * (prevStats.growthRate - 1) * 0.4;
    newStats.population += popGrowth;

    // 2. Economic Growth
    const econGrowth = prevStats.economy * (prevStats.growthRate - 1);
    newStats.economy += econGrowth;

    // 3. Military Reinvestment
    // Peace-time: reinvest a percentage of GDP growth into military
    const milInvestment = econGrowth * 0.12; 
    newStats.military.ground += milInvestment * 0.5;
    newStats.military.air += milInvestment * 0.3;
    newStats.military.naval += milInvestment * 0.2;

    // Track last growth for UI
    newStats.lastGrowth = {
      economy: econGrowth,
      population: popGrowth,
      military: milInvestment
    };

    return { ...c, stats: newStats };
  });

  return {
    ...state,
    countries: updatedCountries,
    gameYear: state.gameYear + 1
  };
}
