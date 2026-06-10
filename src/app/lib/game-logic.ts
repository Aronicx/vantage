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
}

export interface Alliance {
  id: string;
  name: string;
  color: string;
  countryIds: string[];
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
  allianceId?: string;
}

export interface GameState {
  countries: Country[];
  alliances: Alliance[];
  width: number;
  height: number;
  gameYear: number;
  isPaused: boolean;
  gameStarted: boolean;
}

const FLAG_PALETTES = [
  ['#D32F2F', '#1976D2', '#FFFFFF'],
  ['#388E3C', '#FBC02D', '#212121'],
  ['#7B1FA2', '#E64A19', '#F5F5F5'],
  ['#0097A7', '#C2185B', '#FFFFFF'],
  ['#FFEB3B', '#4CAF50', '#2196F3'],
  ['#E91E63', '#9C27B0', '#00BCD4'],
];

const ALLIANCE_COLORS = [
  '#FF5722', // Deep Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#4CAF50', // Green
];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 12 + Math.floor(Math.random() * 5);
  const countries: Country[] = [];
  
  const landCenters: Point[] = [];
  const landCenterCount = 4;
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      x: width * (0.2 + Math.random() * 0.6),
      y: height * (0.2 + Math.random() * 0.6)
    });
  }

  for (let i = 0; i < countryCount; i++) {
    const center = landCenters[i % landCenters.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (width * 0.3);
    const seed = {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    };

    const palette = FLAG_PALETTES[i % FLAG_PALETTES.length];
    countries.push({
      id: `country-${i}`,
      name: `Nation ${String.fromCharCode(65 + i)}`,
      color: palette[0],
      flagColors: [...palette],
      flagPattern: 'stripes',
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
        growthRate: 1.01 + Math.random() * 0.02,
      }
    });
  }

  const gridSize = 15;
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      const isLand = landCenters.some(c => getDistance(p, c) < width * 0.35);
      if (!isLand) continue;

      let closestId = '';
      let minDist = Infinity;
      countries.forEach(c => {
        const d = getDistance(p, c.center);
        if (d < minDist) { minDist = d; closestId = c.id; }
      });
      if (closestId) countries.find(c => c.id === closestId)?.points.push(p);
    }
  }

  const finalCountries = countries.filter(c => c.points.length > 5);
  finalCountries.forEach(c => {
    c.settlements.push({ id: `${c.id}-cap`, name: `Capital`, type: 'capital', coords: c.center, ownerId: c.id });
  });

  try {
    const worldLore = await generateGameWorldLore({ countries: finalCountries.map(c => ({ id: c.id, name: c.name })) });
    finalCountries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = countryLore.name;
        const { cityNamesExamples } = countryLore.namingConventions;
        c.settlements.forEach((s) => { if (s.type === 'capital') s.name = cityNamesExamples[0] || s.name; });
      }
    });
  } catch (err) { console.error(err); }

  return { 
    countries: finalCountries, 
    alliances: [],
    width, 
    height, 
    gameYear: 2024, 
    isPaused: false,
    gameStarted: false
  };
}

export function processTick(state: GameState): GameState {
  if (state.isPaused || !state.gameStarted) return state;

  const updatedCountries = state.countries.map(c => {
    const stats = { ...c.stats };
    stats.population *= stats.growthRate;
    stats.economy *= stats.growthRate;
    stats.military.ground *= (1 + (stats.growthRate - 1) * 0.5);
    stats.military.air *= (1 + (stats.growthRate - 1) * 0.5);
    stats.military.naval *= (1 + (stats.growthRate - 1) * 0.5);
    return { ...c, stats };
  });

  return { ...state, countries: updatedCountries, gameYear: state.gameYear + 1 };
}

export function executeBattle(state: GameState, id1: string, id2: string): { state: GameState, result: string } {
  const c1 = state.countries.find(c => c.id === id1);
  const c2 = state.countries.find(c => c.id === id2);
  if (!c1 || !c2) return { state, result: 'Error' };

  const power1 = c1.stats.military.ground + c1.stats.military.air + c1.stats.military.naval;
  const power2 = c2.stats.military.ground + c2.stats.military.air + c2.stats.military.naval;

  const winner = power1 > power2 ? c1 : c2;
  const loser = power1 > power2 ? c2 : c1;
  const ratio = Math.max(power1, power2) / Math.min(power1, power2);

  let lossPercent = 0.1;
  let resultText = 'Minor territory loss';
  if (ratio > 2) { lossPercent = 0.3; resultText = 'Major territory loss'; }
  if (ratio > 5) { lossPercent = 0.6; resultText = 'Crushing Defeat'; }

  const pointsToTransferCount = Math.floor(loser.points.length * lossPercent);
  const transferredPoints = loser.points.splice(0, pointsToTransferCount);
  winner.points.push(...transferredPoints);

  // Update settlements
  loser.settlements.forEach(s => {
    const isNowInWinnerTerritory = winner.points.some(p => getDistance(p, s.coords) < 20);
    if (isNowInWinnerTerritory) s.ownerId = winner.id;
  });

  return { state: { ...state }, result: `${winner.name} victory: ${resultText}` };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  const alliancePowers = state.alliances.map(a => {
    const power = a.countryIds.reduce((sum, cid) => {
      const c = state.countries.find(curr => curr.id === cid);
      return sum + (c ? (c.stats.military.ground + c.stats.military.air + c.stats.military.naval) : 0);
    }, 0);
    return { id: a.id, power };
  });

  const sorted = [...alliancePowers].sort((a, b) => b.power - a.power);
  const winnerId = sorted[0].id;

  state.alliances.forEach(a => {
    if (a.id === winnerId) return;
    // Loser alliances lose 20% territory distributed to winners
    a.countryIds.forEach(cid => {
      const loser = state.countries.find(c => c.id === cid);
      if (!loser) return;
      const amount = Math.floor(loser.points.length * 0.25);
      const points = loser.points.splice(0, amount);
      
      const winnerAlliance = state.alliances.find(wa => wa.id === winnerId);
      const randomWinnerCid = winnerAlliance?.countryIds[Math.floor(Math.random() * winnerAlliance.countryIds.length)];
      const winnerC = state.countries.find(c => c.id === randomWinnerCid);
      if (winnerC) winnerC.points.push(...points);
    });
  });

  return { ...state };
}

export function createAlliance(state: GameState, countryIds: string[]): GameState {
  if (countryIds.length === 0) return state;
  const strongest = countryIds.reduce((prev, currId) => {
    const c = state.countries.find(x => x.id === currId);
    const p = c ? (c.stats.military.ground + c.stats.military.air) : 0;
    return p > prev.power ? { id: currId, power: p } : prev;
  }, { id: '', power: -1 });

  const leader = state.countries.find(c => c.id === strongest.id);
  const alliance: Alliance = {
    id: `alliance-${state.alliances.length}`,
    name: `${leader?.name} Coalition`,
    color: ALLIANCE_COLORS[state.alliances.length % ALLIANCE_COLORS.length],
    countryIds: [...countryIds]
  };

  const updatedCountries = state.countries.map(c => {
    if (countryIds.includes(c.id)) return { ...c, allianceId: alliance.id };
    return c;
  });

  return { ...state, alliances: [...state.alliances, alliance], countries: updatedCountries };
}
