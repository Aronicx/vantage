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
  '#FF9F1C', '#2EC4B6', '#E71D36', '#FF9F1C', '#CB997E', 
  '#A5A58D', '#6B705C', '#B7B7A4', '#FFE8D6', '#DDBEA9'
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
  const countryCount = 8 + Math.floor(Math.random() * 4);
  const countries: Country[] = [];
  
  const landCenters: {p: Point, r: number}[] = [];
  const landCenterCount = 6 + Math.floor(Math.random() * 4);
  const padding = width * 0.15;
  
  for(let i = 0; i < landCenterCount; i++) {
    landCenters.push({
      p: {
        x: width * 0.5 + (Math.random() - 0.5) * width * 0.5,
        y: height * 0.5 + (Math.random() - 0.5) * height * 0.5
      },
      r: width * (0.15 + Math.random() * 0.1)
    });
  }

  const gridSize = 10;
  const landPoints: Point[] = [];
  for (let x = padding; x < width - padding; x += gridSize) {
    for (let y = padding; y < height - padding; y += gridSize) {
      const p = { x, y };
      const isLand = landCenters.some(lc => getDistance(p, lc.p) < lc.r);
      if (isLand) landPoints.push(p);
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
      stats: { economy: 0, population: 0, military: { ground: 0, air: 0, naval: 0 }, growthRate: 1.01 + Math.random() * 0.02 }
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
    const sizeFactor = c.points.length / 40;
    const isPowerhouse = Math.random() > 0.85;
    const luckMultiplier = isPowerhouse ? (1.5 + Math.random()) : (0.9 + Math.random() * 0.3);

    c.stats.economy = (100 + sizeFactor * 400) * luckMultiplier;
    c.stats.population = (5 + sizeFactor * 30) * luckMultiplier;
    c.stats.military = {
      ground: (40 + sizeFactor * 80) * luckMultiplier,
      air: (10 + sizeFactor * 30) * luckMultiplier,
      naval: (5 + sizeFactor * 25) * luckMultiplier,
    };

    const provinceCount = 2 + Math.floor(Math.random() * 3);
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
    let currentGrowth = stats.growthRate;

    if (c.recoveryEndYear && state.gameYear <= c.recoveryEndYear) {
      currentGrowth = 1 + (stats.growthRate - 1) * 0.4;
    } else if (c.boomEndYear && state.gameYear <= c.boomEndYear) {
      currentGrowth = 1 + (stats.growthRate - 1) * 1.6;
    }

    stats.population *= currentGrowth;
    stats.economy *= currentGrowth;
    stats.military.ground *= (1 + (currentGrowth - 1) * 0.4);
    stats.military.air *= (1 + (currentGrowth - 1) * 0.4);
    stats.military.naval *= (1 + (currentGrowth - 1) * 0.4);
    
    return { ...c, stats };
  });

  return { ...state, countries: updatedCountries, gameYear: state.gameYear + 1 };
}

