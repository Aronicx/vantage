"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Country,
  BattleMode
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type InteractionMode = 'none' | 'battle-menu' | 'battle-select' | 'war-menu' | 'war-select' | 'stats-panel' | 'merge-menu' | 'merge-select' | 'split-menu' | 'split-select';

export default function VantagePoint() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [world, setWorld] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [battleMode, setBattleMode] = useState<BattleMode>('attacker');
  const [selection, setSelection] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [splitParts, setSplitParts] = useState(2);
  const [splitNames, setSplitNames] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initWorld();
  }, []);

  useEffect(() => {
    if (isMobile) {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    } else {
      setLeftSidebarOpen(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (world?.gameStarted && !world.isPaused) {
      const interval = 10000;
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
    if (mode === 'battle-select' || mode === 'battle-menu') {
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
    } else {
      setRightSidebarOpen(true);
      setEditingId(null);
    }
  };

  const startBattle = () => {
    if (selection.length !== 2 || !world) return;
    const { state, result } = executeBattle(world, selection[0], selection[1], battleMode);
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

  const sortedCountries = useMemo(() => {
    if (!world) return [];
    return [...world.countries].sort((a,b) => b.stats.economy - a.stats.economy);
  }, [world?.countries]);

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
    <div className="h-screen w-screen flex flex-col font-body bg-[#F8FAFC] overflow-hidden">
      <header className="h-12 border-b border-black/10 bg-white/95 backdrop-blur-md z-50 flex items-center justify-between px-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            <h1 className="text-xs font-bold uppercase tracking-widest hidden sm:block">Vantage Point</h1>
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="flex flex-col justify-center">
             <span className="text-[7px] text-muted-foreground uppercase font-bold leading-none mb-0.5">Simulation Year</span>
             <span className="text-[11px] font-bold leading-none tracking-tight">{world.gameYear}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => setWorld(w => w ? {...w, isPaused: !w.isPaused} : null)}>
            {world.isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={initWorld}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-black/10 mx-1" />
          <Button 
            size="icon" 
            variant={rightSidebarOpen ? "default" : "ghost"} 
            className="h-8 w-8 rounded-none" 
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside 
          className={cn(
            "border-r border-black/10 bg-white z-40 transition-all duration-300 flex flex-col shrink-0",
            leftSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
          )}
        >
          <div className="p-4 border-b border-black/5 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-widest">Control Console</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => setLeftSidebarOpen(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              <Button 
                variant={mode.startsWith('battle') ? "default" : "outline"} 
                className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode.startsWith('battle') && "bg-black text-white")}
                onClick={() => { setMode('battle-menu'); setSelection([]); }}
              >
                <Swords className="h-4 w-4" /> Local Conflict
              </Button>
              <Button 
                variant={mode.startsWith('war') ? "default" : "outline"} 
                className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode.startsWith('war') && "bg-black text-white")}
                onClick={() => { setMode('war-menu'); setSelection([]); }}
              >
                <Shield className="h-4 w-4" /> Diplomatic War
              </Button>
              <Button 
                variant={mode.startsWith('merge') ? "default" : "outline"} 
                className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode.startsWith('merge') && "bg-black text-white")}
                onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}
              >
                <Combine className="h-4 w-4" /> Territorial Union
              </Button>
              <Button 
                variant={mode.startsWith('split') ? "default" : "outline"} 
                className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode.startsWith('split') && "bg-black text-white")}
                onClick={() => { setMode('split-menu'); setSelection([]); setSplitParts(2); setSplitNames(["", ""]); }}
              >
                <Scissors className="h-4 w-4" /> State Partition
              </Button>
            </div>

            <div className="px-2 pb-4">
              {mode !== 'none' && (
                <Card className="rounded-none border-black/10 bg-black/[0.01] shadow-none">
                  <CardHeader className="p-3 border-b border-black/5">
                    <CardTitle className="text-[9px] uppercase font-bold flex items-center justify-between">
                      {mode.split('-')[0]} Settings
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setMode('none')}><X className="h-2 w-2" /></Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-4">
                    {mode.startsWith('battle') && (
                      <div className="space-y-4">
                         <div className="space-y-1.5">
                           <label className="text-[7px] font-bold uppercase text-muted-foreground">War Mode</label>
                           <Tabs value={battleMode} onValueChange={(val) => setBattleMode(val as BattleMode)}>
                             <TabsList className="grid grid-cols-3 h-8 p-1 rounded-none bg-black/5">
                               <TabsTrigger value="attacker" className="text-[8px] uppercase font-bold rounded-none">Attack</TabsTrigger>
                               <TabsTrigger value="defender" className="text-[8px] uppercase font-bold rounded-none">Defend</TabsTrigger>
                               <TabsTrigger value="mutual" className="text-[8px] uppercase font-bold rounded-none">Mutual</TabsTrigger>
                             </TabsList>
                           </Tabs>
                         </div>
                         <div className="space-y-1">
                           {selection.map(id => (
                             <div key={id} className="text-[8px] font-bold uppercase truncate border-l-2 border-black pl-2 py-1 bg-white">
                               {world.countries.find(c => c.id === id)?.name}
                             </div>
                           ))}
                           {selection.length === 0 && <p className="text-[8px] text-muted-foreground uppercase italic text-center py-2">Select 2 nations on map</p>}
                         </div>
                         <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length !== 2} onClick={startBattle}>
                           EXECUTE PROTOCOL
                         </Button>
                      </div>
                    )}

                    {mode.startsWith('merge') && (
                      <div className="space-y-3">
                         <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                           {selection.map(id => (
                             <div key={id} className="text-[8px] font-bold uppercase truncate border-l-2 border-black pl-2 py-1 bg-white">
                               {world.countries.find(c => c.id === id)?.name}
                             </div>
                           ))}
                           {selection.length === 0 && <p className="text-[8px] text-muted-foreground uppercase italic text-center py-2">Select nations on map</p>}
                         </div>
                         {selection.length >= 2 && (
                           <div className="space-y-1.5">
                             <label className="text-[7px] font-bold uppercase text-muted-foreground">Union Identity</label>
                             <Input 
                               placeholder="e.g. United Federation"
                               className="h-8 text-[10px] rounded-none border-black/20 focus-visible:ring-black px-2 bg-white"
                               value={mergeName}
                               onChange={(e) => setMergeName(e.target.value)}
                             />
                             <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none mt-2" disabled={selection.length < 2 || !mergeName.trim()} onClick={handleMerge}>
                               PROCLAIM UNION
                             </Button>
                           </div>
                         )}
                      </div>
                    )}

                    {mode.startsWith('split') && (
                      <div className="space-y-3">
                        {selection.length === 1 ? (
                          <div className="space-y-3">
                            <div className="text-[9px] font-bold uppercase truncate border-l-2 border-black pl-2 py-1 bg-white">
                              {world.countries.find(c => c.id === selection[0])?.name}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[8px] font-bold uppercase text-muted-foreground">
                                <span>Successors</span>
                                <span className="text-black text-[10px]">{splitParts}</span>
                              </div>
                              <Slider value={[splitParts]} onValueChange={(val) => setSplitParts(val[0])} min={2} max={6} step={1} className="py-1" />
                            </div>
                            <div className="space-y-2">
                              {Array.from({ length: splitParts }).map((_, i) => (
                                <Input key={i} placeholder={`Successor ${i + 1}`} className="h-7 text-[10px] rounded-none border-black/15 bg-white px-2" value={splitNames[i] || ""} onChange={(e) => {
                                  const next = [...splitNames];
                                  next[i] = e.target.value;
                                  setSplitNames(next);
                                }} />
                              ))}
                            </div>
                            <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={loading || splitNames.some(n => !n.trim())} onClick={handleSplit}>
                              PARTITION
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[8px] text-muted-foreground uppercase italic text-center py-2">Select 1 nation on map</p>
                        )}
                      </div>
                    )}

                    {mode.startsWith('war') && (
                      <div className="space-y-3">
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {world.alliances.map(a => (
                            <div key={a.id} className="flex items-center gap-2 bg-white p-1.5 border border-black/5">
                              <div className="w-2 h-2" style={{ backgroundColor: a.color }} />
                              <span className="text-[8px] font-bold uppercase truncate">{a.name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 pt-2">
                          <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" onClick={() => setMode('war-select')}>
                            FORM NEW ALLIANCE
                          </Button>
                          {world.alliances.length >= 2 && (
                            <Button size="sm" variant="destructive" className="w-full text-[9px] uppercase font-bold rounded-none" onClick={executeWar}>
                              GLOBAL CONFLICT
                            </Button>
                          )}
                        </div>
                        {mode === 'war-select' && (
                          <div className="pt-2 border-t border-black/5">
                            <p className="text-[8px] font-bold uppercase mb-2">Selected: {selection.length}</p>
                            <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={selection.length < 2} onClick={confirmAlliance}>
                              CONFIRM BLOC
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </aside>

        {!leftSidebarOpen && !isMobile && (
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute left-4 top-4 z-40 h-8 w-8 rounded-none border-black/10 bg-white shadow-md"
            onClick={() => setLeftSidebarOpen(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <main className="flex-1 bg-[#E5F1F5] relative overflow-hidden flex items-center justify-center">
           <TacticalMap 
            countries={world.countries} 
            alliances={world.alliances}
            selection={selection}
            onSelectCountry={handleCountryClick}
          />

          {isMobile && (
            <div className="absolute bottom-0 left-0 right-0 p-2 z-40 bg-white/90 backdrop-blur-md border-t border-black/10 flex flex-col gap-2">
               {isModeActive && (
                 <div className="max-h-[35vh] overflow-y-auto no-scrollbar border-b border-black/5 pb-2 px-1">
                   {mode.startsWith('battle') && (
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1.5">
                           <label className="text-[8px] font-bold uppercase text-muted-foreground block text-center">War Mode</label>
                           <Tabs value={battleMode} onValueChange={(val) => setBattleMode(val as BattleMode)}>
                             <TabsList className="grid grid-cols-3 h-9 p-1 rounded-none bg-black/5">
                               <TabsTrigger value="attacker" className="text-[9px] uppercase font-bold rounded-none">Attack</TabsTrigger>
                               <TabsTrigger value="defender" className="text-[9px] uppercase font-bold rounded-none">Defend</TabsTrigger>
                               <TabsTrigger value="mutual" className="text-[9px] uppercase font-bold rounded-none">Mutual</TabsTrigger>
                             </TabsList>
                           </Tabs>
                         </div>
                        <p className="text-[8px] font-bold uppercase tracking-tight text-center">Tap 2 nations on map</p>
                        <div className="flex gap-1 justify-center flex-wrap">
                          {selection.map(id => (
                            <Badge key={id} variant="outline" className="text-[7px] uppercase font-bold rounded-none px-2 py-0.5">
                              {world.countries.find(c => c.id === id)?.name}
                            </Badge>
                          ))}
                        </div>
                        <Button size="sm" className="h-10 text-[9px] font-bold uppercase bg-black text-white" disabled={selection.length !== 2} onClick={startBattle}>
                          Execute {battleMode} Protocol
                        </Button>
                      </div>
                   )}
                   {mode.startsWith('merge') && (
                      <div className="flex flex-col gap-2">
                        <Input 
                          placeholder="Union Name..." 
                          className="h-9 text-[10px] rounded-none border-black/15 bg-white px-2"
                          value={mergeName}
                          onChange={(e) => setMergeName(e.target.value)}
                        />
                        <Button size="sm" className="h-9 text-[9px] font-bold uppercase bg-black text-white" disabled={selection.length < 2 || !mergeName.trim()} onClick={handleMerge}>
                          Unify {selection.length} States
                        </Button>
                      </div>
                   )}
                   {mode.startsWith('split') && selection.length === 1 && (
                     <div className="space-y-2">
                       <Slider value={[splitParts]} onValueChange={(val) => setSplitParts(val[0])} min={2} max={6} step={1} />
                       <Button size="sm" className="w-full h-9 text-[9px] font-bold uppercase bg-black text-white" disabled={splitNames.some(n => !n.trim())} onClick={handleSplit}>
                         Partition into {splitParts}
                       </Button>
                     </div>
                   )}
                   {mode.startsWith('war') && (
                      <div className="flex flex-col gap-1">
                        <Button size="sm" className="h-8 text-[9px] font-bold uppercase bg-black text-white" onClick={() => setMode('war-select')}>New Alliance</Button>
                        <Button size="sm" variant="destructive" className="h-8 text-[9px] font-bold uppercase" onClick={executeWar}>Global War</Button>
                      </div>
                   )}
                 </div>
               )}
               
               <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                 <Button variant="outline" className={cn("shrink-0 h-9 px-3 text-[9px] font-bold uppercase rounded-none", mode.startsWith('battle') && "bg-black text-white")} onClick={() => { setMode('battle-menu'); setSelection([]); }}><Swords className="h-3 w-3 mr-1.5" /> Battle</Button>
                 <Button variant="outline" className={cn("shrink-0 h-9 px-3 text-[9px] font-bold uppercase rounded-none", mode.startsWith('war') && "bg-black text-white")} onClick={() => { setMode('war-menu'); setSelection([]); }}><Shield className="h-3 w-3 mr-1.5" /> War</Button>
                 <Button variant="outline" className={cn("shrink-0 h-9 px-3 text-[9px] font-bold uppercase rounded-none", mode.startsWith('merge') && "bg-black text-white")} onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); }}><Combine className="h-3 w-3 mr-1.5" /> Merge</Button>
                 <Button variant="outline" className={cn("shrink-0 h-9 px-3 text-[9px] font-bold uppercase rounded-none", mode.startsWith('split') && "bg-black text-white")} onClick={() => { setMode('split-menu'); setSelection([]); }}><Scissors className="h-3 w-3 mr-1.5" /> Split</Button>
               </div>
            </div>
          )}
        </main>

        <aside 
          className={cn(
            "border-l border-black/10 bg-white z-40 transition-all duration-300 flex flex-col shrink-0 shadow-2xl md:shadow-none",
            rightSidebarOpen ? (isMobile ? "fixed inset-0 w-full" : "w-[360px]") : "w-0 overflow-hidden"
          )}
        >
          <div className="p-4 border-b border-black/5 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
            <div className="space-y-0.5">
              <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Global Atlas</h2>
              <p className="text-[7px] text-muted-foreground uppercase font-bold tracking-tight">Geopolitical Statistics</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => { setRightSidebarOpen(false); setEditingId(null); }} className="rounded-none h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="divide-y divide-black/[0.03]">
              {sortedCountries.map((c, idx) => {
                const isRecovering = c.stats.warReadiness < 80;
                const isExhausted = c.stats.warReadiness < 40;
                const isEditing = editingId === c.id;

                return (
                  <div key={c.id} className="p-4 space-y-4 hover:bg-black/[0.01] transition-colors group/row">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <span className="text-[9px] font-bold opacity-20 shrink-0">#{idx + 1}</span>
                        
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-5 h-5 shrink-0 border border-black/10 p-0 rounded-none overflow-hidden hover:opacity-80 shadow-inner"
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
                              <label className="text-[7px] font-bold uppercase text-muted-foreground block">Hex Code</label>
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
                            <h3 className="text-[12px] font-headline font-bold uppercase truncate max-w-[150px] tracking-tight">{c.name}</h3>
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
                        <div className="flex flex-col items-end">
                          <span className="text-[6px] uppercase font-bold text-muted-foreground">War Readiness</span>
                          <span className={cn(
                            "text-[10px] font-bold font-mono",
                            isExhausted ? "text-red-600" : isRecovering ? "text-orange-600" : "text-green-600"
                          )}>
                            {Math.round(c.stats.warReadiness)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 px-1">
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><TrendingUp className="h-2 w-2" /> Economy</span>
                        <p className="text-[11px] font-bold font-mono tracking-tighter">${c.stats.economy.toFixed(1)}B</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><Users className="h-2 w-2" /> Population</span>
                        <p className="text-[11px] font-bold font-mono tracking-tighter">{c.stats.population.toFixed(2)}M</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-1 px-1 border-t border-black/[0.02]">
                      <div className="flex-1 space-y-0.5">
                        <span className="text-[6px] text-muted-foreground uppercase font-bold block tracking-tighter">Ground</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.ground.toFixed(0)}</span>
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <span className="text-[6px] text-muted-foreground uppercase font-bold block tracking-tighter">Air</span>
                        <span className="text-[10px] font-bold font-mono">{c.stats.military.air.toFixed(0)}</span>
                      </div>
                      <div className="flex-1 space-y-0.5">
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
      </div>
    </div>
  );
}
