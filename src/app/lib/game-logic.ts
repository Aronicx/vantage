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

export interface Country {
  id: string;
  name: string;
  color: string;
  flagColors: string[];
  flagPattern: 'stripes' | 'cross' | 'circles' | 'diagonal';
  points: Point[]; // Boundary points for SVG
  center: Point;
  settlements: Settlement[];
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
}

const COMMAND_BLUE = '#326194';
const ELECTRIC_GLAZE = '#3DBCCF';
const MIDNIGHT_NAVY = '#0F1216';

const FLAG_PALETTES = [
  ['#D32F2F', '#1976D2', '#FFFFFF'],
  ['#388E3C', '#FBC02D', '#212121'],
  ['#7B1FA2', '#E64A19', '#F5F5F5'],
  ['#0097A7', '#C2185B', '#FFFFFF'],
  ['#326194', '#3DBCCF', '#0F1216'],
];

const PATTERNS: ('stripes' | 'cross' | 'circles' | 'diagonal')[] = ['stripes', 'cross', 'circles', 'diagonal'];

function generateRandomPoint(width: number, height: number): Point {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
  };
}

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 5 + Math.floor(Math.random() * 4);
  const countrySeeds: Point[] = [];
  
  // Center-weighted seeds to keep island feel
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
    name: `Nations of ${String.fromCharCode(65 + idx)}`, // Placeholder
    color: FLAG_PALETTES[idx % FLAG_PALETTES.length][0],
    flagColors: FLAG_PALETTES[idx % FLAG_PALETTES.length],
    flagPattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
    points: [], // Calculated next
    center: seed,
    settlements: [],
  }));

  // Simplified Voronoi-like boundary grid
  const gridSize = 40;
  const grid: { countryId: string; p: Point }[] = [];
  
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      // Check if inside "Island" circle
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

  // Assign grid points to country boundary estimation
  countries.forEach(c => {
    c.points = grid.filter(g => g.countryId === c.id).map(g => g.p);
    
    // Create settlements
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

    const outpostCount = 1 + Math.floor(Math.random() * 2);
    const outposts: Settlement[] = [];
    for (let i = 0; i < outpostCount; i++) {
      if (c.points.length === 0) break;
      const randomIdx = Math.floor(Math.random() * c.points.length);
      outposts.push({
        id: `${c.id}-outpost-${i}`,
        name: `Post ${i}`,
        type: 'outpost',
        coords: c.points[randomIdx],
      });
    }

    c.settlements = [capital, ...cities, ...outposts];
  });

  // Call GenAI to enrich the world
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
        // Rename settlements based on naming conventions
        c.settlements.forEach((s, idx) => {
          if (s.type === 'capital') s.name = countryLore.namingConventions.cityNamesExamples[0] || s.name;
          else if (s.type === 'city') s.name = countryLore.namingConventions.cityNamesExamples[idx] || s.name;
          else s.name = `Post ${countryLore.namingConventions.historicalFiguresNamesExamples[idx % 3] || idx}`;
        });
      }
    });
  } catch (err) {
    console.error("Lore generation failed", err);
  }

  return { countries, width, height };
}