export function executeBattle(state: GameState, id1: string, id2: string, forcedWinnerId?: string): { state: GameState, result: string } {
  const c1 = state.countries.find(c => c.id === id1);
  const c2 = state.countries.find(c => c.id === id2);
  if (!c1 || !c2) return { state, result: 'Error' };

  let winner: Country;
  let loser: Country;
  let ratio: number;

  if (forcedWinnerId) {
    winner = forcedWinnerId === id1 ? c1 : c2;
    loser = forcedWinnerId === id1 ? c2 : c1;
    const p1 = c1.stats.military.ground + c1.stats.military.air + (c1.stats.military.naval * 0.5);
    const p2 = c2.stats.military.ground + c2.stats.military.air + (c2.stats.military.naval * 0.5);
    ratio = Math.max(p1, p2) / Math.min(p1, p2);
  } else {
    const power1 = c1.stats.military.ground + c1.stats.military.air + (c1.stats.military.naval * 0.5);
    const power2 = c2.stats.military.ground + c2.stats.military.air + (c2.stats.military.naval * 0.5);
    const variability = 0.9 + Math.random() * 0.2;
    const power1Adjusted = power1 * variability;
    winner = power1Adjusted > power2 ? c1 : c2;
    loser = power1Adjusted > power2 ? c2 : c1;
    ratio = Math.max(power1, power2) / Math.min(power1, power2);
  }

  const isLoserVulnerable = loser.recoveryEndYear && state.gameYear <= loser.recoveryEndYear;
  const winnerAttrition = 0.05 + (Math.random() * 0.05);
  const loserAttrition = isLoserVulnerable 
    ? 0.35 + (Math.random() * 0.15) 
    : 0.20 + (Math.random() * 0.10);

  // Capture original loser stats for spoils calculation
  const originalLoserEconomy = loser.stats.economy;
  const originalLoserPopulation = loser.stats.population;
  const originalLoserMilitary = { ...loser.stats.military };

  // Apply losses to winner (Attrition)
  winner.stats.economy *= (1 - winnerAttrition);
  winner.stats.population *= (1 - winnerAttrition * 0.5);
  winner.stats.military.ground *= (1 - winnerAttrition * 1.5);
  winner.stats.military.air *= (1 - winnerAttrition * 1.5);
  winner.stats.military.naval *= (1 - winnerAttrition * 1.2);

  // Apply losses to loser
  loser.stats.economy *= (1 - loserAttrition);
  loser.stats.population *= (1 - loserAttrition * 0.7);
  loser.stats.military.ground *= (1 - loserAttrition * 2.0);
  loser.stats.military.air *= (1 - loserAttrition * 2.0);
  loser.stats.military.naval *= (1 - loserAttrition * 1.8);

  // Transfer "Spoils" to winner (portion of what the loser lost)
  const lootFactor = 0.4; // 40% of lost resources are gained by winner
  winner.stats.economy += (originalLoserEconomy - loser.stats.economy) * lootFactor;
  winner.stats.population += (originalLoserPopulation - loser.stats.population) * lootFactor;
  winner.stats.military.ground += (originalLoserMilitary.ground - loser.stats.military.ground) * lootFactor * 0.5;
  winner.stats.military.air += (originalLoserMilitary.air - loser.stats.military.air) * lootFactor * 0.5;
  winner.stats.military.naval += (originalLoserMilitary.naval - loser.stats.military.naval) * lootFactor * 0.5;

  winner.recoveryEndYear = state.gameYear + 5;
  winner.boomEndYear = state.gameYear + 15;
  loser.recoveryEndYear = state.gameYear + 10; 

  let lossPercent = 0.15;
  let resultText = 'Minor border adjustment.';

  if (isLoserVulnerable) {
    lossPercent = 0.6 + Math.random() * 0.3;
    resultText = `${loser.name}'s defenses collapsed! Catastrophic territorial loss.`;
  } else {
    if (ratio > 1.8) { lossPercent = 0.3; resultText = 'Significant breakthrough.'; }
    if (ratio > 3.0) { lossPercent = 0.5; resultText = 'Major offensive success.'; }
  }

  const pointsToTransferCount = Math.floor(loser.points.length * lossPercent);
  loser.points.sort((a, b) => getDistance(a, winner.center) - getDistance(b, winner.center));
  const transferredPoints = loser.points.slice(0, pointsToTransferCount);
  
  const capital = loser.settlements.find(s => s.type === 'capital');
  const isCapitalCaptured = capital && transferredPoints.some(p => p.x === capital.coords.x && p.y === capital.coords.y);

  loser.points = loser.points.filter(p => !transferredPoints.some(tp => tp.x === p.x && tp.y === p.y));
  winner.points.push(...transferredPoints);

  let nextCountries = [...state.countries];

  if (isCapitalCaptured) {
    resultText += ` ${loser.name}'s capital was captured!`;
    if (loser.points.length > 0) {
      resultText += ` The remaining territory forms a new independent rump state.`;
      
      const newCountryId = `country-rump-${Date.now()}`;
      const avgX = loser.points.reduce((s, p) => s + p.x, 0) / loser.points.length;
      const avgY = loser.points.reduce((s, p) => s + p.y, 0) / loser.points.length;
      const newCenter = { x: avgX, y: avgY };

      const newCountry: Country = {
        ...loser,
        id: newCountryId,
        name: `Free ${loser.name}`,
        center: newCenter,
        settlements: [{ id: `${newCountryId}-cap`, name: `New Capital`, type: 'capital', coords: newCenter, ownerId: newCountryId }],
        allianceId: undefined,
        stats: {
           ...loser.stats,
           economy: loser.stats.economy * 0.4,
           population: loser.stats.population * 0.4,
           military: {
             ground: loser.stats.military.ground * 0.2,
             air: loser.stats.military.air * 0.2,
             naval: loser.stats.military.naval * 0.2
           }
        },
        recoveryEndYear: state.gameYear + 15
      };
      
      nextCountries = nextCountries.filter(c => c.id !== loser.id).concat(newCountry);
    } else {
      resultText = `${loser.name} has been fully annexed by ${winner.name}.`;
      nextCountries = nextCountries.filter(c => c.id !== loser.id);
    }
  } else if (loser.points.length === 0) {
    resultText = `${loser.name} was absorbed.`;
    nextCountries = nextCountries.filter(c => c.id !== loser.id);
  }

  nextCountries = nextCountries.map(country => {
    if (country.id === winner.id || (isCapitalCaptured && country.id.startsWith('country-rump-'))) {
       const provinceCount = Math.max(2, Math.floor(country.points.length / 50));
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

export function executeAllianceWar(state: GameState): GameState {
  if (state.alliances.length < 2) return state;

  // 1. Calculate combined power for all alliances
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

    const power = combinedGround + combinedAir + (combinedNaval * 0.5) + (combinedEconomy * 0.1) + combinedPopulation;
    return { id: a.id, power, countryIds: a.countryIds };
  });

  // 2. Identify winning alliance
  const winnerAlliance = [...alliancePowers].sort((a, b) => b.power - a.power)[0];
  const winnerRef = state.alliances.find(a => a.id === winnerAlliance.id)!;

  let nextState = { ...state };

  // 3. Resolve conflicts for each loser country
  // We pool the "spoils" here to distribute them at the end
  let totalLootedEconomy = 0;
  let totalLootedPopulation = 0;
  let totalLootedGround = 0;
  let totalLootedAir = 0;
  let totalLootedNaval = 0;

  state.alliances.forEach(a => {
    if (a.id === winnerAlliance.id) return;
    
    a.countryIds.forEach(cid => {
      const loserC = nextState.countries.find(c => c.id === cid);
      if (!loserC) return;
      
      const receiverCid = winnerRef.countryIds[Math.floor(Math.random() * winnerRef.countryIds.length)];
      
      // Calculate what loser will lose
      const isLoserVulnerable = loserC.recoveryEndYear && nextState.gameYear <= loserC.recoveryEndYear;
      const loserAttrition = isLoserVulnerable ? 0.4 : 0.25;

      totalLootedEconomy += loserC.stats.economy * loserAttrition * 0.4;
      totalLootedPopulation += loserC.stats.population * loserAttrition * 0.4;
      totalLootedGround += loserC.stats.military.ground * loserAttrition * 0.2;
      totalLootedAir += loserC.stats.military.air * loserAttrition * 0.2;
      totalLootedNaval += loserC.stats.military.naval * loserAttrition * 0.2;

      const res = executeBattle(nextState, receiverCid, loserC.id, receiverCid);
      nextState = res.state;
    });
  });

  // 4. Distribute pooled spoils among all members of the winning alliance
  const memberCount = winnerRef.countryIds.length;
  if (memberCount > 0) {
    nextState.countries = nextState.countries.map(c => {
      if (winnerRef.countryIds.includes(c.id)) {
        return {
          ...c,
          stats: {
            ...c.stats,
            economy: c.stats.economy + (totalLootedEconomy / memberCount),
            population: c.stats.population + (totalLootedPopulation / memberCount),
            military: {
              ground: c.stats.military.ground + (totalLootedGround / memberCount),
              air: c.stats.military.air + (totalLootedAir / memberCount),
              naval: c.stats.military.naval + (totalLootedNaval / memberCount),
            }
          }
        };
      }
      return c;
    });
  }

  return nextState;
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
    name: `${leader?.name || 'Grand'} Bloc`,
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
