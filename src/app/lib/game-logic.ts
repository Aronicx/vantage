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
  const c1 = state.countries.find(c => c.id === id1);
  const c2 = state.countries.find(c => c.id === id2);
  if (!c1 || !c2) return { state, result: 'Error' };

  const landSet = new Set(state.landPointSet);
  const gridSize = 5;
  const hasLandBorder = checkSharingLandBorder(c1, c2);

  const isAttacker1 = mode === 'attacker' || mode === 'mutual';
  const isDefender1 = mode === 'defender' || mode === 'mutual';
  const isAttacker2 = mode === 'defender' || mode === 'mutual';
  const isDefender2 = mode === 'attacker' || mode === 'mutual';

  const pointMap = new Map<string, string>();
  state.countries.forEach(c => {
    c.points.forEach(p => pointMap.set(`${p.x},${p.y}`, c.id));
  });

  const getAirLogistics = (attacker: Country, target: Country) => {
    if (hasLandBorder) return { effectiveness: 1.0, message: "" };
    
    const linePoints = getPointsOnLine(attacker.center, target.center, 15);
    let oceanPoints = 0;
    const interveningCountryIds = new Set<string>();

    linePoints.forEach(p => {
      const key = `${Math.round(p.x/gridSize)*gridSize},${Math.round(p.y/gridSize)*gridSize}`;
      if (!landSet.has(key)) {
        oceanPoints++;
      } else {
        const ownerId = pointMap.get(key);
        if (ownerId && ownerId !== attacker.id && ownerId !== target.id) {
          interveningCountryIds.add(ownerId);
        }
      }
    });

    let effectiveness = 1.0;
    let logs = "";

    if (oceanPoints > linePoints.length * 0.5) {
      effectiveness *= 0.45;
      logs += " [Over-Ocean Logistics]";
    }

    interveningCountryIds.forEach(id => {
      const ic = state.countries.find(c => c.id === id);
      if (ic) {
        const penalty = Math.min(0.6, ic.stats.military.air / 400); 
        effectiveness *= (1 - penalty);
        logs += ` [Interception over ${ic.name}]`;
      }
    });

    return { effectiveness, message: logs };
  };

  const airLogistics1 = isAttacker1 ? getAirLogistics(c1, c2) : { effectiveness: 1, message: "" };
  const airLogistics2 = isAttacker2 ? getAirLogistics(c2, c1) : { effectiveness: 1, message: "" };

  const calculatePower = (c: Country, isAttacking: boolean, isDefending: boolean, airEffectiveness: number, cityDefenseBonus: number = 1.0) => {
    let ground = (hasLandBorder || isDefending) ? c.stats.military.ground : 0;
    if (!hasLandBorder && isAttacking) ground = 0;
    let air = c.stats.military.air * (isAttacking ? airEffectiveness : 1.0);
    let naval = c.stats.isLandlocked ? 0 : c.stats.military.naval;
    
    if (!hasLandBorder && !c.stats.isLandlocked) {
      if (isAttacking) naval *= 0.7; 
      if (isDefending) naval *= 2.0; 
    }

    let basePower = (
      (ground * 1.0 + air * 1.0 + naval * 0.7) * 1.0 +
      (c.stats.economy * 0.15) + (c.stats.population * 2)
    ) * (0.4 + (c.stats.warReadiness / 100) * 0.6);

    // Apply strict posture multipliers
    if (isDefending) basePower *= (1.8 * cityDefenseBonus);
    if (isAttacking && mode === 'mutual') basePower *= 1.2; // Both mobilization

    return basePower;
  };

  const getTargetCity = (attacker: Country, defender: Country) => {
    const nonCapitals = defender.settlements.filter(s => s.type !== 'capital');
    const isCountryCollapsing = defender.stats.warReadiness < 35 || defender.settlements.length <= 2;
    
    if (nonCapitals.length > 0 && !isCountryCollapsing) {
      return nonCapitals.sort((a,b) => getDistance(a.coords, attacker.center) - getDistance(b.coords, attacker.center))[0];
    } else {
      return [...defender.settlements].sort((a,b) => getDistance(a.coords, attacker.center) - getDistance(b.coords, attacker.center))[0];
    }
  };

  const targetForC1 = isAttacker1 ? getTargetCity(c1, c2) : undefined;
  const targetForC2 = isAttacker2 ? getTargetCity(c2, c1) : undefined;

  const defBonus1 = targetForC2?.type === 'capital' ? 2.5 : 1.0;
  const defBonus2 = targetForC1?.type === 'capital' ? 2.5 : 1.0;

  const p1 = calculatePower(c1, isAttacker1, isDefender1, airLogistics1.effectiveness, defBonus1) * (0.975 + Math.random() * 0.05);
  const p2 = calculatePower(c2, isAttacker2, isDefender2, airLogistics2.effectiveness, defBonus2) * (0.975 + Math.random() * 0.05);

  const winnerId = forcedWinnerId || (p1 > p2 ? c1.id : c2.id);
  const loserId = winnerId === id1 ? id2 : id1;
  
  const winner = { ...state.countries.find(c => c.id === winnerId)! };
  const loser = { ...state.countries.find(c => c.id === loserId)! };

  const intensity = Math.min(p1, p2) / Math.max(p1, p2); 
  const totalPower = p1 + p2;
  const powerScale = Math.log10(Math.max(10, totalPower)) / 2; 

  const baseWinnerPenalty = (5 + (intensity * 10)) * powerScale;
  const baseLoserPenalty = (25 + (intensity * 25)) * powerScale;

  let p1Penalty = winnerId === id1 ? baseWinnerPenalty : baseLoserPenalty;
  let p2Penalty = winnerId === id2 ? baseWinnerPenalty : baseLoserPenalty;

  // Refine penalties based on posture and outcome
  if (winnerId === id1) {
    if (isAttacker1) p1Penalty *= 1.2; // Offensive wins are costly
    if (isDefender1) p1Penalty *= 0.7; // Defensive wins are efficient
    if (isAttacker2) p2Penalty *= 1.5; // Failed assault is disastrous
  } else {
    if (isAttacker2) p2Penalty *= 1.2;
    if (isDefender2) p2Penalty *= 0.7;
    if (isAttacker1) p1Penalty *= 1.5;
  }

  c1.settlements = c1.settlements.map(s => ({
    ...s,
    stats: { ...s.stats, warReadiness: Math.max(5, s.stats.warReadiness - p1Penalty) }
  }));
  c2.settlements = c2.settlements.map(s => ({
    ...s,
    stats: { ...s.stats, warReadiness: Math.max(5, s.stats.warReadiness - p2Penalty) }
  }));

  const isNavalWar = (!winner.stats.isLandlocked || !loser.stats.isLandlocked);
  const targetCity = winnerId === id1 ? targetForC1 : targetForC2;

  // Decide if territory actually changes hands. 
  // Defenders winning just push back the assault; they don't capture territory.
  const isWinnerAttacking = (winnerId === id1 && isAttacker1) || (winnerId === id2 && isAttacker2);

  if (!targetCity || !isWinnerAttacking) {
    const defenseLog = (!isWinnerAttacking && winnerId !== loserId) ? " Assault successfully repelled." : " Frontlines stable.";
    return { 
      state: { ...state, countries: state.countries.map(c => c.id === id1 ? updateCountryAggregates(c1) : c.id === id2 ? updateCountryAggregates(c2) : c) }, 
      result: `Conflict concluded.${defenseLog}` 
    };
  }

  const targetIsCoastal = isCoastal(targetCity.coords, landSet, gridSize);
  let damageFactor = 0.8;
  if (isNavalWar) {
    if (targetIsCoastal) damageFactor = 0.6;
    else damageFactor = 0.9;
  }

  targetCity.stats = {
    ...targetCity.stats,
    economy: targetCity.stats.economy * damageFactor,
    population: targetCity.stats.population * damageFactor,
    military: {
      ground: targetCity.stats.military.ground * damageFactor,
      air: targetCity.stats.military.air * damageFactor,
      naval: targetCity.stats.military.naval * damageFactor,
    },
    warReadiness: Math.max(10, Math.min(25, targetCity.stats.warReadiness - 50))
  };

  let capturedCapital = targetCity.type === 'capital';
  if (capturedCapital) {
    targetCity.type = 'city'; 
    loser.recoveryEndYear = state.gameYear + 25; 
  }

  targetCity.ownerId = winnerId;
  winner.settlements.push(targetCity);
  loser.settlements = loser.settlements.filter(s => s.id !== targetCity.id);

  const applyGeneralDecline = (countries: Country[]) => {
    return countries.map(c => {
      if (c.id !== winnerId && c.id !== loserId) return c;
      const declineFactor = c.id === loserId ? 0.95 : 0.98;
      return {
        ...c,
        settlements: c.settlements.map(s => {
          let localDecline = declineFactor;
          if (isNavalWar && c.id === loserId && isCoastal(s.coords, landSet, gridSize)) {
            localDecline *= 0.9;
          }
          return {
            ...s,
            stats: {
              ...s.stats,
              economy: s.stats.economy * localDecline,
              population: s.stats.population * localDecline,
              military: {
                ground: s.stats.military.ground * localDecline,
                air: s.stats.military.air * localDecline,
                naval: s.stats.military.naval * localDecline,
              }
            }
          };
        })
      };
    });
  };

  const transferredPoints: Point[] = [];
  const remainingPoints: Point[] = [];

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

  const updatedWinner = rebuildCountryMetadata(winner, landSet, gridSize);
  const updatedLoser = rebuildCountryMetadata(loser, landSet, gridSize);

  let nextCountries = applyGeneralDecline(state.countries.map(c => {
    if (c.id === winner.id) return updatedWinner;
    if (c.id === loser.id) return updatedLoser;
    return c;
  }));

  if (updatedLoser.points.length < 20 || updatedLoser.settlements.length === 0) {
    nextCountries = nextCountries.filter(c => c.id !== loserId);
  }

  const borderAlert = !hasLandBorder ? " (Air/Naval Operation)" : "";
  const navalContext = isNavalWar ? (targetIsCoastal ? " Coastal infrastructure targeted." : " Inland shielded from naval fire.") : "";
  const logContext = (winnerId === id1 ? airLogistics1.message : airLogistics2.message);
  const modeLabel = mode === 'mutual' ? "Mutual conflict" : mode === 'attacker' ? "Initiated assault" : "Counter-attack";
  
  return { 
    state: { ...state, countries: nextCountries }, 
    result: `${modeLabel}: ${capturedCapital ? `Seized capital ${targetCity.name}!` : `Captured ${targetCity.name}.`}${borderAlert}${navalContext}${logContext}` 
  };
}

