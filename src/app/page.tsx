"use client";

import React, { useState, useEffect, useRef } from 'react';
import { generateNewWorld, processTick, setDiplomacy, GameState, Country, Settlement } from './lib/game-logic';
import { TacticalMap } from '@/components/game/TacticalMap';
import { HeraldryIcon } from '@/components/game/HeraldryIcon';
import { 
  Shield, 
  Activity, 
  Layers, 
  Crosshair, 
  Zap,
  RotateCcw,
  Globe,
  Users,
  TrendingUp,
  Plane,
  Anchor,
  CircleDot,
  Pause,
  Play,
  Swords,
  Handshake,
  UserCheck,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function VantagePoint() {
  const [world, setWorld] = useState<GameState | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<{s: Settlement, countryId: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState({
    borders: true,
    military: false,
    economic: false
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initNewGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (world && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setWorld(prev => prev ? processTick(prev) : null);
      }, 3000); 
    }
  }, [world]);

  const initNewGame = async () => {
    setLoading(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    
    const newWorld = await generateNewWorld(1000, 1000);
    setWorld(newWorld);
    setLoading(false);
    setSelectedCountryId(null);
    setSelectedSettlement(null);
  };

  const togglePause = () => {
    if (world) {
      setWorld({ ...world, isPaused: !world.isPaused });
    }
  };

  const toggleOverlay = (key: keyof typeof overlays) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSetDiplomacy = (id1: string, id2: string, type: 'war' | 'alliance' | 'neutral') => {
    if (world) {
      setWorld(setDiplomacy(world, id1, id2, type));
    }
  };

  const getRelation = (id1: string, id2: string) => {
    return world?.relations.find(r => r.participants.includes(id1) && r.participants.includes(id2)) || null;
  };

  const selectedCountry = world?.countries.find(c => c.id === selectedCountryId) || null;

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-accent gap-6">
        <div className="relative">
          <Globe className="h-16 w-16 animate-pulse" />
          <div className="absolute inset-0 border-2 border-accent rounded-full animate-ping opacity-20" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-headline font-light tracking-[0.2em] text-white">VANTAGE POINT</h1>
          <p className="text-sm font-code animate-pulse">SYNTHESIZING GEOPOLITICAL LANDSCAPE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden flex font-body bg-[#0F1216]">
      <main className="flex-1 relative">
        {world && (
          <TacticalMap 
            countries={world.countries} 
            activeOverlays={overlays}
            onSelectCountry={(c) => {
              setSelectedCountryId(c.id);
              setSelectedSettlement(null);
            }}
            onSelectSettlement={(s, c) => {
              setSelectedSettlement({s, countryId: c.id});
              setSelectedCountryId(c.id);
            }}
          />
        )}

        {/* HUD Controls */}
        <div className="absolute top-6 left-6 flex flex-col gap-3">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg flex flex-col gap-1">
            <Button size="icon" variant={overlays.borders ? "default" : "ghost"} className={overlays.borders ? "bg-accent text-background" : "text-white"} onClick={() => toggleOverlay('borders')}><Layers className="h-4 w-4" /></Button>
            <Button size="icon" variant={overlays.military ? "default" : "ghost"} className={overlays.military ? "bg-accent text-background" : "text-white"} onClick={() => toggleOverlay('military')}><Shield className="h-4 w-4" /></Button>
            <Button size="icon" variant={overlays.economic ? "default" : "ghost"} className={overlays.economic ? "bg-accent text-background" : "text-white"} onClick={() => toggleOverlay('economic')}><Activity className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="ghost" className="bg-black/40 backdrop-blur-md border border-white/10 text-white hover:text-accent" onClick={togglePause}>{world?.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
            <Button size="icon" variant="ghost" className="bg-black/40 backdrop-blur-md border border-white/10 text-white hover:text-accent" onClick={initNewGame}><RotateCcw className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Global Status Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full pointer-events-none z-20">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-accent uppercase font-headline">Status</span>
            <span className="text-xs text-white uppercase">{world?.isPaused ? 'Paused' : 'Active'}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-accent uppercase font-headline">Year</span>
            <span className="text-xs text-white font-code">{world?.gameYear}.01.01</span>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg flex flex-col gap-2 min-w-[200px]">
          <h4 className="text-[10px] text-accent font-headline uppercase tracking-widest mb-1">Tactical Legend</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-xs">
              <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_white]" />
              <span className="text-white/70">Capital City</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-white/70">Strategic Outpost</span>
            </div>
            {world?.relations.some(r => r.type === 'war') && (
              <div className="flex items-center gap-3 text-xs pt-2 border-t border-white/10">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-headline uppercase text-[10px]">Active Frontline Combat</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Sidebar Panel */}
      <aside className="w-[420px] h-full bg-card border-l border-white/10 flex flex-col z-10 shadow-2xl overflow-hidden">
        {selectedCountry ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-start justify-between mb-4">
                <HeraldryIcon colors={selectedCountry.flagColors} pattern={selectedCountry.flagPattern} className="w-16 h-10 rounded border border-white/20 shadow-lg" />
                <Badge variant="outline" className="text-[10px] border-accent/30 text-accent font-code">ID: {selectedCountry.id.toUpperCase()}</Badge>
              </div>
              <h2 className="text-2xl font-headline font-bold text-white mb-1 uppercase tracking-tight">{selectedCountry.name}</h2>
              <p className="text-xs text-muted-foreground font-code flex items-center gap-2">
                <Crosshair className="h-3 w-3 text-accent" />
                {selectedCountry.points.length > 0 ? 'SOVEREIGN STATE INTACT' : 'GOVERNMENT IN EXILE'}
              </p>
            </div>

            <ScrollArea className="flex-1 p-6">
              <Tabs defaultValue="intel" className="w-full">
                <TabsList className="w-full bg-secondary/50 border border-white/5 mb-6">
                  <TabsTrigger value="intel" className="flex-1 text-xs">INTEL</TabsTrigger>
                  <TabsTrigger value="military" className="flex-1 text-xs">MILITARY</TabsTrigger>
                  <TabsTrigger value="diplomacy" className="flex-1 text-xs">DIPLOMACY</TabsTrigger>
                </TabsList>

                <TabsContent value="intel" className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase font-headline">Population</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-headline text-white">{selectedCountry.stats.population.toFixed(1)}M</span>
                        <span className="text-[10px] text-green-500 font-code">+{selectedCountry.stats.lastGrowth.population.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase font-headline">Economy (GDP)</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-headline text-white">${selectedCountry.stats.economy.toFixed(0)}B</span>
                        <span className="text-[10px] text-green-500 font-code">+${selectedCountry.stats.lastGrowth.economy.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-accent">
                      <Zap className="h-4 w-4" />
                      <h3 className="text-sm font-headline uppercase tracking-wider">Historical Context</h3>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed font-body italic border-l-2 border-accent/20 pl-4 py-1">
                      {selectedCountry.lore?.historicalNarrative || "Analyzing historical archives..."}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="military" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground uppercase font-headline">
                      <span>Deployment Capability</span>
                      <span className="text-accent">{(selectedCountry.stats.military.ground + selectedCountry.stats.military.air + selectedCountry.stats.military.naval).toFixed(0)} Units</span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-white/70 uppercase">
                          <div className="flex items-center gap-1"><CircleDot className="h-2 w-2 text-green-500" /> Ground Forces</div>
                          <span>{selectedCountry.stats.military.ground.toFixed(1)}k</span>
                        </div>
                        <Progress value={Math.min(100, selectedCountry.stats.military.ground / 3)} className="h-2 bg-white/5" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-white/70 uppercase">
                          <div className="flex items-center gap-1"><Plane className="h-3 w-3 text-blue-400" /> Air Command</div>
                          <span>{selectedCountry.stats.military.air.toFixed(1)}k</span>
                        </div>
                        <Progress value={Math.min(100, selectedCountry.stats.military.air)} className="h-2 bg-white/5" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="diplomacy" className="space-y-4">
                  <div className="mb-6 p-4 bg-accent/5 border border-accent/10 rounded-lg">
                    <h3 className="text-xs font-headline text-accent uppercase tracking-widest mb-3 flex items-center gap-2"><Swords className="h-3.5 w-3.5" /> Diplomatic Hub</h3>
                    <div className="space-y-2">
                      {world?.countries.filter(c => c.id !== selectedCountry.id).map(other => {
                        const rel = getRelation(selectedCountry.id, other.id);
                        return (
                          <div key={other.id} className="flex items-center justify-between gap-2 p-2 rounded bg-black/20 border border-white/5">
                            <span className="text-[11px] font-headline text-white truncate max-w-[120px]">{other.name}</span>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className={cn("h-7 px-2 text-[10px] font-headline", rel?.type === 'alliance' ? "text-green-400 bg-green-400/10" : "text-white/40")} onClick={() => handleSetDiplomacy(selectedCountry.id, other.id, rel?.type === 'alliance' ? 'neutral' : 'alliance')}>Ally</Button>
                              <Button size="sm" variant="ghost" className={cn("h-7 px-2 text-[10px] font-headline", rel?.type === 'war' ? "text-red-400 bg-red-400/10" : "text-white/40")} onClick={() => handleSetDiplomacy(selectedCountry.id, other.id, rel?.type === 'war' ? 'neutral' : 'war')}>War</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="h-20 w-20 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/20"><Crosshair className="h-10 w-10" /></div>
            <div>
              <h3 className="text-lg font-headline text-white uppercase tracking-widest">Awaiting Command</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">Select a territory on the tactical map to begin real-time intelligence analysis.</p>
            </div>
          </div>
        )}
        <div className="p-4 bg-background/80 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-code">
          <div className="flex items-center gap-4"><span>SYSTEM ONLINE</span><span>VER: 2.5.0-TACTICAL</span></div>
        </div>
      </aside>
    </div>
  );
}
