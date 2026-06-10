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
  ['#FF5252', '#FFEB3B', '#1976D2'], // Red, Yellow, Blue
  ['#4CAF50', '#FFFFFF', '#FF9800'], // Green, White, Orange
  ['#9C27B0', '#00BCD4', '#E91E63'], // Purple, Cyan, Pink
  ['#795548', '#FFC107', '#3F51B5'], // Brown, Amber, Indigo
  ['#607D8B', '#FFFFFF', '#F44336'], // Blue Grey, White, Red
  ['#CDDC39', '#212121', '#009688'], // Lime, Black, Teal
];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 15 + Math.floor(Math.random() * 5);
  const countries: Country[] = [];
  
  // Create an organic "Landmass" using several large overlapping circles
  const landCenters: {p: Point, r: number}[] = [];
  const landCenterCount = 5 + Math.floor(Math.random() * 3);
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      p: {
        x: width * (0.3 + Math.random() * 0.4),
        y: height * (0.3 + Math.random() * 0.4)
      },
      r: width * (0.15 + Math.random() * 0.2)
    });
  }

  // Generate Country Seeds
  for (let i = 0; i < countryCount; i++) {
    // Pick a point that is inside the landmass
    let seed: Point = { x: 0, y: 0 };
    let found = false;
    while (!found) {
      const candidate = { x: Math.random() * width, y: Math.random() * height };
      if (landCenters.some(lc => getDistance(candidate, lc.p) < lc.r)) {
        seed = candidate;
        found = true;
      }
    }

    const palette = FLAG_PALETTES[i % FLAG_PALETTES.length];
    countries.push({
      id: `country-${i}`,
      name: `Nation ${String.fromCharCode(65 + i)}`,
      color: palette[0],
      flagColors: [...palette],
      flagPattern: ['stripes', 'cross', 'diagonal', 'circles'][Math.floor(Math.random() * 4)] as any,
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

  // Populate grid points to countries (Voronoi-like assignment)
  const gridSize = 18; // Smaller grid = higher resolution borders
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
      // Check if point is land
      const isLand = landCenters.some(lc => getDistance(p, lc.p) < lc.r);
      if (!isLand) continue;

      let closestId = '';
      let minDist = Infinity;
      countries.forEach(c => {
        const d = getDistance(p, c.center);
        if (d < minDist) { minDist = d; closestId = c.id; }
      });
      if (closestId) {
        countries.find(c => c.id === closestId)?.points.push(p);
      }
    }
  }

  // Filter out tiny slivers
  const finalCountries = countries.filter(c => c.points.length > 3);

  // Generate Settlements
  finalCountries.forEach(c => {
    // Capital
    c.settlements.push({ id: `${c.id}-cap`, name: `Capital`, type: 'capital', coords: c.center, ownerId: c.id });
    
    // Cities & Outposts
    const settlementCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < settlementCount; i++) {
      if (c.points.length > 5) {
        const randomPoint = c.points[Math.floor(Math.random() * c.points.length)];
        c.settlements.push({
          id: `${c.id}-city-${i}`,
          name: i === 0 ? 'Port' : 'City',
          type: Math.random() > 0.3 ? 'city' : 'outpost',
          coords: randomPoint,
          ownerId: c.id
        });
      }
    }
  });

  // AI Lore Generation
  try {
    const worldLore = await generateGameWorldLore({ countries: finalCountries.map(c => ({ id: c.id, name: c.name })) });
    finalCountries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = countryLore.name;
        const { cityNamesExamples } = countryLore.namingConventions;
        c.settlements.forEach((s, idx) => { 
          if (s.type === 'capital') s.name = cityNamesExamples[0] || s.name;
          else if (cityNamesExamples[idx + 1]) s.name = cityNamesExamples[idx + 1];
        });
      }
    });
  } catch (err) { console.error("Lore Generation Failed", err); }

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

  const power1 = c1.stats.military.ground + c1.stats.military.air + (c1.stats.military.naval * 0.5);
  const power2 = c2.stats.military.ground + c2.stats.military.air + (c2.stats.military.naval * 0.5);

  const winner = power1 > power2 ? c1 : c2;
  const loser = power1 > power2 ? c2 : c1;
  const ratio = Math.max(power1, power2) / Math.min(power1, power2);

  let lossPercent = 0.15;
  let resultText = 'Minor Border Shift';
  if (ratio > 2) { lossPercent = 0.35; resultText = 'Significant Annexation'; }
  if (ratio > 5) { lossPercent = 0.65; resultText = 'Devastating Territorial Collapse'; }

  // Transfer points from loser to winner
  const pointsToTransferCount = Math.floor(loser.points.length * lossPercent);
  
  // Take points closest to the winner's center first (simulates frontier push)
  loser.points.sort((a, b) => getDistance(a, winner.center) - getDistance(b, winner.center));
  const transferredPoints = loser.points.splice(0, pointsToTransferCount);
  winner.points.push(...transferredPoints);

  // Update settlements ownership
  loser.settlements.forEach(s => {
    const isNowCaptured = transferredPoints.some(tp => getDistance(tp, s.coords) < 15);
    if (isNowCaptured) s.ownerId = winner.id;
  });

  // Transfer settlements to winner object if they changed ownerId
  const capturedSettlements = loser.settlements.filter(s => s.ownerId === winner.id);
  loser.settlements = loser.settlements.filter(s => s.ownerId !== winner.id);
  winner.settlements.push(...capturedSettlements);

  // Cleanup: If loser has no points, they are conquered
  let finalCountries = [...state.countries];
  if (loser.points.length === 0) {
    resultText = `${loser.name} has been fully annexed by ${winner.name}!`;
    finalCountries = finalCountries.filter(c => c.id !== loser.id);
  }

  return { state: { ...state, countries: finalCountries }, result: resultText };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  // Simple alliance war: The strongest alliance takes territory from all other alliances
  const alliancePowers = state.alliances.map(a => {
    const power = a.countryIds.reduce((sum, cid) => {
      const c = state.countries.find(curr => curr.id === cid);
      return sum + (c ? (c.stats.military.ground + c.stats.military.air + c.stats.military.naval) : 0);
    }, 0);
    return { id: a.id, power };
  });

  const winnerAlliance = [...alliancePowers].sort((a, b) => b.power - a.power)[0];
  const winnerRef = state.alliances.find(a => a.id === winnerAlliance.id)!;

  let nextState = { ...state };

  state.alliances.forEach(a => {
    if (a.id === winnerAlliance.id) return;
    
    a.countryIds.forEach(cid => {
      const loserC = nextState.countries.find(c => c.id === cid);
      if (!loserC) return;

      // Pick a random winner country to receive the land
      const receiverCid = winnerRef.countryIds[Math.floor(Math.random() * winnerRef.countryIds.length)];
      const res = executeBattle(nextState, receiverCid, loserC.id);
      nextState = res.state;
    });
  });

  return nextState;
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
    id: `alliance-${state.alliances.length}-${Date.now()}`,
    name: `${leader?.name} Coalition`,
    color: ['#FF5722', '#9C27B0', '#00BCD4', '#4CAF50'][state.alliances.length % 4],
    countryIds: [...countryIds]
  };

  const updatedCountries = state.countries.map(c => {
    if (countryIds.includes(c.id)) return { ...c, allianceId: alliance.id };
    return c;
  });

  return { ...state, alliances: [...state.alliances, alliance], countries: updatedCountries };
}
