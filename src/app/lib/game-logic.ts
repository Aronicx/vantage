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

export interface Province {
  id: string;
  points: Point[];
  center: Point;
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
  provinces: Province[];
}

export interface GameState {
  countries: Country[];
  alliances: Alliance[];
  width: number;
  height: number;
  gameYear: number;
  isPaused: boolean;
  gameStarted: boolean;
  simulationSpeed: number;
}

const POLITICAL_COLORS = [
  '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557',
  '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#264653',
  '#606C38', '#283618', '#DDA15E', '#BC6C25', '#9B2226'
];

const FLAG_PALETTES = [
  ['#FF5252', '#FFEB3B', '#1976D2'],
  ['#4CAF50', '#FFFFFF', '#FF9800'],
  ['#9C27B0', '#00BCD4', '#E91E63'],
  ['#795548', '#FFC107', '#3F51B5'],
  ['#607D8B', '#FFFFFF', '#F44336'],
  ['#CDDC39', '#212121', '#009688'],
];

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 12 + Math.floor(Math.random() * 4);
  const countries: Country[] = [];
  
  const landCenters: {p: Point, r: number}[] = [];
  const landCenterCount = 4 + Math.floor(Math.random() * 2);
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      p: {
        x: width * (0.3 + Math.random() * 0.4),
        y: height * (0.3 + Math.random() * 0.4)
      },
      r: width * (0.18 + Math.random() * 0.15)
    });
  }

  for (let i = 0; i < countryCount; i++) {
    let seed: Point = { x: 0, y: 0 };
    let found = false;
    while (!found) {
      const candidate = { x: Math.random() * width, y: Math.random() * height };
      if (landCenters.some(lc => getDistance(candidate, lc.p) < lc.r)) {
        seed = candidate;
        found = true;
      }
    }

    const color = POLITICAL_COLORS[i % POLITICAL_COLORS.length];
    const palette = FLAG_PALETTES[i % FLAG_PALETTES.length];
    countries.push({
      id: `country-${i}`,
      name: `Nation ${String.fromCharCode(65 + i)}`,
      color: color,
      flagColors: [...palette],
      flagPattern: ['stripes', 'cross', 'diagonal', 'circles'][Math.floor(Math.random() * 4)] as any,
      points: [],
      center: seed,
      settlements: [],
      provinces: [],
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

  const gridSize = 10;
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const p = { x, y };
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

  const finalCountries = countries.filter(c => c.points.length > 5);

  finalCountries.forEach(c => {
    // Generate internal provinces
    const provinceCount = 3 + Math.floor(Math.random() * 3);
    const provinceSeeds: Point[] = [];
    for(let i=0; i<provinceCount; i++) {
      provinceSeeds.push(c.points[Math.floor(Math.random() * c.points.length)]);
    }
    
    provinceSeeds.forEach((seed, idx) => {
      c.provinces.push({ id: `${c.id}-prov-${idx}`, points: [], center: seed });
    });

    c.points.forEach(p => {
      let closestIdx = 0;
      let minDist = Infinity;
      provinceSeeds.forEach((ps, idx) => {
        const d = getDistance(p, ps);
        if (d < minDist) { minDist = d; closestIdx = idx; }
      });
      c.provinces[closestIdx].points.push(p);
    });

    // Capital
    c.settlements.push({ id: `${c.id}-cap`, name: `Capital`, type: 'capital', coords: c.center, ownerId: c.id });
    
    // Cities
    const settlementCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < settlementCount; i++) {
      const randomPoint = c.points[Math.floor(Math.random() * c.points.length)];
      c.settlements.push({
        id: `${c.id}-city-${i}`,
        name: 'City',
        type: Math.random() > 0.4 ? 'city' : 'outpost',
        coords: randomPoint,
        ownerId: c.id
      });
    }
  });

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
    isPaused: true,
    gameStarted: false,
    simulationSpeed: 1
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

  let lossPercent = 0.1;
  let resultText = 'Border skirmish resulted in minor territory shifts.';
  if (ratio > 2) { lossPercent = 0.25; resultText = 'Strategic push leads to significant annexation.'; }
  if (ratio > 5) { lossPercent = 0.5; resultText = 'Total breakthrough! Enemy territory collapsing.'; }

  const pointsToTransferCount = Math.floor(loser.points.length * lossPercent);
  loser.points.sort((a, b) => getDistance(a, winner.center) - getDistance(b, winner.center));
  const transferredPoints = loser.points.splice(0, pointsToTransferCount);
  winner.points.push(...transferredPoints);

  // Recalculate provinces after points transfer
  [winner, loser].forEach(country => {
    if (country.points.length === 0) return;
    country.provinces.forEach(p => p.points = []);
    country.points.forEach(p => {
      let closestIdx = 0;
      let minDist = Infinity;
      country.provinces.forEach((prov, idx) => {
        const d = getDistance(p, prov.center);
        if (d < minDist) { minDist = d; closestIdx = idx; }
      });
      country.provinces[closestIdx].points.push(p);
    });
  });

  loser.settlements.forEach(s => {
    const isNowCaptured = transferredPoints.some(tp => getDistance(tp, s.coords) < 15);
    if (isNowCaptured) s.ownerId = winner.id;
  });

  const capturedSettlements = loser.settlements.filter(s => s.ownerId === winner.id);
  loser.settlements = loser.settlements.filter(s => s.ownerId !== winner.id);
  winner.settlements.push(...capturedSettlements);

  let finalCountries = [...state.countries];
  if (loser.points.length === 0) {
    resultText = `${loser.name} has been annexed into ${winner.name}.`;
    finalCountries = finalCountries.filter(c => c.id !== loser.id);
  }

  return { state: { ...state, countries: finalCountries }, result: resultText };
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

  const winnerAlliance = [...alliancePowers].sort((a, b) => b.power - a.power)[0];
  const winnerRef = state.alliances.find(a => a.id === winnerAlliance.id)!;

  let nextState = { ...state };

  state.alliances.forEach(a => {
    if (a.id === winnerAlliance.id) return;
    
    a.countryIds.forEach(cid => {
      const loserC = nextState.countries.find(c => c.id === cid);
      if (!loserC) return;
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