export function renameCountry(state: GameState, id: string, newName: string): GameState {
  return { ...state, countries: state.countries.map(c => c.id === id ? { ...c, name: newName } : c) };
}

export function updateCountryColor(state: GameState, id: string, newColor: string): GameState {
  return { ...state, countries: state.countries.map(c => c.id === id ? { ...c, color: newColor } : c) };
}

export function mergeCountries(state: GameState, ids: string[], dominantId?: string, customName?: string): GameState {
  if (ids.length < 2) return state;
  const participants = state.countries.filter(c => ids.includes(c.id));
  
  // Find identity country: either the provided dominantId or the strongest participant
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

  // Consolidate settlements: if somehow there are multiple capitals, ensure only one survives
  let capitals = allSettlements.filter(s => s.type === 'capital');
  if (capitals.length > 1) {
    allSettlements.forEach(s => {
      if (s.type === 'capital' && s.id !== capitals[0].id) {
        s.type = 'city';
      }
    });
  }

  const merged: Country = {
    ...identityCountry,
    id: mergedId,
    name: customName || identityCountry.name,
    points: allPoints,
    settlements: allSettlements,
    stats: {
      economy: 0,
      population: 0,
      military: { ground: 0, air: 0, naval: 0 },
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
        if (minDistToSeeds > maxMinDist) {
          maxMinDist = minDistToSeeds;
          furthestPoint = p;
        }
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

        const neighbors = [
          { x: current.x + gridSize, y: current.y },
          { x: current.x - gridSize, y: current.y },
          { x: current.x, y: current.y + gridSize },
          { x: current.x, y: current.y - gridSize }
        ];

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
      let bestIdx = 0;
      let minDist = Infinity;
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
      ...target,
      id,
      name,
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
      if (c.allianceId === allianceId && !updatedAlliances.some(ua => ua.id === allianceId)) {
        return { ...c, allianceId: undefined };
      }
      return c;
    })
  };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  const getPower = (all: Alliance) => {
    const memberCountries = state.countries.filter(c => all.countryIds.includes(c.id));
    const enemyMembers = state.countries.filter(c => !all.countryIds.includes(c.id) && c.allianceId);
    let sharesBorder = false;
    for (const m of memberCountries) {
      for (const e of enemyMembers) {
        if (checkSharingLandBorder(m, e)) { sharesBorder = true; break; }
      }
      if (sharesBorder) break;
    }

    const ground = sharesBorder ? memberCountries.reduce((sum, c) => sum + c.stats.military.ground, 0) : 0;
    const air = memberCountries.reduce((sum, c) => sum + c.stats.military.air, 0);
    const naval = memberCountries.reduce((sum, c) => sum + (c.stats.isLandlocked ? 0 : c.stats.military.naval), 0);
    const econ = memberCountries.reduce((sum, c) => sum + c.stats.economy, 0);
    const pop = memberCountries.reduce((sum, c) => sum + c.stats.population, 0);
    const readiness = memberCountries.reduce((sum, c) => sum + c.stats.warReadiness, 0) / memberCountries.length;

    return (
      (ground * 1.0 + air * 1.0 + naval * 0.7) * 1.0 +
      (econ * 0.15) + (pop * 2)
    ) * (0.4 + (readiness / 100) * 0.6);
  };

  const sorted = [...state.alliances].sort((a,b) => getPower(b) - getPower(a));
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
