"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  generateNewWorld, 
  processTick, 
  executeBattle, 
  createAlliance, 
  executeAllianceWar, 
  mergeCountries,
  renameCountry,
  updateCountryColor,
  splitCountry,
  POLITICAL_COLORS,
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
  Type,
  Pencil,
  Check,
  Scissors,
  Layers,
  ChevronLeft,
  ChevronRight,
  Menu,
  ChevronUp,
  ChevronDown,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type InteractionMode = 'none' | 'battle-menu' | 'battle-select' | 'war-menu' | 'war-select' | 'stats-panel' | 'merge-menu' | 'merge-select' | 'split-menu' | 'split-select';

export default function VantagePoint() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [world, setWorld] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [selection, setSelection] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [splitParts, setSplitParts] = useState(2);
  const [splitNames, setSplitNames] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [controlsOpen, setControlsOpen] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initWorld();
  }, []);

  // Auto-collapse on mobile initially
  useEffect(() => {
    if (isMobile) {
      setControlsOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (world?.gameStarted && !world.isPaused) {
      const interval = 30000; // 30 seconds per year
      timerRef.current = setInterval(() => {
        setWorld(prev => prev ? processTick(prev) : null);
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [world?.gameStarted, world?.isPaused]);

  useEffect(() => {
    setSplitNames(prev => {
      const next = [...prev];
      if (next.length < splitParts) {
        for (let i = next.length; i < splitParts; i++) next.push("");
      } else {
        return next.slice(0, splitParts);
      }
      return next;
    });
  }, [splitParts]);

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
    } else if (mode === 'split-select') {
      setSelection([c.id]);
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

  const handleSplit = () => {
    if (selection.length !== 1 || !world) return;
    const allNamed = splitNames.every(n => n.trim().length > 0);
    if (!allNamed) {
      toast({ variant: "destructive", title: "Incomplete Data", description: "Please provide names for all successor states." });
      return;
    }
    const nextWorld = splitCountry(world, selection[0], splitParts, splitNames);
    setWorld(nextWorld);
    setSelection([]);
    setSplitNames([]);
    setMode('none');
    toast({ title: "Nation Partitioned", description: `The territory has been divided into ${splitParts} new sovereign entities.` });
  };

  const handleSaveRename = () => {
    if (!world || !editingId || !editingName.trim()) return;
    const nextWorld = renameCountry(world, editingId, editingName.trim());
    setWorld(nextWorld);
    setEditingId(null);
    setEditingName('');
    toast({ title: "Record Updated", description: "The nation has been officially renamed." });
  };

  const handleColorChange = (id: string, color: string) => {
    if (!world) return;
    const nextWorld = updateCountryColor(world, id, color);
    setWorld(nextWorld);
    toast({ title: "Map Refined", description: "National administrative color has been updated." });
  };

  if (!world || !world.gameStarted) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-black gap-8 p-4 text-center">
        <div className="space-y-4">
          <Globe className="h-16 w-16 md:h-24 md:w-24 text-black mx-auto mb-4" />
          <h1 className="text-4xl md:text-6xl font-headline font-bold tracking-tighter">VANTAGE POINT</h1>
          <p className="text-muted-foreground uppercase tracking-[0.4em] text-[10px] md:text-xs">Political Sandbox Simulation</p>
        </div>
        <Button 
          size="lg" 
          className="px-10 py-6 md:px-16 md:py-8 text-lg md:text-xl font-headline bg-black text-white hover:bg-black/80 rounded-none transition-all w-full md:w-auto" 
          onClick={handleStart} 
          disabled={loading}
        >
          {loading ? "INITIALIZING ATLAS..." : "START SIMULATION"}
        </Button>
      </div>
    );
  }

  const isModeActive = mode !== 'none' && mode !== 'stats-panel';

  return (
    <div className="h-screen w-screen relative overflow-hidden flex flex-col font-body bg-[#F8FAFC]">
      {/* Top Banner Status (Mobile Optimized) */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur-md border border-black/10 p-1 shadow-sm">
           <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => setControlsOpen(!controlsOpen)}>
             {controlsOpen ? (isMobile ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />) : (isMobile ? <ChevronUp className="h-4 w-4" /> : <Menu className="h-4 w-4" />)}
           </Button>
           <div className="hidden sm:block w-px h-4 bg-black/10 mx-1" />
           <div className="px-2 py-0.5 text-center min-w-[60px]">
             <span className="text-[7px] text-muted-foreground uppercase block font-bold leading-none mb-0.5">Year</span>
             <span className="text-[11px] font-bold leading-none tracking-tight">{world.gameYear}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur-md border border-black/10 p-1 shadow-sm">
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => setWorld(w => w ? {...w, isPaused: !w.isPaused} : null)}>
            {world.isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <div className="w-px h-4 bg-black/10" />
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={initWorld}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <main className="flex-1 relative flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#E5F1F5] flex items-center justify-center overflow-hidden">
           <TacticalMap 
            countries={world.countries} 
            alliances={world.alliances}
            selection={selection}
            onSelectCountry={handleCountryClick}
          />
        </div>

        {/* HUD Controls - Optimized for Mobile Selection */}
        <div 
          className={cn(
            "z-30 transition-all duration-300 ease-in-out",
            // Desktop: Floating Left
            "md:absolute md:top-20 md:left-6 md:flex md:flex-col md:gap-4 md:w-auto",
            // Mobile: Bottom Panel
            "absolute bottom-0 left-0 right-0 w-full flex flex-col md:translate-y-0",
            !controlsOpen && (isMobile ? "translate-y-full" : "-translate-x-full opacity-0")
          )}
        >
          {/* Contextual Action Consoles (Compact for Mobile) */}
          <div className={cn(
            "transition-all duration-300",
            isModeActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none h-0"
          )}>
            {/* Battle Console */}
            {(mode === 'battle-menu' || mode === 'battle-select') && (
              <Card className="rounded-none border-x-0 border-b border-black/10 shadow-lg bg-white w-full md:w-56 overflow-hidden">
                <CardHeader className="p-2 border-b border-black/5 flex flex-row items-center justify-between">
                  <CardTitle className="text-[9px] uppercase font-bold flex items-center gap-2"><Swords className="h-3 w-3" /> Battle Protocol</CardTitle>
                  <Button variant="ghost" size="icon" className="h-5 w-5 md:hidden" onClick={() => setMode('none')}><X className="h-3 w-3" /></Button>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="space-y-1">
                    {selection.map(id => (
                      <div key={id} className="text-[8px] font-bold uppercase truncate border-l-2 border-black pl-1.5 py-0.5">
                        {world.countries.find(c => c.id === id)?.name}
                      </div>
                    ))}
                    {selection.length === 0 && <p className="text-[8px] text-muted-foreground uppercase italic text-center">Tap 2 nations</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {mode === 'battle-menu' ? (
                      <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('battle-select')}>
                        SELECT TARGETS
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length !== 2} onClick={startBattle}>
                          EXECUTE
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('battle-menu'); setSelection([]); }}>
                          CANCEL
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Coalition Hub */}
            {(mode === 'war-menu' || mode === 'war-select') && (
              <Card className="rounded-none border-x-0 border-b border-black/10 shadow-lg bg-white w-full md:w-56 overflow-hidden">
                <CardHeader className="p-2 border-b border-black/5 flex flex-row items-center justify-between">
                  <CardTitle className="text-[9px] uppercase font-bold flex items-center gap-2"><Shield className="h-3 w-3" /> Diplomatic Bloc</CardTitle>
                  <Button variant="ghost" size="icon" className="h-5 w-5 md:hidden" onClick={() => setMode('none')}><X className="h-3 w-3" /></Button>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
                     <p className="text-[7px] text-muted-foreground uppercase font-bold">Active Blocs: {world.alliances.length}</p>
                     {world.alliances.map(a => (
                       <div key={a.id} className="flex items-center gap-2 bg-black/[0.02] p-1">
                          <div className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: a.color }} />
                          <span className="text-[8px] font-bold truncate uppercase">{a.name}</span>
                       </div>
                     ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    {mode === 'war-menu' ? (
                      <div className="space-y-1">
                        <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('war-select')}>
                          NEW ALLIANCE
                        </Button>
                        {world.alliances.length >= 2 && (
                           <Button size="sm" variant="destructive" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={executeWar}>
                           WORLD WAR
                         </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-center uppercase">Selected: {selection.length}</p>
                        <div className="grid grid-cols-2 gap-1">
                          <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length === 0} onClick={confirmAlliance}>
                            CONFIRM
                          </Button>
                          <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('war-menu'); setSelection([]); }}>
                            BACK
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Merge Console */}
            {(mode === 'merge-menu' || mode === 'merge-select') && (
              <Card className="rounded-none border-x-0 border-b border-black/10 shadow-lg bg-white w-full md:w-64 overflow-hidden">
                <CardHeader className="p-2 border-b border-black/5 flex flex-row items-center justify-between">
                  <CardTitle className="text-[9px] uppercase font-bold flex items-center gap-2"><Combine className="h-3 w-3" /> Unification</CardTitle>
                  <Button variant="ghost" size="icon" className="h-5 w-5 md:hidden" onClick={() => setMode('none')}><X className="h-3 w-3" /></Button>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="space-y-1 max-h-[60px] overflow-y-auto pr-1">
                    {selection.map(id => (
                      <div key={id} className="text-[8px] font-bold uppercase truncate border-l-2 border-black pl-1.5 py-0.5">
                        {world.countries.find(c => c.id === id)?.name}
                      </div>
                    ))}
                    {selection.length === 0 && <p className="text-[8px] text-muted-foreground uppercase italic text-center">Tap states to unite</p>}
                  </div>

                  {mode === 'merge-select' && selection.length >= 2 && (
                    <div className="space-y-1">
                      <label className="text-[7px] font-bold uppercase text-muted-foreground px-1">Unified State Identity</label>
                      <Input 
                        placeholder="e.g. Great Federation"
                        className="h-8 text-[10px] rounded-none border-black/20 focus-visible:ring-black px-2"
                        value={mergeName}
                        onChange={(e) => setMergeName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    {mode === 'merge-menu' ? (
                      <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('merge-select')}>
                        CHOOSE STATES
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        <Button 
                          size="sm" 
                          className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" 
                          disabled={selection.length < 2 || !mergeName.trim()} 
                          onClick={handleMerge}
                        >
                          PROCLAIM
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}>
                          CANCEL
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Split Console */}
            {(mode === 'split-menu' || mode === 'split-select') && (
              <Card className="rounded-none border-x-0 border-b border-black/10 shadow-lg bg-white w-full md:w-64 overflow-hidden">
                <CardHeader className="p-2 border-b border-black/5 flex flex-row items-center justify-between">
                  <CardTitle className="text-[9px] uppercase font-bold flex items-center gap-2"><Scissors className="h-3 w-3" /> State Partition</CardTitle>
                  <Button variant="ghost" size="icon" className="h-5 w-5 md:hidden" onClick={() => setMode('none')}><X className="h-3 w-3" /></Button>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="space-y-1">
                    {selection.length > 0 ? (
                      <div className="text-[9px] font-bold uppercase truncate border-l-2 border-black pl-1.5">
                        {world.countries.find(c => c.id === selection[0])?.name}
                      </div>
                    ) : (
                      <p className="text-[8px] text-muted-foreground uppercase italic text-center">Tap nation to divide</p>
                    )}
                  </div>

                  {mode === 'split-select' && selection.length === 1 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[8px] font-bold uppercase text-muted-foreground">
                          <span>Successors</span>
                          <span className="text-black text-[10px]">{splitParts}</span>
                        </div>
                        <Slider 
                          value={[splitParts]}
                          onValueChange={(val) => setSplitParts(val[0])}
                          min={2}
                          max={6}
                          step={1}
                          className="py-0.5"
                        />
                      </div>

                      <ScrollArea className="h-32 pr-1 border border-black/5 p-1 bg-black/[0.01]">
                        <div className="space-y-2">
                          {Array.from({ length: splitParts }).map((_, i) => (
                            <div key={i} className="space-y-0.5">
                              <label className="text-[6px] font-bold uppercase text-muted-foreground block px-1">Successor {i + 1}</label>
                              <Input 
                                placeholder={`State ${i + 1}`}
                                className="h-7 text-[10px] rounded-none border-black/15 focus-visible:ring-black bg-white px-2"
                                value={splitNames[i] || ""}
                                onChange={(e) => {
                                  const next = [...splitNames];
                                  next[i] = e.target.value;
                                  setSplitNames(next);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="grid grid-cols-2 gap-1">
                        <Button 
                          size="sm" 
                          className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" 
                          disabled={loading || splitNames.some(n => !n.trim())}
                          onClick={handleSplit}
                        >
                          PARTITION
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold rounded-none" onClick={() => { setMode('split-menu'); setSelection([]); setSplitNames([]); }}>
                          BACK
                        </Button>
                      </div>
                    </div>
                  )}

                  {mode === 'split-menu' && (
                    <Button size="sm" className="w-full h-8 text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('split-select')}>
                      SELECT TARGET
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Action Buttons (Vertical scroll on Mobile) */}
          <div className="bg-white/95 backdrop-blur-md border-t md:border border-black/10 p-1 flex md:flex-col gap-0.5 shadow-2xl overflow-x-auto no-scrollbar">
            <Button 
              variant={mode.startsWith('battle') ? "default" : "ghost"} 
              className={cn("shrink-0 justify-center md:justify-start gap-1.5 h-10 md:h-10 text-[9px] uppercase font-bold rounded-none px-3", mode.startsWith('battle') && "bg-black text-white")}
              onClick={() => { setMode('battle-menu'); setSelection([]); }}
            >
              <Swords className="h-3.5 w-3.5" /> <span className="hidden md:inline">LOCAL WAR</span>
            </Button>
            <Button 
              variant={mode.startsWith('war') ? "default" : "ghost"} 
              className={cn("shrink-0 justify-center md:justify-start gap-1.5 h-10 md:h-10 text-[9px] uppercase font-bold rounded-none px-3", mode.startsWith('war') && "bg-black text-white")}
              onClick={() => { setMode('war-menu'); setSelection([]); }}
            >
              <Shield className="h-3.5 w-3.5" /> <span className="hidden md:inline">BLOC WAR</span>
            </Button>
            <Button 
              variant={mode.startsWith('merge') ? "default" : "ghost"} 
              className={cn("shrink-0 justify-center md:justify-start gap-1.5 h-10 md:h-10 text-[9px] uppercase font-bold rounded-none px-3", mode.startsWith('merge') && "bg-black text-white")}
              onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}
            >
              <Combine className="h-3.5 w-3.5" /> <span className="hidden md:inline">MERGE</span>
            </Button>
            <Button 
              variant={mode.startsWith('split') ? "default" : "ghost"} 
              className={cn("shrink-0 justify-center md:justify-start gap-1.5 h-10 md:h-10 text-[9px] uppercase font-bold rounded-none px-3", mode.startsWith('split') && "bg-black text-white")}
              onClick={() => { setMode('split-menu'); setSelection([]); setSplitParts(2); setSplitNames(["", ""]); }}
            >
              <Scissors className="h-3.5 w-3.5" /> <span className="hidden md:inline">SPLIT</span>
            </Button>
            <Button 
              variant={mode === 'stats-panel' ? "default" : "ghost"} 
              className={cn("shrink-0 justify-center md:justify-start gap-1.5 h-10 md:h-10 text-[9px] uppercase font-bold rounded-none px-3", mode === 'stats-panel' && "bg-black text-white")}
              onClick={() => { setMode(mode === 'stats-panel' ? 'none' : 'stats-panel'); setEditingId(null); }}
            >
              <ListOrdered className="h-3.5 w-3.5" /> <span className="hidden md:inline">RANKINGS</span>
            </Button>
          </div>
        </div>
      </main>

      {/* Global Rankings Sidebar */}
      {mode === 'stats-panel' && (
        <aside className="fixed inset-y-0 right-0 w-full sm:w-[400px] h-full bg-white border-l border-black/10 flex flex-col z-50 shadow-2xl animate-in slide-in-from-right duration-500">
          <div className="p-4 border-b border-black/5 flex items-center justify-between bg-white/50 backdrop-blur-md">
            <div className="space-y-0.5">
              <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Global Atlas</h2>
              <p className="text-[7px] text-muted-foreground uppercase font-bold tracking-tight">Geopolitical Statistics</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => { setMode('none'); setEditingId(null); }} className="rounded-none h-8 w-8"><X className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <div className="divide-y divide-black/[0.03]">
              {[...world.countries].sort((a,b) => b.stats.economy - a.stats.economy).map((c, idx) => {
                const isRecovering = c.recoveryEndYear && world.gameYear <= c.recoveryEndYear;
                const isBooming = c.boomEndYear && world.gameYear <= c.boomEndYear && world.gameYear > (c.recoveryEndYear || 0);
                const isEditing = editingId === c.id;

                return (
                  <div key={c.id} className="p-4 space-y-4 hover:bg-black/[0.01] transition-colors group/row">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <span className="text-[9px] font-bold opacity-20 shrink-0">#{idx + 1}</span>
                        
                        {/* Color Picker Popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-5 h-5 shrink-0 border border-black/10 p-0 rounded-none overflow-hidden hover:opacity-80"
                              style={{ backgroundColor: c.color }}
                            >
                              <span className="sr-only">Change color</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[180px] p-2 rounded-none border-black/10 shadow-xl bg-white" side="left">
                            <div className="grid grid-cols-5 gap-1 mb-2">
                              {POLITICAL_COLORS.map(pc => (
                                <button
                                  key={pc}
                                  className={cn(
                                    "w-6 h-6 border border-black/5 transition-transform hover:scale-110",
                                    c.color === pc && "ring-1 ring-black ring-offset-1"
                                  )}
                                  style={{ backgroundColor: pc }}
                                  onClick={() => handleColorChange(c.id, pc)}
                                />
                              ))}
                            </div>
                            <div className="space-y-1 pt-1 border-t border-black/5">
                              <label className="text-[7px] font-bold uppercase text-muted-foreground block">Custom Hex</label>
                              <div className="flex gap-1">
                                <Input 
                                  type="text" 
                                  className="h-6 text-[9px] px-1 rounded-none font-mono"
                                  placeholder="#000000"
                                  defaultValue={c.color}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (/^#[0-9A-F]{6}$/i.test(val)) handleColorChange(c.id, val);
                                  }}
                                />
                                <input 
                                  type="color" 
                                  className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
                                  defaultValue={c.color}
                                  onChange={(e) => handleColorChange(c.id, e.target.value)}
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>

                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input 
                              autoFocus
                              className="h-7 text-[10px] font-bold uppercase rounded-none border-black/20 focus-visible:ring-black bg-white px-2"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none shrink-0" onClick={handleSaveRename}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/name overflow-hidden">
                            <h3 className="text-[12px] font-headline font-bold uppercase truncate max-w-[150px] sm:max-w-[200px] tracking-tight">{c.name}</h3>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 opacity-40 md:opacity-0 md:group-hover/name:opacity-100 transition-opacity rounded-none" 
                              onClick={() => {
                                setEditingId(c.id);
                                setEditingName(c.name);
                              }}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {isRecovering && (
                          <Badge variant="outline" className="text-[6px] uppercase font-bold border-yellow-500/50 text-yellow-700 rounded-none bg-yellow-50 px-1 py-0 h-3">
                            RCV
                          </Badge>
                        )}
                        {isBooming && (
                          <Badge variant="outline" className="text-[6px] uppercase font-bold border-green-500/50 text-green-700 rounded-none bg-green-50 px-1 py-0 h-3">
                            BOM
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 px-1">
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><TrendingUp className="h-2 w-2" /> Economy</span>
                        <p className={cn("text-[11px] font-bold font-mono tracking-tighter", isBooming && "text-green-600")}>${c.stats.economy.toFixed(1)}B</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><Users className="h-2 w-2" /> Population</span>
                        <p className="text-[11px] font-bold font-mono tracking-tighter">{c.stats.population.toFixed(2)}M</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-0.5 px-1 border-t border-black/[0.02]">
                      <div className="space-y-0.5">
                        <span className="text-[6px] text-muted-foreground uppercase font-bold block tracking-tighter">Ground</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.ground.toFixed(0)}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[6px] text-muted-foreground uppercase font-bold block tracking-tighter">Air</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.air.toFixed(0)}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[6px] text-muted-foreground uppercase font-bold block tracking-tighter">Naval</span>
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
