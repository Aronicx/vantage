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
}

export interface Country {
  id: string;
  name: string;
  color: string;
  flagColors: string[];
  flagPattern: 'stripes' | 'cross' | 'circles' | 'diagonal';
  points: Point[]; // Boundary points for SVG
  center: Point;
  settlements: Settlement[];
  stats: CountryStats;
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
}

const FLAG_PALETTES = [
  ['#D32F2F', '#1976D2', '#FFFFFF'],
  ['#388E3C', '#FBC02D', '#212121'],
  ['#7B1FA2', '#E64A19', '#F5F5F5'],
  ['#0097A7', '#C2185B', '#FFFFFF'],
  ['#326194', '#3DBCCF', '#0F1216'],
];

const PATTERNS: ('stripes' | 'cross' | 'circles' | 'diagonal')[] = ['stripes', 'cross', 'circles', 'diagonal'];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 5 + Math.floor(Math.random() * 4);
  const countrySeeds: Point[] = [];
  
  for (let i = 0; i < countryCount; i++) {
    const angle = (i / countryCount) * Math.PI * 2;
    const dist = (Math.random() * 0.3 + 0.1) * Math.min(width, height);
    countrySeeds.push({
      x: width / 2 + Math.cos(angle) * dist,
      y: height / 2 + Math.sin(angle) * dist,
    });
  }

  const countries: Country[] = countrySeeds.map((seed, idx) => ({
    id: `country-${idx}`,
    name: `Nations of ${String.fromCharCode(65 + idx)}`,
    color: FLAG_PALETTES[idx % FLAG_PALETTES.length][0],
    flagColors: FLAG_PALETTES[idx % FLAG_PALETTES.length],
    flagPattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
    points: [],
    center: seed,
    settlements: [],
    stats: {
      economy: 100 + Math.random() * 900,
      population: 10 + Math.random() * 90,
      military: {
        ground: 50 + Math.random() * 200,
        air: 20 + Math.random() * 80,
        naval: 10 + Math.random() * 40,
      },
      growthRate: 1.01 + Math.random() * 0.04,
    }
  }));

  const gridSize = 40;
  const grid: { countryId: string; p: Point }[] = [];
  
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      const distToCenter = getDistance(p, { x: width / 2, y: height / 2 });
      if (distToCenter > Math.min(width, height) * 0.45) continue;

      let closestId = countries[0].id;
      let minDist = Infinity;
      
      countries.forEach(c => {
        const d = getDistance(p, c.center);
        if (d < minDist) {
          minDist = d;
          closestId = c.id;
        }
      });
      
      grid.push({ countryId: closestId, p });
    }
  }

  countries.forEach(c => {
    c.points = grid.filter(g => g.countryId === c.id).map(g => g.p);
    
    const capital: Settlement = {
      id: `${c.id}-capital`,
      name: `Capital`,
      type: 'capital',
      coords: c.center,
    };
    
    const cityCount = 2 + Math.floor(Math.random() * 3);
    const cities: Settlement[] = [];
    for (let i = 0; i < cityCount; i++) {
      if (c.points.length === 0) break;
      const randomIdx = Math.floor(Math.random() * c.points.length);
      cities.push({
        id: `${c.id}-city-${i}`,
        name: `City ${i}`,
        type: 'city',
        coords: c.points[randomIdx],
      });
    }

    c.settlements = [capital, ...cities];
  });

  try {
    const loreInput = {
      countries: countries.map(c => ({ id: c.id, name: c.name }))
    };
    const worldLore = await generateGameWorldLore(loreInput);
    
    countries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = countryLore.name;
        c.lore = {
          historicalNarrative: countryLore.historicalNarrative,
          diplomaticRelationships: countryLore.diplomaticRelationships,
          namingConventions: countryLore.namingConventions,
        };
        c.settlements.forEach((s, idx) => {
          if (s.type === 'capital') s.name = countryLore.namingConventions.cityNamesExamples[0] || s.name;
          else if (s.type === 'city') s.name = countryLore.namingConventions.cityNamesExamples[idx] || s.name;
        });
      }
    });
  } catch (err) {
    console.error("Lore generation failed", err);
  }

  return { countries, width, height, gameYear: 2148 };
}

export function processTick(state: GameState): GameState {
  const updatedCountries = state.countries.map(c => {
    const newStats = { ...c.stats };
    
    // Population growth (0.5% - 2% range)
    newStats.population *= (1 + (c.stats.growthRate - 1) * 0.5);
    
    // Economic growth tied to stability and existing population
    newStats.economy *= c.stats.growthRate;

    // Military growth tied to economy (5% of economic growth invested into military)
    const investment = (newStats.economy - c.stats.economy) * 0.05;
    newStats.military.ground += investment * 0.5;
    newStats.military.air += investment * 0.3;
    newStats.military.naval += investment * 0.2;

    return { ...c, stats: newStats };
  });

  return {
    ...state,
    countries: updatedCountries,
    gameYear: state.gameYear + 1
  };
}
