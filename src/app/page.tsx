"use client";

import React, { useState, useEffect, useRef } from 'react';
import { generateNewWorld, processTick, executeBattle, createAlliance, executeAllianceWar, GameState, Country } from './lib/game-logic';
import { TacticalMap } from '@/components/game/TacticalMap';
import { 
  Shield, 
  Globe,
  Swords,
  TrendingUp,
  RotateCcw,
  Play,
  Pause,
  ListOrdered,
  Plus,
  Check,
  X,
  Users,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type InteractionMode = 'none' | 'battle-menu' | 'battle-select' | 'war-menu' | 'war-select' | 'stats-panel';

export default function VantagePoint() {
  const { toast } = useToast();
  const [world, setWorld] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [selection, setSelection] = useState<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initWorld();
  }, []);

  useEffect(() => {
    if (world?.gameStarted && !world.isPaused) {
      timerRef.current = setInterval(() => {
        setWorld(prev => prev ? processTick(prev) : null);
      }, 3000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [world?.gameStarted, world?.isPaused]);

  const initWorld = async () => {
    setLoading(true);
    const newWorld = await generateNewWorld(1000, 1000);
    setWorld(newWorld);
    setLoading(false);
  };

  const handleStart = () => {
    if (world) setWorld({ ...world, gameStarted: true });
  };

  const handleCountryClick = (c: Country) => {
    if (mode === 'battle-select') {
      if (selection.includes(c.id)) {
        setSelection(selection.filter(id => id !== c.id));
      } else if (selection.length < 2) {
        setSelection([...selection, c.id]);
      }
    } else if (mode === 'war-select') {
      if (selection.includes(c.id)) {
        setSelection(selection.filter(id => id !== c.id));
      } else {
        setSelection([...selection, c.id]);
      }
    }
  };

  const startBattle = () => {
    if (selection.length !== 2 || !world) return;
    const { state, result } = executeBattle(world, selection[0], selection[1]);
    setWorld(state);
    toast({ title: "Battle Conclusion", description: result });
    setSelection([]);
    setMode('none');
  };

  const confirmAlliance = () => {
    if (selection.length === 0 || !world) return;
    if (world.alliances.length >= 4) {
      toast({ title: "Limit Reached", description: "Maximum 4 alliances supported.", variant: "destructive" });
      return;
    }
    const nextWorld = createAlliance(world, selection);
    setWorld(nextWorld);
    setSelection([]);
    toast({ title: "Alliance Formed", description: `Alliance ${nextWorld.alliances.length} created.` });
    // Keep in war-menu to allow more alliances or start war
    setMode('war-menu');
  };

  const executeWar = () => {
    if (!world || world.alliances.length < 2) return;
    const nextWorld = executeAllianceWar(world);
    setWorld({ ...nextWorld, alliances: [] }); 
    setMode('none');
    toast({ title: "Great War Ends", description: "Borders have been redrawn based on coalition power." });
  };

  if (!world || !world.gameStarted) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0F1216] text-white gap-8">
        <div className="text-center space-y-2">
          <Globe className="h-20 w-20 text-accent mx-auto animate-pulse mb-4" />
          <h1 className="text-5xl font-headline font-bold tracking-[0.3em]">VANTAGE POINT</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm">Geopolitical Map Strategy</p>
        </div>
        <Button size="lg" className="px-12 py-8 text-xl font-headline bg-accent text-background hover:bg-accent/90" onClick={handleStart} disabled={loading}>
          {loading ? "INITIALIZING WORLD..." : "START SIMULATION"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden flex font-body bg-[#0F1216]">
      <main className="flex-1 relative">
        <TacticalMap 
          countries={world.countries} 
          alliances={world.alliances}
          selection={selection}
          onSelectCountry={handleCountryClick}
          onSelectSettlement={() => {}}
        />

        {/* Global HUD Controls */}
        <div className="absolute top-6 left-6 flex flex-col gap-4">
          <Card className="bg-black/60 backdrop-blur-md border-white/10 w-48 shadow-2xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] uppercase tracking-widest text-accent font-headline">Main Command</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 flex flex-col gap-1">
              <Button 
                variant={mode === 'battle-menu' || mode === 'battle-select' ? "default" : "ghost"} 
                className={cn("justify-start gap-2 h-9 text-xs", (mode === 'battle-menu' || mode === 'battle-select') && "bg-accent text-background")}
                onClick={() => { setMode('battle-menu'); setSelection([]); }}
              >
                <Swords className="h-4 w-4" /> BATTLE
              </Button>
              <Button 
                variant={mode === 'war-menu' || mode === 'war-select' ? "default" : "ghost"} 
                className={cn("justify-start gap-2 h-9 text-xs", (mode === 'war-menu' || mode === 'war-select') && "bg-accent text-background")}
                onClick={() => { setMode('war-menu'); setSelection([]); }}
              >
                <Shield className="h-4 w-4" /> WAR
              </Button>
              <Button 
                variant={mode === 'stats-panel' ? "default" : "ghost"} 
                className={cn("justify-start gap-2 h-9 text-xs", mode === 'stats-panel' && "bg-accent text-background")}
                onClick={() => { setMode(mode === 'stats-panel' ? 'none' : 'stats-panel'); }}
              >
                <ListOrdered className="h-4 w-4" /> STATS
              </Button>
            </CardContent>
          </Card>

          {/* Contextual Menus */}
          {mode === 'battle-menu' && (
            <Card className="bg-black/80 backdrop-blur-md border-white/20 w-48 animate-in slide-in-from-left duration-200">
               <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[10px] uppercase tracking-widest text-white">Battle Menu</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <Button size="sm" className="w-full h-8 text-[10px]" onClick={() => setMode('battle-select')}>
                  SELECT COUNTRIES
                </Button>
                <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] text-white/40" onClick={() => setMode('none')}>CANCEL</Button>
              </CardContent>
            </Card>
          )}

          {mode === 'battle-select' && (
            <Card className="bg-accent/10 backdrop-blur-md border-accent/30 w-48 shadow-2xl">
              <CardContent className="p-4 flex flex-col gap-3">
                <p className="text-[10px] text-accent uppercase font-headline font-bold">Pick 2 Nations</p>
                <div className="flex flex-wrap gap-1 min-h-[20px]">
                  {selection.map(id => (
                    <Badge key={id} variant="outline" className="text-[9px] bg-accent/20 border-accent/40">
                      {world.countries.find(c => c.id === id)?.name || id}
                    </Badge>
                  ))}
                </div>
                <Button size="sm" className="w-full h-8 text-[10px] bg-accent text-background" disabled={selection.length !== 2} onClick={startBattle}>
                  START BATTLE
                </Button>
                <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] text-white/60" onClick={() => { setMode('battle-menu'); setSelection([]); }}>
                  BACK
                </Button>
              </CardContent>
            </Card>
          )}

          {mode === 'war-menu' && (
            <Card className="bg-black/80 backdrop-blur-md border-white/20 w-48 animate-in slide-in-from-left duration-200">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[10px] uppercase tracking-widest text-white">War Menu</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="space-y-1">
                  <p className="text-[8px] text-white/40 uppercase">Existing Alliances: {world.alliances.length}</p>
                  {world.alliances.map((a, i) => (
                    <Badge key={a.id} className="w-full justify-start text-[8px]" style={{ backgroundColor: a.color }}>{a.name}</Badge>
                  ))}
                </div>
                <Button size="sm" className="w-full h-8 text-[10px]" onClick={() => setMode('war-select')}>
                  {world.alliances.length < 4 ? "SELECT ALLIANCE" : "MAX ALLIANCES"}
                </Button>
                {world.alliances.length >= 2 && (
                  <Button size="sm" variant="destructive" className="w-full h-8 text-[10px]" onClick={executeWar}>
                    START GREAT WAR
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] text-white/40" onClick={() => setMode('none')}>CANCEL</Button>
              </CardContent>
            </Card>
          )}

          {mode === 'war-select' && (
            <Card className="bg-accent/10 backdrop-blur-md border-accent/30 w-48 shadow-2xl">
              <CardContent className="p-4 flex flex-col gap-3">
                <p className="text-[10px] text-accent uppercase font-headline font-bold">Group Selection</p>
                <div className="flex flex-wrap gap-1 min-h-[20px]">
                  {selection.map(id => (
                    <Badge key={id} variant="outline" className="text-[9px] bg-accent/20 border-accent/40">
                      {world.countries.find(c => c.id === id)?.name || id}
                    </Badge>
                  ))}
                </div>
                <Button size="sm" className="w-full h-8 text-[10px] bg-accent text-background" disabled={selection.length === 0} onClick={confirmAlliance}>
                  OK (CONFIRM ALLIANCE)
                </Button>
                <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] text-white/60" onClick={() => { setMode('war-menu'); setSelection([]); }}>
                  BACK
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status HUD */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={() => setWorld(w => w ? {...w, isPaused: !w.isPaused} : null)}>
            {world.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <div className="px-3 flex flex-col items-center">
             <span className="text-[9px] text-accent font-headline uppercase">Global Year</span>
             <span className="text-xs text-white font-code">{world.gameYear}</span>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-accent" onClick={initWorld}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </main>

      {/* Stats Rankings Overlay */}
      {mode === 'stats-panel' && (
        <aside className="w-[400px] h-full bg-card border-l border-white/10 flex flex-col z-50 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-headline font-bold text-white uppercase tracking-tighter">Global Rankings</h2>
            <Button size="icon" variant="ghost" onClick={() => setMode('none')}><X className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {[...world.countries].sort((a,b) => (b.stats.economy) - (a.stats.economy)).map((c, idx) => (
                <div key={c.id} className="p-4 bg-white/5 border border-white/5 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-code text-accent">#{idx + 1}</span>
                      <h3 className="text-sm font-headline font-bold uppercase">{c.name}</h3>
                    </div>
                    {c.allianceId && (
                      <Badge variant="outline" className="text-[8px] opacity-60">
                        {world.alliances.find(a => a.id === c.allianceId)?.name}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> Economy</span>
                      <p className="text-xs font-code text-white">${c.stats.economy.toFixed(0)}B</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><Users className="h-2.5 w-2.5" /> Population</span>
                      <p className="text-xs font-code text-white">{c.stats.population.toFixed(1)}M</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <div className="text-center">
                      <span className="text-[8px] text-muted-foreground uppercase block">Ground</span>
                      <span className="text-[10px] font-code text-green-400">{c.stats.military.ground.toFixed(0)}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[8px] text-muted-foreground uppercase block">Air</span>
                      <span className="text-[10px] font-code text-blue-400">{c.stats.military.air.toFixed(0)}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[8px] text-muted-foreground uppercase block">Naval</span>
                      <span className="text-[10px] font-code text-cyan-400">{c.stats.military.naval.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}
