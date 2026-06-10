"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  generateNewWorld, 
  processTick, 
  executeBattle, 
  createAlliance, 
  executeAllianceWar, 
  mergeCountries,
  GameState, 
  Country 
} from './lib/game-logic';
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
  X,
  Users,
  Info,
  Zap,
  Activity,
  Combine,
  Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type InteractionMode = 'none' | 'battle-menu' | 'battle-select' | 'war-menu' | 'war-select' | 'stats-panel' | 'merge-menu' | 'merge-select';

export default function VantagePoint() {
  const { toast } = useToast();
  const [world, setWorld] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [selection, setSelection] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initWorld();
  }, []);

  useEffect(() => {
    if (world?.gameStarted && !world.isPaused) {
      const interval = 30000 / (world.simulationSpeed || 1);
      timerRef.current = setInterval(() => {
        setWorld(prev => prev ? processTick(prev) : null);
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [world?.gameStarted, world?.isPaused, world?.simulationSpeed]);

  const initWorld = async () => {
    setLoading(true);
    const newWorld = await generateNewWorld(1000, 1000);
    setWorld(newWorld);
    setLoading(false);
  };

  const handleStart = () => {
    if (world) setWorld({ ...world, gameStarted: true, isPaused: false });
  };

  const handleCountryClick = (c: Country) => {
    if (mode === 'battle-select') {
      if (selection.includes(c.id)) {
        setSelection(selection.filter(id => id !== c.id));
      } else if (selection.length < 2) {
        setSelection([...selection, c.id]);
      }
    } else if (mode === 'war-select' || mode === 'merge-select') {
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
    toast({ title: "Operation Concluded", description: result });
    setSelection([]);
    setMode('none');
  };

  const confirmAlliance = () => {
    if (selection.length === 0 || !world) return;
    const nextWorld = createAlliance(world, selection);
    setWorld(nextWorld);
    setSelection([]);
    toast({ title: "New Coalition", description: `Bloc established with ${selection.length} members.` });
    setMode('war-menu');
  };

  const executeWar = () => {
    if (!world || world.alliances.length < 2) return;
    const nextWorld = executeAllianceWar(world);
    setWorld(nextWorld); 
    setMode('none');
    toast({ title: "Global Conflict Resolved", description: "Alliances have dissolved and territories have been redistributed." });
  };

  const handleMerge = () => {
    if (selection.length < 2 || !world) return;
    const finalName = mergeName.trim() || `Union of ${selection.length} States`;
    const nextWorld = mergeCountries(world, selection, finalName);
    setWorld(nextWorld);
    setSelection([]);
    setMergeName('');
    setMode('none');
    toast({ title: "Union Proclaimed", description: `${finalName} has been unified into a single state.` });
  };

  if (!world || !world.gameStarted) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-black gap-8">
        <div className="text-center space-y-4">
          <Globe className="h-24 w-24 text-black mx-auto mb-4" />
          <h1 className="text-6xl font-headline font-bold tracking-tighter">VANTAGE POINT</h1>
          <p className="text-muted-foreground uppercase tracking-[0.4em] text-xs">Political Sandbox Simulation</p>
        </div>
        <Button 
          size="lg" 
          className="px-16 py-8 text-xl font-headline bg-black text-white hover:bg-black/80 rounded-none transition-all" 
          onClick={handleStart} 
          disabled={loading}
        >
          {loading ? "INITIALIZING ATLAS..." : "START SIMULATION"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden flex font-body bg-[#F8FAFC]">
      <main className="flex-1 relative flex flex-col">
        <div className="flex-1 border-b border-black/5 bg-[#E5F1F5] flex items-center justify-center overflow-hidden">
           <TacticalMap 
            countries={world.countries} 
            alliances={world.alliances}
            selection={selection}
            onSelectCountry={handleCountryClick}
          />
        </div>

        {/* HUD Controls */}
        <div className="absolute top-6 left-6 flex flex-col gap-3">
          <div className="bg-white/90 backdrop-blur-sm border border-black/10 p-1 flex flex-col shadow-sm">
            <Button 
              variant={mode === 'battle-menu' || mode === 'battle-select' ? "default" : "ghost"} 
              className={cn("justify-start gap-3 h-10 text-[10px] uppercase font-bold rounded-none", (mode === 'battle-menu' || mode === 'battle-select') && "bg-black text-white")}
              onClick={() => { setMode('battle-menu'); setSelection([]); }}
            >
              <Swords className="h-4 w-4" /> LOCAL WAR
            </Button>
            <Button 
              variant={mode === 'war-menu' || mode === 'war-select' ? "default" : "ghost"} 
              className={cn("justify-start gap-3 h-10 text-[10px] uppercase font-bold rounded-none", (mode === 'war-menu' || mode === 'war-select') && "bg-black text-white")}
              onClick={() => { setMode('war-menu'); setSelection([]); }}
            >
              <Shield className="h-4 w-4" /> BLOC WAR
            </Button>
            <Button 
              variant={mode === 'merge-menu' || mode === 'merge-select' ? "default" : "ghost"} 
              className={cn("justify-start gap-3 h-10 text-[10px] uppercase font-bold rounded-none", (mode === 'merge-menu' || mode === 'merge-select') && "bg-black text-white")}
              onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}
            >
              <Combine className="h-4 w-4" /> MERGE
            </Button>
            <Button 
              variant={mode === 'stats-panel' ? "default" : "ghost"} 
              className={cn("justify-start gap-3 h-10 text-[10px] uppercase font-bold rounded-none", mode === 'stats-panel' && "bg-black text-white")}
              onClick={() => { setMode(mode === 'stats-panel' ? 'none' : 'stats-panel'); }}
            >
              <ListOrdered className="h-4 w-4" /> RANKINGS
            </Button>
          </div>

          {(mode === 'battle-menu' || mode === 'battle-select') && (
            <Card className="bg-white border-black/10 rounded-none w-48 shadow-lg">
              <CardHeader className="p-3 border-b border-black/5">
                <CardTitle className="text-[10px] uppercase font-bold">Battle Console</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1">
                  {selection.map(id => (
                    <div key={id} className="text-[9px] font-bold uppercase truncate border-l-2 border-black pl-2">
                      {world.countries.find(c => c.id === id)?.name}
                    </div>
                  ))}
                  {selection.length === 0 && <p className="text-[9px] text-muted-foreground uppercase italic">No targets selected</p>}
                </div>
                {mode === 'battle-menu' ? (
                   <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('battle-select')}>
                   SELECT TARGETS
                 </Button>
                ) : (
                  <div className="flex flex-col gap-1">
                    <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length !== 2} onClick={startBattle}>
                      EXECUTE BATTLE
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('battle-menu'); setSelection([]); }}>
                      CANCEL
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(mode === 'war-menu' || mode === 'war-select') && (
            <Card className="bg-white border-black/10 rounded-none w-48 shadow-lg">
              <CardHeader className="p-3 border-b border-black/5">
                <CardTitle className="text-[10px] uppercase font-bold">Coalition Hub</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1">
                   <p className="text-[9px] text-muted-foreground uppercase">Active Blocs: {world.alliances.length}</p>
                   {world.alliances.map(a => (
                     <div key={a.id} className="flex items-center gap-2">
                        <div className="w-2 h-2" style={{ backgroundColor: a.color }} />
                        <span className="text-[9px] font-bold truncate">{a.name}</span>
                     </div>
                   ))}
                </div>
                {mode === 'war-menu' ? (
                  <div className="space-y-1">
                    <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('war-select')}>
                      NEW ALLIANCE
                    </Button>
                    {world.alliances.length >= 2 && (
                       <Button size="sm" variant="destructive" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={executeWar}>
                       START ALLIANCE WAR
                     </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold">Selected: {selection.length}</p>
                    <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length === 0} onClick={confirmAlliance}>
                      CONFIRM BLOC
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('war-menu'); setSelection([]); }}>
                      BACK
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(mode === 'merge-menu' || mode === 'merge-select') && (
            <Card className="bg-white border-black/10 rounded-none w-56 shadow-lg">
              <CardHeader className="p-3 border-b border-black/5">
                <CardTitle className="text-[10px] uppercase font-bold">State Unification</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-4">
                <div className="space-y-1">
                  {selection.map(id => (
                    <div key={id} className="text-[9px] font-bold uppercase truncate border-l-2 border-black pl-2">
                      {world.countries.find(c => c.id === id)?.name}
                    </div>
                  ))}
                  {selection.length === 0 && <p className="text-[9px] text-muted-foreground uppercase italic">No states selected</p>}
                </div>

                {mode === 'merge-select' && selection.length >= 2 && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 px-1">
                      <Type className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[8px] font-bold uppercase text-muted-foreground">New Nation Name</span>
                    </div>
                    <Input 
                      placeholder="e.g. United Republic"
                      className="h-8 text-[10px] rounded-none border-black/20 focus-visible:ring-black"
                      value={mergeName}
                      onChange={(e) => setMergeName(e.target.value)}
                    />
                  </div>
                )}

                {mode === 'merge-menu' ? (
                  <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('merge-select')}>
                    SELECT STATES
                  </Button>
                ) : (
                  <div className="space-y-1">
                    <Button 
                      size="sm" 
                      className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" 
                      disabled={selection.length < 2 || !mergeName.trim()} 
                      onClick={handleMerge}
                    >
                      UNIFY TERRITORIES
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}>
                      BACK
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Global HUD */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-black/10 p-1 shadow-sm">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => setWorld(w => w ? {...w, isPaused: !w.isPaused} : null)}>
            {world.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <div className="w-px h-4 bg-black/10" />
          <div className="px-4 py-1 text-center min-w-[80px]">
             <span className="text-[8px] text-muted-foreground uppercase block font-bold leading-none mb-1">Year</span>
             <span className="text-xs font-bold leading-none">{world.gameYear}</span>
          </div>
          <div className="w-px h-4 bg-black/10" />
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={initWorld}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </main>

      {/* Rankings Side Panel */}
      {mode === 'stats-panel' && (
        <aside className="w-[400px] h-full bg-white border-l border-black/10 flex flex-col z-50 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-black/5 flex items-center justify-between">
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Global Rankings</h2>
            <Button size="icon" variant="ghost" onClick={() => setMode('none')} className="rounded-none"><X className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y divide-black/5">
              {[...world.countries].sort((a,b) => b.stats.economy - a.stats.economy).map((c, idx) => {
                const isRecovering = c.recoveryEndYear && world.gameYear <= c.recoveryEndYear;
                const isBooming = c.boomEndYear && world.gameYear <= c.boomEndYear && world.gameYear > (c.recoveryEndYear || 0);

                return (
                  <div key={c.id} className="p-6 space-y-4 hover:bg-black/[0.02] transition-colors relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold opacity-30">#{idx + 1}</span>
                        <div className="w-4 h-4" style={{ backgroundColor: c.color }} />
                        <h3 className="text-sm font-bold uppercase">{c.name}</h3>
                      </div>
                      <div className="flex gap-2">
                        {isRecovering && (
                          <Badge variant="outline" className="text-[8px] uppercase font-bold border-yellow-500 text-yellow-600 rounded-none bg-yellow-50">
                            <Activity className="h-2.5 w-2.5 mr-1" /> RECOVERING
                          </Badge>
                        )}
                        {isBooming && (
                          <Badge variant="outline" className="text-[8px] uppercase font-bold border-green-500 text-green-600 rounded-none bg-green-50">
                            <Zap className="h-2.5 w-2.5 mr-1" /> BOOMING
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> Economy</span>
                        <p className={cn("text-xs font-bold font-mono", isBooming && "text-green-600")}>${c.stats.economy.toFixed(1)}B</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold flex items-center gap-1"><Users className="h-2.5 w-2.5" /> Population</span>
                        <p className="text-xs font-bold font-mono">{c.stats.population.toFixed(2)}M</p>
                      </div>
                    </div>
                    <div className="flex gap-6 pt-2">
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold block mb-1">GND</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.ground.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold block mb-1">AIR</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.air.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold block mb-1">NAV</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.naval.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}
