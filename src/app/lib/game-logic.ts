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
  isLandlocked: boolean;
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
  boomEndYear?: number;
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

function getRandomColor(): string {
  return POLITICAL_COLORS[Math.floor(Math.random() * POLITICAL_COLORS.length)];
}

export async function generateNewWorld(width: number, height: number): Promise<GameState> {
  const countryCount = 8 + Math.floor(Math.random() * 4);
  const countries: Country[] = [];
  
  const landCenters: {p: Point, r: number}[] = [];
  const landCenterCount = 6 + Math.floor(Math.random() * 4);
  const padding = width * 0.15;
  
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      p: {
        x: width * 0.35 + Math.random() * width * 0.3,
        y: height * 0.35 + Math.random() * height * 0.3
      },
      r: width * (0.12 + Math.random() * 0.08)
    });
  }

  const gridSize = 10;
  const landPoints: Point[] = [];
  const landPointSet = new Set<string>();

  for (let x = padding; x < width - padding; x += gridSize) {
    for (let y = padding; y < height - padding; y += gridSize) {
      const p = { x, y };
      const isLand = landCenters.some(lc => getDistance(p, lc.p) < lc.r);
      if (isLand) {
        landPoints.push(p);
        landPointSet.add(`${x},${y}`);
      }
    }
  }

  const seeds: Point[] = [];
  for (let i = 0; i < countryCount; i++) {
    let bestSeed = landPoints[Math.floor(Math.random() * landPoints.length)];
    let maxMinDist = -1;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = landPoints[Math.floor(Math.random() * landPoints.length)];
      let minDist = Infinity;
      seeds.forEach(s => {
        const d = getDistance(candidate, s);
        if (d < minDist) minDist = d;
      });
      if (seeds.length === 0 || minDist > maxMinDist) {
        maxMinDist = minDist;
        bestSeed = candidate;
      }
    }
    seeds.push(bestSeed);

    const color = POLITICAL_COLORS[i % POLITICAL_COLORS.length];
    const palette = FLAG_PALETTES[i % FLAG_PALETTES.length];
    
    countries.push({
      id: `country-${i}`,
      name: `Nation ${String.fromCharCode(65 + i)}`,
      color: color,
      flagColors: [...palette],
      flagPattern: ['stripes', 'cross', 'diagonal', 'circles'][Math.floor(Math.random() * 4)] as any,
      points: [],
      center: bestSeed,
      settlements: [],
      provinces: [],
      stats: { 
        economy: 0, 
        population: 0, 
        military: { ground: 0, air: 0, naval: 0 }, 
        growthRate: 1.01,
        isLandlocked: true 
      }
    });
  }

  landPoints.forEach(p => {
    let closestId = '';
    let minDist = Infinity;
    countries.forEach(c => {
      const d = getDistance(p, c.center);
      if (d < minDist) { minDist = d; closestId = c.id; }
    });
    if (closestId) {
      countries.find(c => c.id === closestId)?.points.push(p);
    }
  });

  const finalCountries = countries.filter(c => c.points.length > 5);

  finalCountries.forEach(c => {
    let isLandlocked = true;
    for (const p of c.points) {
      const neighbors = [
        {x: p.x + gridSize, y: p.y},
        {x: p.x - gridSize, y: p.y},
        {x: p.x, y: p.y + gridSize},
        {x: p.x, y: p.y - gridSize}
      ];
      if (neighbors.some(n => !landPointSet.has(`${n.x},${n.y}`))) {
        isLandlocked = false;
        break;
      }
    }
    c.stats.isLandlocked = isLandlocked;

    const sizeFactor = c.points.length / 50; 
    const isPowerhouse = Math.random() > 0.90;
    const luckMultiplier = isPowerhouse ? (1.5 + Math.random() * 0.8) : (0.85 + Math.random() * 0.4);
    
    const geoEconBonus = isLandlocked ? 0.90 : 1.10;

    c.stats.economy = (100 + sizeFactor * 400) * luckMultiplier * geoEconBonus;
    c.stats.population = (5 + sizeFactor * 30) * luckMultiplier;
    c.stats.military = {
      ground: (40 + sizeFactor * 80) * luckMultiplier,
      air: (10 + sizeFactor * 30) * luckMultiplier,
      naval: isLandlocked ? (sizeFactor * 2) : (10 + sizeFactor * 40) * luckMultiplier,
    };

    c.stats.growthRate = (isLandlocked ? 1.009 : 1.015) + (Math.random() * 0.01);

    const provinceCount = Math.max(2, Math.floor(c.points.length / 30));
    const provinceSeeds: Point[] = [];
    for(let i=0; i<provinceCount; i++) {
      provinceSeeds.push(c.points[Math.floor(Math.random() * c.points.length)]);
    }
    
    c.provinces = provinceSeeds.map((seed, idx) => ({ id: `${c.id}-prov-${idx}`, points: [], center: seed }));

    c.points.forEach(p => {
      let closestIdx = 0;
      let minDist = Infinity;
      provinceSeeds.forEach((ps, idx) => {
        const d = getDistance(p, ps);
        if (d < minDist) { minDist = d; closestIdx = idx; }
      });
      c.provinces[closestIdx].points.push(p);
    });

    c.settlements.push({ id: `${c.id}-cap`, name: `Capital`, type: 'capital', coords: c.center, ownerId: c.id });
  });

  try {
    const worldLore = await generateGameWorldLore({ countries: finalCountries.map(c => ({ id: c.id, name: c.name })) });
    finalCountries.forEach(c => {
      const countryLore = worldLore.countriesLore.find(l => l.id === c.id);
      if (countryLore) {
        c.name = countryLore.name;
        const { cityNamesExamples } = countryLore.namingConventions;
        c.settlements.forEach((s) => { 
          if (s.type === 'capital') s.name = cityNamesExamples[0] || s.name;
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
    const annualVariance = 0.998 + (Math.random() * 0.004);
    let currentGrowth = stats.growthRate * annualVariance;

    if (c.recoveryEndYear && state.gameYear <= c.recoveryEndYear) {
      currentGrowth = 1 + (stats.growthRate - 1) * 0.45;
    } else if (c.boomEndYear && state.gameYear <= c.boomEndYear) {
      currentGrowth = 1 + (stats.growthRate - 1) * 1.5;
    }

    stats.population *= currentGrowth;
    stats.economy *= currentGrowth;
    
    const milGrowth = 1 + (currentGrowth - 1) * 0.6;
    stats.military.ground *= milGrowth;
    stats.military.air *= milGrowth;
    stats.military.naval *= milGrowth;
    
    return { ...c, stats };
  });

  return { ...state, countries: updatedCountries, gameYear: state.gameYear + 1 };
}

export function executeBattle(state: GameState, id1: string, id2: string, forcedWinnerId?: string): { state: GameState, result: string } {
  const c1 = state.countries.find(c => c.id === id1);
  const c2 = state.countries.find(c => c.id === id2);
  if (!c1 || !c2) return { state, result: 'Error' };

  let winner = { ...JSON.parse(JSON.stringify(forcedWinnerId ? (forcedWinnerId === id1 ? c1 : c2) : (Math.random() > 0.5 ? c1 : c2))) };
  let loser = { ...JSON.parse(JSON.stringify(winner.id === id1 ? c2 : c1)) };

  const calculatePower = (c: Country) => {
    let p = c.stats.military.ground + c.stats.military.air + (c.stats.military.naval * 0.65);
    p += c.stats.economy * 0.12; 
    return p;
  };
  
  const p1 = calculatePower(c1);
  const p2 = calculatePower(c2);
  const ratio = Math.max(p1, p2) / Math.min(p1, p2);

  const isLoserVulnerable = loser.recoveryEndYear && state.gameYear <= loser.recoveryEndYear;
  const winnerAttrition = 0.05 + (Math.random() * 0.05);
  const loserAttrition = isLoserVulnerable ? 0.40 + (Math.random() * 0.15) : 0.20 + (Math.random() * 0.10);

  const originalLoserEconomy = loser.stats.economy;
  const originalLoserPopulation = loser.stats.population;

  winner.color = getRandomColor();
  loser.color = getRandomColor();

  winner.stats.economy *= (1 - winnerAttrition);
  winner.stats.population *= (1 - winnerAttrition * 0.3);
  winner.stats.military.ground *= (1 - winnerAttrition * 1.4);
  winner.stats.military.air *= (1 - winnerAttrition * 1.4);
  winner.stats.military.naval *= (1 - winnerAttrition * 1.2);

  loser.stats.economy *= (1 - loserAttrition);
  loser.stats.population *= (1 - loserAttrition * 0.7);
  loser.stats.military.ground *= (1 - loserAttrition * 2.0);
  loser.stats.military.air *= (1 - loserAttrition * 2.0);
  loser.stats.military.naval *= (1 - loserAttrition * 1.8);

  const lootFactor = 0.40;
  winner.stats.economy += (originalLoserEconomy - loser.stats.economy) * lootFactor;
  winner.stats.population += (originalLoserPopulation - loser.stats.population) * lootFactor;
  
  winner.recoveryEndYear = state.gameYear + 4;
  winner.boomEndYear = state.gameYear + 12;
  loser.recoveryEndYear = state.gameYear + 8; 

  let lossPercent = 0.15;
  let resultText = `New border lines drawn between ${winner.name} and ${loser.name}.`;

  if (isLoserVulnerable) {
    lossPercent = 0.65 + Math.random() * 0.25;
    resultText = `${loser.name}'s defense lines collapsed!`;
  } else {
    if (ratio > 1.7) { lossPercent = 0.30; resultText = 'Significant territorial redistribution achieved.'; }
    if (ratio > 2.8) { lossPercent = 0.50; resultText = 'Overwhelming breakthrough into enemy territory.'; }
  }

  const pointsToTransferCount = Math.floor(loser.points.length * lossPercent);
  loser.points.sort((a, b) => getDistance(a, winner.center) - getDistance(b, winner.center));
  const transferredPoints = loser.points.slice(0, pointsToTransferCount);
  
  const capital = loser.settlements.find(s => s.type === 'capital');
  const isCapitalCaptured = capital && transferredPoints.some(p => p.x === capital.coords.x && p.y === capital.coords.y);

  loser.points = loser.points.filter(p => !transferredPoints.some(tp => tp.x === p.x && tp.y === p.y));
  winner.points.push(...transferredPoints);

  let nextCountries = state.countries.map(c => {
    if (c.id === winner.id) return winner;
    if (c.id === loser.id) return loser;
    return c;
  });

  if (isCapitalCaptured) {
    resultText += ` ${loser.name}'s capital was occupied.`;
    if (loser.points.length > 5) {
      const newCountryId = `country-rump-${Date.now()}`;
      const avgX = loser.points.reduce((s, p) => s + p.x, 0) / loser.points.length;
      const avgY = loser.points.reduce((s, p) => s + p.y, 0) / loser.points.length;
      const newCenter = { x: avgX, y: avgY };

      const newCountry: Country = {
        ...loser,
        id: newCountryId,
        name: `Remnant ${loser.name}`,
        center: newCenter,
        settlements: [{ id: `${newCountryId}-cap`, name: `Temporary Capital`, type: 'capital', coords: newCenter, ownerId: newCountryId }],
        allianceId: undefined,
        stats: {
           ...loser.stats,
           economy: loser.stats.economy * 0.3,
           population: loser.stats.population * 0.4
        },
        recoveryEndYear: state.gameYear + 15
      };
      nextCountries = nextCountries.filter(c => c.id !== loser.id).concat(newCountry);
    } else {
      resultText = `${loser.name} has been annexed into ${winner.name}.`;
      nextCountries = nextCountries.filter(c => c.id !== loser.id);
    }
  } else if (loser.points.length <= 2) {
    resultText = `${loser.name} was dissolved.`;
    nextCountries = nextCountries.filter(c => c.id !== loser.id);
  }

  nextCountries = nextCountries.map(country => {
    if (country.id === winner.id || country.id.startsWith('country-rump-')) {
       const provinceCount = Math.max(2, Math.floor(country.points.length / 40));
       const provinceSeeds: Point[] = [];
       for(let i=0; i<provinceCount; i++) {
         provinceSeeds.push(country.points[Math.floor(Math.random() * country.points.length)]);
       }
       country.provinces = provinceSeeds.map((seed, idx) => ({ id: `${country.id}-prov-${idx}`, points: [], center: seed }));
       country.points.forEach(p => {
         let closestIdx = 0;
         let minDist = Infinity;
         provinceSeeds.forEach((ps, idx) => {
           const d = getDistance(p, ps);
           if (d < minDist) { minDist = d; closestIdx = idx; }
         });
         country.provinces[closestIdx].points.push(p);
       });
    }
    return country;
  });

  return { state: { ...state, countries: nextCountries }, result: resultText };
}

export function renameCountry(state: GameState, id: string, newName: string): GameState {
  return {
    ...state,
    countries: state.countries.map(c => c.id === id ? { ...c, name: newName } : c)
  };
}

export function mergeCountries(state: GameState, ids: string[], customName: string): GameState {
  if (ids.length < 2) return state;

  const participants = state.countries.filter(c => ids.includes(c.id));
  if (participants.length < 2) return state;

  participants.sort((a, b) => (b.stats.economy + b.stats.military.ground) - (a.stats.economy + a.stats.military.ground));
  const dominant = participants[0];

  const mergedId = `merged-${Date.now()}`;
  const mergedName = customName.trim() || `Greater ${dominant.name}`;
  const mergedColor = dominant.color;

  const allPoints: Point[] = participants.flatMap(c => c.points);
  const allSettlements: Settlement[] = participants.flatMap(c => c.settlements).map(s => ({ ...s, ownerId: mergedId }));
  
  const totalEconomy = participants.reduce((sum, c) => sum + c.stats.economy, 0);
  const totalPopulation = participants.reduce((sum, c) => sum + c.stats.population, 0);
  const totalGround = participants.reduce((sum, c) => sum + c.stats.military.ground, 0);
  const totalAir = participants.reduce((sum, c) => sum + c.stats.military.air, 0);
  const totalNaval = participants.reduce((sum, c) => sum + c.stats.military.naval, 0);

  const avgX = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
  const avgY = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;
  const mergedCenter = { x: avgX, y: avgY };

  const provinceCount = Math.max(2, Math.floor(allPoints.length / 40));
  const provinceSeeds: Point[] = [];
  for(let i = 0; i < provinceCount; i++) {
    provinceSeeds.push(allPoints[Math.floor(Math.random() * allPoints.length)]);
  }

  const mergedProvinces: Province[] = provinceSeeds.map((seed, idx) => ({
    id: `${mergedId}-prov-${idx}`,
    points: [],
    center: seed
  }));

  allPoints.forEach(p => {
    let closestIdx = 0;
    let minDist = Infinity;
    provinceSeeds.forEach((ps, idx) => {
      const d = getDistance(p, ps);
      if (d < minDist) { minDist = d; closestIdx = idx; }
    });
    mergedProvinces[closestIdx].points.push(p);
  });

  const mergedCountry: Country = {
    ...dominant,
    id: mergedId,
    name: mergedName,
    color: mergedColor,
    points: allPoints,
    center: mergedCenter,
    settlements: allSettlements,
    provinces: mergedProvinces,
    stats: {
      ...dominant.stats,
      economy: totalEconomy,
      population: totalPopulation,
      military: {
        ground: totalGround,
        air: totalAir,
        naval: totalNaval
      }
    },
    allianceId: undefined,
  };

  const nextCountries = state.countries.filter(c => !ids.includes(c.id)).concat(mergedCountry);

  return {
    ...state,
    countries: nextCountries,
    alliances: state.alliances.map(a => ({
      ...a,
      countryIds: a.countryIds.filter(cid => !ids.includes(cid))
    })).filter(a => a.countryIds.length > 0)
  };
}

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  const alliancePowers = state.alliances.map(a => {
    let combinedEconomy = 0;
    let combinedPopulation = 0;
    let combinedGround = 0;
    let combinedAir = 0;
    let combinedNaval = 0;

    a.countryIds.forEach(cid => {
      const c = state.countries.find(curr => curr.id === cid);
      if (c) {
        combinedEconomy += c.stats.economy;
        combinedPopulation += c.stats.population;
        combinedGround += c.stats.military.ground;
        combinedAir += c.stats.military.air;
        combinedNaval += c.stats.military.naval;
      }
    });

    const power = combinedGround + combinedAir + (combinedNaval * 0.65) + (combinedEconomy * 0.15) + (combinedPopulation * 0.05);
    return { id: a.id, power, countryIds: a.countryIds };
  });

  const sortedAlliances = [...alliancePowers].sort((a, b) => b.power - a.power);
  const winningAllianceInfo = sortedAlliances[0];
  const winningAlliance = state.alliances.find(a => a.id === winningAllianceInfo.id)!;

  let currentCountries = [...state.countries];

  state.alliances.forEach(a => {
    if (a.id === winningAlliance.id) return;
    
    a.countryIds.forEach(cid => {
      const loserC = currentCountries.find(c => c.id === cid);
      if (!loserC) return;
      const receiverCid = winningAlliance.countryIds[Math.floor(Math.random() * winningAlliance.countryIds.length)];
      const res = executeBattle({ ...state, countries: currentCountries }, receiverCid, loserC.id, receiverCid);
      currentCountries = res.state.countries;
    });
  });

  const allParticipantIds = state.alliances.flatMap(a => a.countryIds);
  const nextCountries = currentCountries.map(c => {
    if (allParticipantIds.includes(c.id)) {
      return { 
        ...c, 
        color: getRandomColor(),
        allianceId: undefined 
      };
    }
    return c;
  });

  return { ...state, countries: nextCountries, alliances: [] };
}

export function createAlliance(state: GameState, countryIds: string[]): GameState {
  if (countryIds.length === 0) return state;

  const strongest = countryIds.reduce((prev, currId) => {
    const c = state.countries.find(x => x.id === currId);
    const p = c ? (c.stats.military.ground + c.stats.military.air + c.stats.military.naval) : 0;
    return p > prev.power ? { id: currId, power: p } : prev;
  }, { id: '', power: -1 });

  const leader = state.countries.find(c => c.id === strongest.id);
  const color = ['#F9C74F', '#4D908E', '#577590', '#277DA1', '#90BE6D', '#F94144'][state.alliances.length % 6];
  
  const alliance: Alliance = {
    id: `alliance-${state.alliances.length}-${Date.now()}`,
    name: `${leader?.name || 'Grand'} Coalition`,
    color: color,
    countryIds: [...countryIds]
  };

  const updatedCountries = state.countries.map(c => {
    if (countryIds.includes(c.id)) {
      return { ...c, allianceId: alliance.id };
    }
    return c;
  });

  return { ...state, alliances: [...state.alliances, alliance], countries: updatedCountries };
}
