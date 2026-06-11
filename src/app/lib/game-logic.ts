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
  warReadiness: number; // 0 to 100
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
  warReadiness: number; // Aggregated from settlements
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

export type BattleMode = 'attacker' | 'defender' | 'mutual';

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

function getPointsOnLine(p1: Point, p2: Point, count: number): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    });
  }
  return points;
}

function isCoastal(coords: Point, landPointSet: Set<string>, gridSize: number = 5): boolean {
  const neighbors = [
    {x: coords.x + gridSize, y: coords.y},
    {x: coords.x - gridSize, y: coords.y},
    {x: coords.x, y: gridSize + coords.y},
    {x: coords.x, y: coords.y - gridSize}
  ];
  return neighbors.some(n => !landPointSet.has(`${n.x},${n.y}`));
}

function checkSharingLandBorder(c1: Country, c2: Country, gridSize: number = 5): boolean {
  const p2Set = new Set(c2.points.map(p => `${p.x},${p.y}`));
  for (const p of c1.points) {
    const neighbors = [
      `${p.x + gridSize},${p.y}`,
      `${p.x - gridSize},${p.y}`,
      `${p.x},${p.y + gridSize}`,
      `${p.x},${p.y - gridSize}`
    ];
    if (neighbors.some(n => p2Set.has(n))) return true;
  }
  return false;
}

function scoreCityForCapital(s: Settlement, c: Country, landPointSet: Set<string>, gridSize: number = 5): number {
  const powerScore = (s.stats.economy * 1.5) + (s.stats.population * 10);
  const milScore = (s.stats.military.ground + s.stats.military.air + s.stats.military.naval) * 0.8;
  const coastalBonus = isCoastal(s.coords, landPointSet, gridSize) ? 75 : 0;
  const distToCenter = getDistance(s.coords, c.center);
  const safetyScore = Math.max(0, 100 - distToCenter);
  return powerScore + milScore + coastalBonus + safetyScore;
}

function updateCountryAggregates(country: Country): Country {
  if (country.settlements.length === 0) {
    country.stats = { ...country.stats, economy: 0, population: 0, military: { ground: 0, air: 0, naval: 0 }, warReadiness: 0 };
    return country;
  }

  const totalStats = country.settlements.reduce((acc, s) => ({
    economy: acc.economy + s.stats.economy,
    population: acc.population + s.stats.population,
    military: {
      ground: acc.military.ground + s.stats.military.ground,
      air: acc.military.air + s.stats.military.air,
      naval: acc.military.naval + s.stats.military.naval,
    },
    weightedReadiness: acc.weightedReadiness + (s.stats.warReadiness * (s.stats.economy + 1))
  }), {
    economy: 0,
    population: 0,
    military: { ground: 0, air: 0, naval: 0 },
    weightedReadiness: 0
  });

  const totalWeights = country.settlements.reduce((acc, s) => acc + (s.stats.economy + 1), 0);

  country.stats.economy = totalStats.economy;
  country.stats.population = totalStats.population;
  country.stats.military = totalStats.military;
  country.stats.warReadiness = totalStats.weightedReadiness / totalWeights;

  return country;
}

