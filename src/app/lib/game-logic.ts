import { generateGameWorldLore } from '@/ai/flows/generate-game-world-lore';

export interface Point {
  x: number;
  y: number;
}

export interface MilitaryStats {
  ground: number;
  air: number;
  naval: number;
}

export interface SettlementStats {
  economy: number;
  population: number;
  military: MilitaryStats;
}

export interface Settlement {
  id: string;
  name: string;
  type: 'capital' | 'city' | 'outpost';
  coords: Point;
  ownerId: string;
  stats: SettlementStats;
}

export interface CountryStats {
  economy: number;
  population: number;
  military: MilitaryStats;
  growthRate: number;
  isLandlocked: boolean;
  warReadiness: number; // 0 to 100
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
  recoveryEndYear?: number;
}

export const POLITICAL_COLORS = [
  '#F28482', '#84A59D', '#F5CAC3', '#F7EDE2', '#F6BD60', 
  '#FF9F1C', '#2EC4B6', '#E71D36', '#CB997E', 
  '#A5A58D', '#6B705C', '#B7B7A4', '#FFE8D6', '#DDBEA9',
  '#577590', '#4D908E', '#43AA8B', '#90BE6D', '#F9C74F', '#F9844A'
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

/**
 * Calculates a score for a city to determine its fitness as a capital.
 */
function scoreCityForCapital(s: Settlement, c: Country, landPointSet: Set<string>, gridSize: number = 5): number {
  // 1. Economic and Demographic Power (High Weight)
  const powerScore = (s.stats.economy * 1.5) + (s.stats.population * 10);
  
  // 2. Military Value
  const milScore = (s.stats.military.ground + s.stats.military.air + s.stats.military.naval) * 0.8;
  
  // 3. Coastal Access Bonus (Trade/Resource advantage)
  let isCoastal = false;
  const neighbors = [
    {x: s.coords.x + gridSize, y: s.coords.y},
    {x: s.coords.x - gridSize, y: s.coords.y},
    {x: s.coords.x, y: s.coords.y + gridSize},
    {x: s.coords.x, y: s.coords.y - gridSize}
  ];
  if (neighbors.some(n => !landPointSet.has(`${n.x},${n.y}`))) {
    isCoastal = true;
  }
  const coastalBonus = isCoastal ? 50 : 0;

  // 4. Strategic Safety (Distance from the country's center is a proxy for being "inland" and protected)
  // Higher score for cities closer to the geometric center of the country's points
  const distToCenter = getDistance(s.coords, c.center);
  const safetyScore = Math.max(0, 100 - distToCenter);

  return powerScore + milScore + coastalBonus + safetyScore;
}

/**
 * Aggregates all settlement stats into the country's total stats.
 */
function updateCountryAggregates(country: Country): Country {
  const totalStats: SettlementStats = country.settlements.reduce((acc, s) => ({
    economy: acc.economy + s.stats.economy,
    population: acc.population + s.stats.population,
    military: {
      ground: acc.military.ground + s.stats.military.ground,
      air: acc.military.air + s.stats.military.air,
      naval: acc.military.naval + s.stats.military.naval,
    }
  }), {
    economy: 0,
    population: 0,
    military: { ground: 0, air: 0, naval: 0 }
  });

  country.stats.economy = totalStats.economy;
  country.stats.population = totalStats.population;
  country.stats.military = totalStats.military;

  return country;
}

/**
 * Ensures country centers, settlement owners, and internal provinces are consistent.
 */
function rebuildCountryMetadata(country: Country, landPointSet: Set<string>, gridSize: number = 5): Country {
  if (country.points.length === 0) return country;

  const pointSet = new Set(country.points.map(p => `${p.x},${p.y}`));
  
  // 1. Validate settlements (remove those lost to other countries)
  country.settlements = country.settlements.filter(s => pointSet.has(`${s.coords.x},${s.coords.y}`));

  // 2. Recalculate geometric center
  const avgX = country.points.reduce((s, p) => s + p.x, 0) / country.points.length;
  const avgY = country.points.reduce((s, p) => s + p.y, 0) / country.points.length;
  const newCenter = { x: avgX, y: avgY };
  country.center = newCenter;

  // 3. Ensure a capital exists and is intelligently selected
  let currentCapital = country.settlements.find(s => s.type === 'capital');
  
  // If no capital, or we need to re-evaluate (e.g. current one is not the best anymore)
  if (!currentCapital && country.settlements.length > 0) {
    // Score all cities and pick the best one
    const scoredCities = country.settlements.map(s => ({
      settlement: s,
      score: scoreCityForCapital(s, country, landPointSet, gridSize)
    }));
    
    scoredCities.sort((a, b) => b.score - a.score);
    const best = scoredCities[0].settlement;
    best.type = 'capital';
    currentCapital = best;
  } else if (!currentCapital && country.points.length > 0) {
    // Emergent case: No settlements left, create a provisional one at the center
    let closestPoint = country.points[0];
    let minDist = Infinity;
    for (const p of country.points) {
      const d = getDistance(p, newCenter);
      if (d < minDist) { minDist = d; closestPoint = p; }
    }
    currentCapital = {
      id: `${country.id}-cap-auto-${Date.now()}`,
      name: "New Capital",
      type: 'capital',
      coords: closestPoint,
      ownerId: country.id,
      stats: {
        economy: 20,
        population: 0.5,
        military: { ground: 5, air: 2, naval: 0 }
      }
    };
    country.settlements.push(currentCapital);
  }

  // 4. Regenerate internal province zones
  const provinceCount = Math.max(3, Math.floor(country.points.length / 100));
  const provinceSeeds: Point[] = country.settlements.map(s => s.coords);
  while (provinceSeeds.length < provinceCount && country.points.length > 0) {
    provinceSeeds.push(country.points[Math.floor(Math.random() * country.points.length)]);
  }

  country.provinces = provinceSeeds.map((seed, idx) => ({ 
    id: `${country.id}-prov-${idx}`, 
    points: [], 
    center: seed 
  }));

  country.points.forEach(p => {
    let closestIdx = 0;
    let minDist = Infinity;
    provinceSeeds.forEach((ps, idx) => {
      const d = getDistance(p, ps);
      if (d < minDist) { minDist = d; closestIdx = idx; }
    });
    country.provinces[closestIdx].points.push(p);
  });

  return updateCountryAggregates(country);
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 7 + Math.floor(Math.random() * 4);
  const countries: Country[] = [];
  const landCenters: {p: Point, r: number}[] = [];
  const padding = width * 0.12;

  landCenters.push({ p: { x: width/2, y: height/2 }, r: width * 0.22 });
  for(let i=0; i<8; i++) {
    landCenters.push({ 
      p: { x: width/2 + (Math.random()-0.5)*width*0.5, y: height/2 + (Math.random()-0.5)*height*0.5 }, 
      r: width * (0.05 + Math.random()*0.1) 
    });
  }

  const gridSize = 5;
  const landPoints: Point[] = [];
  const landPointSet = new Set<string>();

  for (let x = padding; x < width - padding; x += gridSize) {
    for (let y = padding; y < height - padding; y += gridSize) {
      const p = { x, y };
      if (landCenters.some(lc => getDistance(p, lc.p) < lc.r)) {
        landPoints.push(p);
        landPointSet.add(`${x},${y}`);
      }
    }
  }

  for (let i = 0; i < countryCount; i++) {
    const seed = landPoints[Math.floor(Math.random() * landPoints.length)];
    const color = POLITICAL_COLORS[i % POLITICAL_COLORS.length];
    const palette = FLAG_PALETTES[i % FLAG_PALETTES.length];
    
    countries.push({
      id: `country-${i}`,
      name: `Nation ${String.fromCharCode(65 + i)}`,
      color,
      flagColors: [...palette],
      flagPattern: 'stripes',
      points: [],
      center: seed,
      settlements: [],
      provinces: [],
      stats: { economy: 0, population: 0, military: { ground: 0, air: 0, naval: 0 }, growthRate: 1.01, isLandlocked: true, warReadiness: 100 }
    });
  }

  landPoints.forEach(p => {
    let closestId = countries[0].id;
    let minDist = Infinity;
    countries.forEach(c => {
      const d = getDistance(p, c.center);
      if (d < minDist) { minDist = d; closestId = c.id; }
    });
    countries.find(c => c.id === closestId)?.points.push(p);
  });

  const finalCountries = countries.filter(c => c.points.length > 50);

  finalCountries.forEach(c => {
    let isLandlocked = true;
    for (const p of c.points) {
      const neighbors = [{x:p.x+gridSize, y:p.y}, {x:p.x-gridSize, y:p.y}, {x:p.x, y:p.y+gridSize}, {x:p.x, y:p.y-gridSize}];
      if (neighbors.some(n => !landPointSet.has(`${n.x},${n.y}`))) { isLandlocked = false; break; }
    }
    c.stats.isLandlocked = isLandlocked;
    
    // Geography Bonuses
    const econBonus = isLandlocked ? 0.9 : 1.15;
    const growthBase = isLandlocked ? 1.008 : 1.014;
    c.stats.growthRate = growthBase;

    // Place Capital
    c.settlements.push({ 
      id: `${c.id}-cap`, 
      name: "Capital City", 
      type: 'capital', 
      coords: c.center, 
      ownerId: c.id,
      stats: {
        economy: 50 * econBonus,
        population: 2 * econBonus,
        military: { ground: 30 * econBonus, air: 15 * econBonus, naval: 10 * (isLandlocked ? 0 : econBonus) }
      }
    });

    // Place Cities
    const cityCount = 2 + Math.floor(c.points.length / 150);
    for(let j=0; j<cityCount; j++) {
       const cityPoint = c.points[Math.floor(Math.random() * c.points.length)];
       const isOutpost = Math.random() > 0.4;
       c.settlements.push({
         id: `${c.id}-city-${j}`,
         name: isOutpost ? `Outpost ${j+1}` : `City ${j+1}`,
         type: isOutpost ? 'outpost' : 'city',
         coords: cityPoint,
         ownerId: c.id,
         stats: {
           economy: (isOutpost ? 10 : 25) * econBonus,
           population: (isOutpost ? 0.5 : 1.5) * econBonus,
           military: { 
             ground: (isOutpost ? 20 : 15) * econBonus, 
             air: (isOutpost ? 5 : 8) * econBonus, 
             naval: (isLandlocked ? 0 : (isOutpost ? 2 : 5) * econBonus) 
           }
         }
       });
    }
    rebuildCountryMetadata(c, landPointSet, gridSize);
  });

  try {
    const worldLore = await generateGameWorldLore({ countries: finalCountries.map(c => ({ id: c.id, name: c.name })) });
    finalCountries.forEach(c => {
      const lore = worldLore.countriesLore.find(l => l.id === c.id);
      if (lore) {
        c.name = lore.name;
        c.settlements.forEach((s, idx) => {
          if (s.type === 'capital') s.name = lore.namingConventions.cityNamesExamples[0] || s.name;
          else if (idx < lore.namingConventions.cityNamesExamples.length) s.name = lore.namingConventions.cityNamesExamples[idx] || s.name;
        });
      }
    });
  } catch (err) { console.warn("Lore Generation Failed", err); }

  return { 
    countries: finalCountries, 
    alliances: [], 
    width, height, gameYear: 2024, 
    isPaused: true, gameStarted: false, simulationSpeed: 1,
    landPointSet: Array.from(landPointSet)
  };
}

export function processTick(state: GameState): GameState {
  if (state.isPaused || !state.gameStarted) return state;

  const updatedCountries = state.countries.map(c => {
    let growth = c.stats.growthRate * (0.999 + Math.random() * 0.002);
    
    // Recovery Logic: If capital was recently lost
    if (c.recoveryEndYear && state.gameYear < c.recoveryEndYear) {
      const isVerySmall = c.points.length < 150;
      const penaltyFactor = isVerySmall ? 15 : 6; // 10-15x or 5-7x slower
      
      // Reduce the 'excess' growth above 1.0
      const excess = growth - 1.0;
      growth = 1.0 + (excess / penaltyFactor);
    }

    // Recover War Readiness
    const nextReadiness = Math.min(100, c.stats.warReadiness + 3);

    const nextSettlements = c.settlements.map(s => ({
      ...s,
      stats: {
        economy: s.stats.economy * growth,
        population: s.stats.population * (1 + (growth - 1) * 0.8),
        military: {
          ground: s.stats.military.ground * growth,
          air: s.stats.military.air * growth,
          naval: s.stats.military.naval * growth,
        }
      }
    }));

    const updated = {
      ...c,
      settlements: nextSettlements,
      stats: { ...c.stats, warReadiness: nextReadiness }
    };
    return updateCountryAggregates(updated);
  });
  return { ...state, countries: updatedCountries, gameYear: state.gameYear + 1 };
}

export function executeBattle(state: GameState, id1: string, id2: string, forcedWinnerId?: string): { state: GameState, result: string } {
  const c1 = state.countries.find(c => c.id === id1);
  const c2 = state.countries.find(c => c.id === id2);
  if (!c1 || !c2) return { state, result: 'Error' };

  // Power is highly deterministic now. Luck is +/- 5%.
  const calculatePower = (c: Country) => (
    (c.stats.military.ground + c.stats.military.air + (c.stats.military.naval * 0.7)) * 1.0 +
    (c.stats.economy * 0.15) + (c.stats.population * 2)
  ) * (0.4 + (c.stats.warReadiness / 100) * 0.6);

  const p1Base = calculatePower(c1);
  const p2Base = calculatePower(c2);
  
  // Randomness is only 5% of total influence
  const p1 = p1Base * (0.975 + Math.random() * 0.05);
  const p2 = p2Base * (0.975 + Math.random() * 0.05);

  const winnerId = forcedWinnerId || (p1 > p2 ? c1.id : c2.id);
  const loserId = winnerId === id1 ? id2 : id1;
  
  const winner = { ...state.countries.find(c => c.id === winnerId)! };
  const loser = { ...state.countries.find(c => c.id === loserId)! };

  // Decrease War Readiness significantly
  winner.stats.warReadiness = Math.max(30, winner.stats.warReadiness - 12);
  loser.stats.warReadiness = Math.max(10, loser.stats.warReadiness - 28);

  // Target city closest to winner's mass
  const targetCity = [...loser.settlements]
    .sort((a,b) => getDistance(a.coords, winner.center) - getDistance(b.coords, winner.center))[0];

  if (!targetCity) return { state, result: "Frontlines stable. No targets reachable." };

  // Check if capital was captured
  let capturedCapital = targetCity.type === 'capital';
  if (capturedCapital) {
    targetCity.type = 'city'; // Downgrade to regular city for the winner
    loser.recoveryEndYear = state.gameYear + 25; // 25 years of struggle
  }

  targetCity.ownerId = winnerId;
  winner.settlements.push(targetCity);
  loser.settlements = loser.settlements.filter(s => s.id !== targetCity.id);

  const transferredPoints: Point[] = [];
  const remainingPoints: Point[] = [];
  const gridSize = 5;

  loser.points.forEach(p => {
    const distToCaptured = getDistance(p, targetCity.coords);
    let minDistToRemaining = Infinity;
    loser.settlements.forEach(s => {
      const d = getDistance(p, s.coords);
      if (d < minDistToRemaining) minDistToRemaining = d;
    });

    if (distToCaptured < minDistToRemaining * 0.85) transferredPoints.push(p);
    else remainingPoints.push(p);
  });

  winner.points.push(...transferredPoints);
  loser.points = remainingPoints;

  const landSet = new Set(state.landPointSet);
  const updatedWinner = rebuildCountryMetadata(winner, landSet, gridSize);
  const updatedLoser = rebuildCountryMetadata(loser, landSet, gridSize);

  let nextCountries = state.countries.map(c => {
    if (c.id === winner.id) return updatedWinner;
    if (c.id === loser.id) return updatedLoser;
    return c;
  });

  if (updatedLoser.points.length < 20 || updatedLoser.settlements.length === 0) {
    nextCountries = nextCountries.filter(c => c.id !== loserId);
  }

  const captureDesc = capturedCapital ? `Seized the capital ${targetCity.name}!` : `Captured ${targetCity.name}.`;
  return { state: { ...state, countries: nextCountries }, result: `${captureDesc} Frontlines shifted.` };
}

export function renameCountry(state: GameState, id: string, newName: string): GameState {
  return { ...state, countries: state.countries.map(c => c.id === id ? { ...c, name: newName } : c) };
}

export function updateCountryColor(state: GameState, id: string, newColor: string): GameState {
  return { ...state, countries: state.countries.map(c => c.id === id ? { ...c, color: newColor } : c) };
}

export function mergeCountries(state: GameState, ids: string[], customName: string): GameState {
  if (ids.length < 2) return state;
  const participants = state.countries.filter(c => ids.includes(c.id));
  participants.sort((a,b) => b.stats.economy - a.stats.economy);
  
  const dominant = participants[0];
  const mergedId = `merged-${Date.now()}`;
  const allPoints = participants.flatMap(p => p.points);
  const allSettlements = participants.flatMap(p => p.settlements).map(s => ({ ...s, ownerId: mergedId, type: s.type === 'capital' ? 'city' : s.type }));

  const merged: Country = {
    ...dominant,
    id: mergedId,
    name: customName || `United ${dominant.name}`,
    points: allPoints,
    settlements: allSettlements,
    stats: {
      economy: 0,
      population: 0,
      military: { ground: 0, air: 0, naval: 0 },
      growthRate: dominant.stats.growthRate,
      isLandlocked: dominant.stats.isLandlocked,
      warReadiness: Math.min(...participants.map(p => p.stats.warReadiness))
    }
  };

  const landSet = new Set(state.landPointSet);
  const final = rebuildCountryMetadata(merged, landSet, 5);
  return { ...state, countries: state.countries.filter(c => !ids.includes(c.id)).concat(final) };
}

export function splitCountry(state: GameState, targetId: string, parts: number, successorNames: string[]): GameState {
  const target = state.countries.find(c => c.id === targetId);
  if (!target || parts < 2) return state;

  const partitions: Point[][] = Array.from({ length: parts }, () => []);
  const seeds: Point[] = [];
  for(let i=0; i<parts; i++) {
    seeds.push(target.points[Math.floor(Math.random() * target.points.length)]);
  }

  target.points.forEach(p => {
    let best = 0;
    let minDist = Infinity;
    seeds.forEach((s, idx) => {
      const d = getDistance(p, s);
      if (d < minDist) { minDist = d; best = idx; }
    });
    partitions[best].push(p);
  });

  const landSet = new Set(state.landPointSet);
  const nextCountries: Country[] = partitions.map((pts, i) => {
    const name = successorNames[i] || `${target.name} Splinter ${i+1}`;
    const id = `splinter-${targetId}-${i}-${Date.now()}`;
    
    const ptSet = new Set(pts.map(p => `${p.x},${p.y}`));
    const splinterSettlements = target.settlements
      .filter(s => ptSet.has(`${s.coords.x},${s.coords.y}`))
      .map(s => ({ ...s, ownerId: id, type: 'city' as const }));

    const country: Country = {
      ...target,
      id,
      name,
      color: POLITICAL_COLORS[Math.floor(Math.random() * POLITICAL_COLORS.length)],
      points: pts,
      settlements: splinterSettlements,
      stats: {
        economy: 0,
        population: 0,
        military: { ground: 0, air: 0, naval: 0 },
        growthRate: target.stats.growthRate,
        isLandlocked: target.stats.isLandlocked,
        warReadiness: target.stats.warReadiness
      }
    };
    return rebuildCountryMetadata(country, landSet, 5);
  }).filter(c => c.points.length > 5);

  return { ...state, countries: state.countries.filter(c => c.id !== targetId).concat(nextCountries) };
}

export function createAlliance(state: GameState, countryIds: string[]): GameState {
  const alliance: Alliance = {
    id: `all-${Date.now()}`,
    name: "Strategic Coalition",
    color: '#F9C74F',
    countryIds
  };
  return {
    ...state,
    alliances: [...state.alliances, alliance],
    countries: state.countries.map(c => countryIds.includes(c.id) ? { ...c, allianceId: alliance.id } : c)
  };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;
  const sorted = [...state.alliances].sort((a,b) => {
    const pA = a.countryIds.reduce((sum, cid) => sum + (state.countries.find(x => x.id === cid)?.stats.economy || 0), 0);
    const pB = b.countryIds.reduce((sum, cid) => sum + (state.countries.find(x => x.id === cid)?.stats.economy || 0), 0);
    return pB - pA;
  });

  const winner = sorted[0];
  const losers = sorted.slice(1);

  let currentCountries = [...state.countries];
  losers.forEach(all => {
    all.countryIds.forEach(cid => {
      const receiver = winner.countryIds[Math.floor(Math.random() * winner.countryIds.length)];
      const res = executeBattle({ ...state, countries: currentCountries }, receiver, cid, receiver);
      currentCountries = res.state.countries;
    });
  });

  return { ...state, countries: currentCountries, alliances: [] };
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
  landPointSet: string[];
}