export function rebuildCountryMetadata(country: Country, landPointSet: Set<string>, gridSize: number = 5): Country {
  if (country.points.length === 0) return country;

  const pointSet = new Set(country.points.map(p => `${p.x},${p.y}`));
  country.settlements = country.settlements.filter(s => pointSet.has(`${s.coords.x},${s.coords.y}`));

  const avgX = country.points.reduce((s, p) => s + p.x, 0) / country.points.length;
  const avgY = country.points.reduce((s, p) => s + p.y, 0) / country.points.length;
  const newCenter = { x: avgX, y: avgY };
  country.center = newCenter;

  let currentCapital = country.settlements.find(s => s.type === 'capital');
  
  if (!currentCapital && country.settlements.length > 0) {
    const scoredCities = country.settlements.map(s => ({
      settlement: s,
      score: scoreCityForCapital(s, country, landPointSet, gridSize)
    }));
    scoredCities.sort((a, b) => b.score - a.score);
    const best = scoredCities[0].settlement;
    best.type = 'capital';
    currentCapital = best;
  } else if (!currentCapital && country.points.length > 0) {
    let closestPoint = country.points[0];
    let minDist = Infinity;
    for (const p of country.points) {
      const d = getDistance(p, newCenter);
      if (d < minDist) { minDist = d; closestPoint = p; }
    }
    const capIsCoastal = isCoastal(closestPoint, landPointSet, gridSize);
    country.settlements.push({
      id: `${country.id}-cap-auto-${Date.now()}`,
      name: "Provisional Capital",
      type: 'capital',
      coords: closestPoint,
      ownerId: country.id,
      stats: {
        economy: 15 * (capIsCoastal ? 1.6 : 1.0),
        population: 0.4 * (capIsCoastal ? 1.3 : 1.0),
        military: { ground: 15, air: 10, naval: capIsCoastal ? 15 : 0 },
        warReadiness: 100
      }
    });
  }

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
    
    const countryEconBonus = isLandlocked ? 0.9 : 1.15;
    c.stats.growthRate = isLandlocked ? 1.008 : 1.014;

    const capIsCoastal = isCoastal(c.center, landPointSet, gridSize);
    const localEconMult = capIsCoastal ? 1.6 : 1.0;
    const localPopMult = capIsCoastal ? 1.3 : 1.0;

    c.settlements.push({ 
      id: `${c.id}-cap`, 
      name: "Capital City", 
      type: 'capital', 
      coords: c.center, 
      ownerId: c.id,
      stats: {
        economy: 50 * countryEconBonus * localEconMult,
        population: 2 * countryEconBonus * localPopMult,
        military: { 
          ground: 60 * countryEconBonus, 
          air: 40 * countryEconBonus, 
          naval: 30 * (isLandlocked ? 0 : countryEconBonus * (capIsCoastal ? 2 : 1)) 
        },
        warReadiness: 100
      }
    });

    const cityCount = 2 + Math.floor(c.points.length / 150);
    for(let j=0; j<cityCount; j++) {
       const cityPoint = c.points[Math.floor(Math.random() * c.points.length)];
       const isOutpost = Math.random() > 0.4;
       const cityIsCoastal = isCoastal(cityPoint, landPointSet, gridSize);
       const cityEconMult = cityIsCoastal ? 1.6 : 1.0;
       const cityPopMult = cityIsCoastal ? 1.3 : 1.0;

       c.settlements.push({
         id: `${c.id}-city-${j}`,
         name: isOutpost ? `Outpost ${j+1}` : `City ${j+1}`,
         type: isOutpost ? 'outpost' : 'city',
         coords: cityPoint,
         ownerId: c.id,
         stats: {
           economy: (isOutpost ? 10 : 25) * countryEconBonus * cityEconMult,
           population: (isOutpost ? 0.5 : 1.5) * countryEconBonus * cityPopMult,
           military: { 
             ground: (isOutpost ? 20 : 15) * countryEconBonus, 
             air: (isOutpost ? 5 : 8) * countryEconBonus, 
             naval: (isLandlocked ? 0 : (isOutpost ? 2 : 5) * countryEconBonus * (cityIsCoastal ? 1.5 : 1)) 
           },
           warReadiness: 100
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

  const landSet = new Set(state.landPointSet);

  const updatedCountries = state.countries.map(c => {
    let growth = c.stats.growthRate * (0.999 + Math.random() * 0.002);
    
    const totalEcon = c.stats.economy;
    const damagedSettlements = c.settlements.filter(s => s.stats.warReadiness < 100);
    const totalReadinessDeficit = damagedSettlements.reduce((sum, s) => sum + (100 - s.stats.warReadiness), 0);
    
    const reconTaxRate = totalReadinessDeficit > 0 ? 0.04 : 0; 
    const reconFund = totalEcon * reconTaxRate;
    
    const nextSettlements = c.settlements.map(s => {
      let cityGrowth = growth;
      
      if (isCoastal(s.coords, landSet, 5)) {
        cityGrowth *= 1.005; 
      }

      let cityReadinessGain = 10; 

      if (s.stats.warReadiness < 100) {
        const share = (100 - s.stats.warReadiness) / (totalReadinessDeficit || 1);
        const allocatedBudget = reconFund * share;
        const reconBoost = Math.log10(Math.max(1, allocatedBudget + 1)) * 1.5;
        cityGrowth *= (1 + (reconBoost / 100));
        cityReadinessGain += (reconBoost * 5);
      }

      if (c.recoveryEndYear && state.gameYear < c.recoveryEndYear) {
        const isVerySmall = c.points.length < 150;
        const penaltyFactor = isVerySmall ? 15 : 6; 
        const excess = cityGrowth - 1.0;
        cityGrowth = 1.0 + (excess / penaltyFactor);
      }

      return {
        ...s,
        stats: {
          economy: s.stats.economy * cityGrowth,
          population: s.stats.population * (1 + (cityGrowth - 1) * 0.8),
          military: {
            ground: s.stats.military.ground * cityGrowth,
            air: s.stats.military.air * cityGrowth,
            naval: s.stats.military.naval * cityGrowth,
          },
          warReadiness: Math.min(100, s.stats.warReadiness + cityReadinessGain)
        }
      };
    });

    const updated = {
      ...c,
      settlements: nextSettlements,
    };
    return updateCountryAggregates(updated);
  });

  return { ...state, countries: updatedCountries, gameYear: state.gameYear + 1 };
}

export function executeBattle(state: GameState, id1: string, id2: string, mode: BattleMode = 'attacker', forcedWinnerId?: string): { state: GameState, result: string } {
  const getPartyCountries = (id: string): Country[] => {
    const alliance = state.alliances.find(a => a.id === id);
    if (alliance) return state.countries.filter(c => alliance.countryIds.includes(c.id));
    const country = state.countries.find(c => c.id === id);
    return country ? [country] : [];
  };

  const p1Countries = getPartyCountries(id1);
  const p2Countries = getPartyCountries(id2);

  if (p1Countries.length === 0 || p2Countries.length === 0) return { state, result: 'Invalid participants' };

  const landSet = new Set(state.landPointSet);
  const gridSize = 5;

  let hasLandBorder = false;
  for (const c1 of p1Countries) {
    for (const c2 of p2Countries) {
      if (checkSharingLandBorder(c1, c2)) { hasLandBorder = true; break; }
    }
    if (hasLandBorder) break;
  }

  const isAttacker1 = mode === 'attacker' || mode === 'mutual';
  const isDefender1 = mode === 'defender' || mode === 'mutual';
  const isAttacker2 = mode === 'defender' || mode === 'mutual';
  const isDefender2 = mode === 'attacker' || mode === 'mutual';

  const pointMap = new Map<string, string>();
  state.countries.forEach(c => {
    c.points.forEach(p => pointMap.set(`${p.x},${p.y}`, c.id));
  });

  const calculatePartyPower = (countries: Country[], isAttacking: boolean, isDefending: boolean, targetParty: Country[]) => {
    let totalPower = 0;
    const avgReadiness = countries.reduce((sum, c) => sum + c.stats.warReadiness, 0) / countries.length;

    countries.forEach(c => {
      let ground = (hasLandBorder || isDefending) ? c.stats.military.ground : 0;
      let air = c.stats.military.air;
      let naval = c.stats.isLandlocked ? 0 : c.stats.military.naval;

      let effectiveness = 1.0;
      if (!hasLandBorder && isAttacking) {
        let minDist = Infinity;
        targetParty.forEach(tp => {
          const d = getDistance(c.center, tp.center);
          if (d < minDist) minDist = d;
        });
        if (minDist > 400) effectiveness = 0.6;
        else if (minDist > 200) effectiveness = 0.8;
      }

      let base = (
        (ground * 1.0 + (air * effectiveness) * 1.0 + (naval * effectiveness) * 0.7) * 1.0 +
        (c.stats.economy * 0.15) + (c.stats.population * 2)
      ) * (0.4 + (avgReadiness / 100) * 0.6);

      if (isDefending) {
        const hasCapital = c.settlements.some(s => s.type === 'capital');
        base *= (1.8 * (hasCapital ? 2.5 : 1.0));
      }
      if (isAttacking && mode === 'mutual') base *= 1.2;

      totalPower += base;
    });

    return totalPower;
  };

  const p1Power = calculatePartyPower(p1Countries, isAttacker1, isDefender1, p2Countries) * (0.95 + Math.random() * 0.1);
  const p2Power = calculatePartyPower(p2Countries, isAttacker2, isDefender2, p1Countries) * (0.95 + Math.random() * 0.1);

  const winnerPartyId = forcedWinnerId ? (getPartyCountries(forcedWinnerId).some(c => p1Countries.map(x=>x.id).includes(c.id)) ? id1 : id2) : (p1Power > p2Power ? id1 : id2);
  const winnerCountries = winnerPartyId === id1 ? p1Countries : p2Countries;
  const loserCountries = winnerPartyId === id1 ? p2Countries : p1Countries;

  const intensity = Math.min(p1Power, p2Power) / Math.max(p1Power, p2Power);
  const powerScale = Math.log10(Math.max(10, p1Power + p2Power)) / 2;
  const baseWinPenalty = (5 + intensity * 10) * powerScale;
  const baseLosePenalty = (20 + intensity * 25) * powerScale;

  const applyPenalties = (countries: Country[], penalty: number) => {
    countries.forEach(c => {
      c.settlements = c.settlements.map(s => ({
        ...s,
        stats: { ...s.stats, warReadiness: Math.max(5, s.stats.warReadiness - penalty) }
      }));
      updateCountryAggregates(c);
    });
  };

  applyPenalties(p1Countries, winnerPartyId === id1 ? baseWinPenalty : baseLosePenalty);
  applyPenalties(p2Countries, winnerPartyId === id2 ? baseWinPenalty : baseLosePenalty);

  const isWinnerAttacking = (winnerPartyId === id1 && isAttacker1) || (winnerPartyId === id2 && isAttacker2);
  
  const loserTargetCountry = loserCountries[Math.floor(Math.random() * loserCountries.length)];
  const targetCity = loserTargetCountry.settlements.sort((a,b) => {
    const winAvgCenter = {
      x: winnerCountries.reduce((s,c) => s+c.center.x, 0) / winnerCountries.length,
      y: winnerCountries.reduce((s,c) => s+c.center.y, 0) / winnerCountries.length
    };
    return getDistance(a.coords, winAvgCenter) - getDistance(b.coords, winAvgCenter);
  })[0];

  if (!targetCity || !isWinnerAttacking) {
    return { 
      state: { ...state, countries: state.countries.map(c => {
        const p1Match = p1Countries.find(x => x.id === c.id);
        if (p1Match) return p1Match;
        const p2Match = p2Countries.find(x => x.id === c.id);
        if (p2Match) return p2Match;
        return c;
      })},
      result: isWinnerAttacking ? "Strategic stalemate: Attack repelled." : "Frontlines stabilized."
    };
  }

  const damageFactor = 0.7;
  targetCity.stats = {
    ...targetCity.stats,
    economy: targetCity.stats.economy * damageFactor,
    population: targetCity.stats.population * damageFactor,
    military: {
      ground: targetCity.stats.military.ground * damageFactor,
      air: targetCity.stats.military.air * damageFactor,
      naval: targetCity.stats.military.naval * damageFactor,
    },
    warReadiness: 25
  };

  const capturedCapital = targetCity.type === 'capital';
  if (capturedCapital) {
    targetCity.type = 'city';
    loserTargetCountry.recoveryEndYear = state.gameYear + 25;
  }

  const bestWinner = [...winnerCountries].sort((a, b) => getDistance(a.center, targetCity.coords) - getDistance(b.center, targetCity.coords))[0];
  targetCity.ownerId = bestWinner.id;
  
  bestWinner.settlements.push(targetCity);
  loserTargetCountry.settlements = loserTargetCountry.settlements.filter(s => s.id !== targetCity.id);

  const transferred: Point[] = [];
  const remaining: Point[] = [];
  loserTargetCountry.points.forEach(p => {
    const distToCap = getDistance(p, targetCity.coords);
    let minDistToOthers = Infinity;
    loserTargetCountry.settlements.forEach(s => {
      const d = getDistance(p, s.coords);
      if (d < minDistToOthers) minDistToOthers = d;
    });
    if (distToCap < minDistToOthers * 0.85) transferred.push(p);
    else remaining.push(p);
  });
  bestWinner.points.push(...transferred);
  loserTargetCountry.points = remaining;

  rebuildCountryMetadata(bestWinner, landSet, gridSize);
  rebuildCountryMetadata(loserTargetCountry, landSet, gridSize);

  let nextCountries = state.countries.map(c => {
    if (c.id === bestWinner.id) return bestWinner;
    if (c.id === loserTargetCountry.id) return loserTargetCountry;
    const p1Match = p1Countries.find(x => x.id === c.id);
    if (p1Match) return p1Match;
    const p2Match = p2Countries.find(x => x.id === c.id);
    if (p2Match) return p2Match;
    return c;
  });

  if (loserTargetCountry.points.length < 20 || loserTargetCountry.settlements.length === 0) {
    nextCountries = nextCountries.filter(c => c.id !== loserTargetCountry.id);
  }

  const resultPrefix = winnerPartyId === id1 ? (isAttacker1 ? "Successful offensive" : "Counter-attack victory") : (isAttacker2 ? "Successful offensive" : "Counter-attack victory");
  const allianceAlert = (winnerCountries.length > 1 || loserCountries.length > 1) ? " (Asymmetric Engagement)" : "";

  return {
    state: { ...state, countries: nextCountries },
    result: `${resultPrefix}: ${capturedCapital ? `Seized capital ${targetCity.name}!` : `Captured ${targetCity.name}.`}${allianceAlert}`
  };
}

export function renameCountry(state: GameState, id: string, newName: string): GameState {
  return { ...state, countries: state.countries.map(c => c.id === id ? { ...c, name: newName } : c) };
}

export function updateCountryColor(state: GameState, id: string, newColor: string): GameState {
  return { ...state, countries: state.countries.map(c => {
    if (c.id === id) return { ...c, color: newColor };
    return c;
  }) };
}

export function mergeCountries(state: GameState, ids: string[], dominantId?: string, customName?: string): GameState {
  if (ids.length < 2) return state;
  const participants = state.countries.filter(c => ids.includes(c.id));
  
  const identityCountry = dominantId 
    ? (participants.find(c => c.id === dominantId) || participants[0])
    : [...participants].sort((a,b) => b.stats.economy - a.stats.economy)[0];
  
  const mergedId = dominantId || `merged-${Date.now()}`;
  const allPoints = participants.flatMap(p => p.points);
  const allSettlements = participants.flatMap(p => p.settlements).map(s => ({ 
    ...s, 
    ownerId: mergedId, 
    type: s.type === 'capital' ? (s.ownerId === identityCountry.id ? 'capital' : 'city') : s.type 
  }));

  let capitals = allSettlements.filter(s => s.type === 'capital');
  if (capitals.length > 1) {
    allSettlements.forEach(s => {
      if (s.type === 'capital' && s.id !== capitals[0].id) s.type = 'city';
    });
  }

  const merged: Country = {
    ...identityCountry,
    id: mergedId,
    name: customName || identityCountry.name,
    points: allPoints,
    settlements: allSettlements,
    stats: {
      economy: 0, population: 0, military: { ground: 0, air: 0, naval: 0 },
      growthRate: identityCountry.stats.growthRate,
      isLandlocked: identityCountry.stats.isLandlocked,
      warReadiness: 0 
    }
  };

  const landSet = new Set(state.landPointSet);
  const final = rebuildCountryMetadata(merged, landSet, 5);
  return { ...state, countries: state.countries.filter(c => !ids.includes(c.id)).concat(final) };
}

export function splitCountry(state: GameState, targetId: string, parts: number, successorNames: string[], distributions: number[]): GameState {
  const target = state.countries.find(c => c.id === targetId);
  if (!target || parts < 2) return state;

  const gridSize = 5;
  const totalPointsCount = target.points.length;
  const pointMap = new Set(target.points.map(p => `${p.x},${p.y}`));
  const assignedKeys = new Set<string>();
  const pointPartitions: Point[][] = Array.from({ length: parts }, () => []);
  const quotas = distributions.map(d => Math.floor(totalPointsCount * (d / 100)));

  const seeds: Point[] = [];
  if (target.points.length > 0) {
    seeds.push(target.points[0]);
    for (let i = 1; i < parts; i++) {
      let furthestPoint = target.points[0];
      let maxMinDist = -1;
      for (const p of target.points) {
        let minDistToSeeds = Infinity;
        for (const s of seeds) {
          const d = getDistance(p, s);
          if (d < minDistToSeeds) minDistToSeeds = d;
        }
        if (minDistToSeeds > maxMinDist) { maxMinDist = minDistToSeeds; furthestPoint = p; }
      }
      seeds.push(furthestPoint);
    }
  }

  const frontiers: Point[][] = seeds.map(s => [s]);
  seeds.forEach((s, i) => {
    const key = `${s.x},${s.y}`;
    pointPartitions[i].push(s);
    assignedKeys.add(key);
  });

  let growing = true;
  while (growing) {
    growing = false;
    for (let i = 0; i < parts; i++) {
      if (pointPartitions[i].length < quotas[i] && frontiers[i].length > 0) {
        growing = true;
        frontiers[i].sort((a, b) => getDistance(a, seeds[i]) - getDistance(b, seeds[i]));
        const current = frontiers[i][0];
        frontiers[i].splice(0, 1);

        const neighbors = [{x:current.x+gridSize, y:current.y}, {x:current.x-gridSize, y:current.y}, {x:current.x, y:current.y+gridSize}, {x:current.x, y:current.y-gridSize}];
        for (const n of neighbors) {
          const nKey = `${n.x},${n.y}`;
          if (pointMap.has(nKey) && !assignedKeys.has(nKey)) {
            assignedKeys.add(nKey);
            pointPartitions[i].push(n);
            frontiers[i].push(n);
            if (pointPartitions[i].length >= quotas[i]) break;
          }
        }
      }
    }
  }

  target.points.forEach(p => {
    const key = `${p.x},${p.y}`;
    if (!assignedKeys.has(key)) {
      let bestIdx = 0; let minDist = Infinity;
      seeds.forEach((s, idx) => {
        const d = getDistance(p, s);
        if (d < minDist) { minDist = d; bestIdx = idx; }
      });
      pointPartitions[bestIdx].push(p);
      assignedKeys.add(key);
    }
  });

  const landSet = new Set(state.landPointSet);
  const nextCountries: Country[] = pointPartitions.map((pts, i) => {
    const name = successorNames[i] || `${target.name} Splinter ${i+1}`;
    const id = `splinter-${targetId}-${i}-${Date.now()}`;
    const distFactor = (distributions[i] || 1) / 100;
    const ptSet = new Set(pts.map(p => `${p.x},${p.y}`));
    
    const splinterSettlements = target.settlements
      .filter(s => ptSet.has(`${s.coords.x},${s.coords.y}`))
      .map(s => ({ 
        ...s, 
        ownerId: id, 
        type: 'city' as const,
        stats: {
          ...s.stats,
          economy: s.stats.economy * distFactor,
          population: s.stats.population * distFactor,
          military: {
            ground: s.stats.military.ground * distFactor,
            air: s.stats.military.air * distFactor,
            naval: s.stats.military.naval * distFactor,
          }
        }
      }));

    const country: Country = {
      ...target, id, name,
      color: POLITICAL_COLORS[Math.floor(Math.random() * POLITICAL_COLORS.length)],
      points: pts,
      settlements: splinterSettlements,
      stats: {
        economy: target.stats.economy * distFactor,
        population: target.stats.population * distFactor,
        military: {
          ground: target.stats.military.ground * distFactor,
          air: target.stats.military.air * distFactor,
          naval: target.stats.military.naval * distFactor,
        },
        growthRate: target.stats.growthRate,
        isLandlocked: target.stats.isLandlocked,
        warReadiness: 0 
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

export function disbandAlliance(state: GameState, allianceId: string): GameState {
  return {
    ...state,
    alliances: state.alliances.filter(a => a.id !== allianceId),
    countries: state.countries.map(c => c.allianceId === allianceId ? { ...c, allianceId: undefined } : c)
  };
}

export function leaveAlliance(state: GameState, countryId: string): GameState {
  const country = state.countries.find(c => c.id === countryId);
  if (!country || !country.allianceId) return state;

  const allianceId = country.allianceId;
  const updatedAlliances = state.alliances.map(a => {
    if (a.id !== allianceId) return a;
    return { ...a, countryIds: a.countryIds.filter(id => id !== countryId) };
  }).filter(a => a.countryIds.length >= 2);

  return {
    ...state,
    alliances: updatedAlliances,
    countries: state.countries.map(c => {
      if (c.id === countryId) return { ...c, allianceId: undefined };
      if (c.allianceId === allianceId && !updatedAlliances.some(ua => ua.id === allianceId)) return { ...c, allianceId: undefined };
      return c;
    })
  };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  const sorted = [...state.alliances].sort((a,b) => {
    const p1 = state.countries.filter(c => a.countryIds.includes(c.id)).reduce((s,c) => s+c.stats.economy, 0);
    const p2 = state.countries.filter(c => b.countryIds.includes(c.id)).reduce((s,c) => s+c.stats.economy, 0);
    return p2 - p1;
  });

  const winner = sorted[0];
  const losers = sorted.slice(1);

  let currentCountries = [...state.countries];
  losers.forEach(all => {
    all.countryIds.forEach(cid => {
      const receiver = winner.countryIds[Math.floor(Math.random() * winner.countryIds.length)];
      const res = executeBattle({ ...state, countries: currentCountries }, receiver, cid, 'attacker', receiver);
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
