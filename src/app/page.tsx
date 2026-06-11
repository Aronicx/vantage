"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  generateNewWorld, 
  processTick, 
  executeBattle, 
  createAlliance, 
  mergeCountries,
  renameCountry,
  updateCountryColor,
  splitCountry,
  disbandAlliance,
  POLITICAL_COLORS,
  GameState, 
  Country,
  BattleMode
} from './lib/game-logic';
import { TacticalMap } from '@/components/game/TacticalMap';
import { 
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
  Activity,
  Combine,
  Pencil,
  Check,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Shield,
  Handshake,
  Map as MapIcon,
  Hammer
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

type InteractionMode = 'none' | 'war-menu' | 'alliance-menu' | 'merge-menu' | 'split-menu';

export default function VantagePoint() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [world, setWorld] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('none');
  const [battleMode, setBattleMode] = useState<BattleMode>('attacker');
  
  // War Selection
  const [warSideA, setWarSideA] = useState<string[]>([]);
  const [warSideB, setWarSideB] = useState<string[]>([]);
  const [activeWarSide, setActiveWarSide] = useState<'A' | 'B'>('A');

  // Alliance Selection
  const [allianceSelection, setAllianceSelection] = useState<string[]>([]);

  // Other Selections
  const [selection, setSelection] = useState<string[]>([]);
  
  const [mergeName, setMergeName] = useState('');
  const [isNewUnion, setIsNewUnion] = useState(false);
  const [splitParts, setSplitParts] = useState(2);
  const [splitNames, setSplitNames] = useState<string[]>([]);
  const [splitDistributions, setSplitDistributions] = useState<number[]>([]);
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

  const initWorld = async () => {
    setLoading(true);
    const newWorld = await generateNewWorld(1000, 1000);
    setWorld(newWorld);
    setLoading(false);
  };

  const handleStart = () => {
    if (world) setWorld({ ...world, gameStarted: true, isPaused: false });
  };

  const getAllianceMembers = (countryId: string) => {
    if (!world) return [];
    const country = world.countries.find(c => c.id === countryId);
    if (!country?.allianceId) return [countryId];
    const alliance = world.alliances.find(a => a.id === country?.allianceId);
    return alliance?.countryIds || [countryId];
  };

  const handleCountryClick = (c: Country) => {
    if (mode === 'war-menu') {
      const members = getAllianceMembers(c.id);
      if (activeWarSide === 'A') {
        // Toggle Side A
        if (warSideA.includes(c.id)) {
          setWarSideA(warSideA.filter(id => !members.includes(id)));
        } else {
          // Remove from B if exists, then add to A
          setWarSideB(warSideB.filter(id => !members.includes(id)));
          setWarSideA(Array.from(new Set([...warSideA, ...members])));
        }
      } else {
        // Toggle Side B
        if (warSideB.includes(c.id)) {
          setWarSideB(warSideB.filter(id => !members.includes(id)));
        } else {
          // Remove from A if exists, then add to B
          setWarSideA(warSideA.filter(id => !members.includes(id)));
          setWarSideB(Array.from(new Set([...warSideB, ...members])));
        }
      }
    } 
    else if (mode === 'alliance-menu') {
      if (allianceSelection.includes(c.id)) {
        setAllianceSelection(allianceSelection.filter(id => id !== c.id));
      } else {
        if (c.allianceId) {
          toast({ variant: "destructive", title: "Access Denied", description: "Country is already member of another alliance." });
          return;
        }
        setAllianceSelection([...allianceSelection, c.id]);
      }
    }
    else if (mode === 'merge-menu') {
      if (selection.includes(c.id)) {
        setSelection(selection.filter(id => id !== c.id));
      } else {
        setSelection([...selection, c.id]);
      }
    } 
    else if (mode === 'split-menu') {
      if (selection.includes(c.id)) {
        setSelection([]);
      } else {
        setSelection([c.id]);
      }
    } 
    else {
      setRightSidebarOpen(true);
      setEditingId(null);
    }
  };

  const startWar = () => {
    if (warSideA.length === 0 || warSideB.length === 0 || !world) return;
    const { state, result } = executeBattle(world, warSideA, warSideB, battleMode);
    setWorld(state);
    toast({ title: "War Concluded", description: result });
    setWarSideA([]);
    setWarSideB([]);
    setMode('none');
  };

  const confirmAlliance = () => {
    if (allianceSelection.length < 2 || !world) return;
    const nextWorld = createAlliance(world, allianceSelection);
    setWorld(nextWorld);
    setAllianceSelection([]);
    toast({ title: "New Coalition", description: `Bloc established with ${allianceSelection.length} members.` });
  };

  const handleDisbandAlliance = (id: string) => {
    if (!world) return;
    const nextWorld = disbandAlliance(world, id);
    setWorld(nextWorld);
    toast({ title: "Alliance Dissolved", description: "All member countries are now independent." });
  };

  const handleMerge = (dominantId?: string) => {
    if (selection.length < 2 || !world) return;
    let finalName = mergeName.trim();
    if (!dominantId && !finalName) finalName = `Unified Federation`;
    const nextWorld = mergeCountries(world, selection, dominantId, finalName);
    setWorld(nextWorld);
    setSelection([]);
    setMergeName('');
    setIsNewUnion(false);
    setMode('none');
    const desc = dominantId ? `Merged into ${world.countries.find(c => c.id === dominantId)?.name}.` : `New nation ${finalName} established.`;
    toast({ title: "Union Proclaimed", description: desc });
  };

  const handleSplit = () => {
    if (selection.length !== 1 || !world) return;
    const nextWorld = splitCountry(world, selection[0], splitParts, splitNames, splitDistributions);
    setWorld(nextWorld);
    setSelection([]);
    setSplitNames([]);
    setSplitDistributions([]);
    setMode('none');
    toast({ title: "Nation Partitioned", description: `Territory divided into ${splitParts} connected regions.` });
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
    toast({ title: "Map Refined", description: "Color updated." });
  };

  const sortedCountries = useMemo(() => {
    if (!world) return [];
    return [...world.countries].sort((a,b) => b.points.length - a.points.length);
  }, [world?.countries]);

  const splitAllocationTotal = useMemo(() => {
    return splitDistributions.reduce((sum, val) => sum + val, 0);
  }, [splitDistributions]);

  const isSplitAllocationValid = Math.abs(splitAllocationTotal - 100) < 0.1;

  const renderModeSettings = () => {
    if (!world || mode === 'none') return null;

    return (
      <Card className="rounded-none border-black/10 bg-black/[0.01] shadow-none">
        <CardHeader className="p-3 border-b border-black/5">
          <CardTitle className="text-[9px] uppercase font-bold flex items-center justify-between">
            {mode === 'war-menu' ? 'WAR PROTOCOL' : mode === 'alliance-menu' ? 'ALLIANCE MANAGEMENT' : mode.split('-')[0].toUpperCase() + ' CONFIGURATION'}
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setMode('none')}><X className="h-2 w-2" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-4">
          {mode === 'war-menu' && (
            <div className="space-y-4">
               <div className="space-y-1.5">
                 <label className="text-[7px] font-bold uppercase text-muted-foreground">Strategic Posture</label>
                 <Tabs value={battleMode} onValueChange={(val) => setBattleMode(val as BattleMode)}>
                   <TabsList className="grid grid-cols-3 h-8 p-1 rounded-none bg-black/5">
                     <TabsTrigger value="attacker" className="text-[8px] uppercase font-bold rounded-none">Attack</TabsTrigger>
                     <TabsTrigger value="defender" className="text-[8px] uppercase font-bold rounded-none">Defend</TabsTrigger>
                     <TabsTrigger value="mutual" className="text-[8px] uppercase font-bold rounded-none">Mutual</TabsTrigger>
                   </TabsList>
                 </Tabs>
               </div>
               
               <div className="space-y-3">
                 <p className="text-[7px] font-bold uppercase text-muted-foreground">Opposition Teams</p>
                 <Tabs value={activeWarSide} onValueChange={(val) => setActiveWarSide(val as 'A' | 'B')}>
                   <TabsList className="grid grid-cols-2 h-8 p-1 rounded-none bg-black/5">
                     <TabsTrigger value="A" className={cn("text-[8px] uppercase font-bold rounded-none", warSideA.length > 0 && "text-blue-600")}>SIDE A ({warSideA.length})</TabsTrigger>
                     <TabsTrigger value="B" className={cn("text-[8px] uppercase font-bold rounded-none", warSideB.length > 0 && "text-red-600")}>SIDE B ({warSideB.length})</TabsTrigger>
                   </TabsList>
                 </Tabs>

                 <div className="space-y-2 max-h-40 overflow-y-auto">
                    <p className="text-[6px] uppercase font-bold text-muted-foreground text-center">Tap countries to add them and their allies</p>
                    <div className="flex flex-col gap-1">
                      {warSideA.length > 0 && (
                        <div className="p-2 bg-blue-50 border border-blue-100 space-y-1">
                          <p className="text-[7px] font-bold uppercase text-blue-700">Side A Forces</p>
                          <div className="flex flex-wrap gap-1">
                            {warSideA.map(id => <Badge key={id} variant="outline" className="text-[6px] py-0 px-1 rounded-none bg-white">{world.countries.find(x => x.id === id)?.name}</Badge>)}
                          </div>
                        </div>
                      )}
                      {warSideB.length > 0 && (
                        <div className="p-2 bg-red-50 border border-red-100 space-y-1">
                          <p className="text-[7px] font-bold uppercase text-red-700">Side B Forces</p>
                          <div className="flex flex-wrap gap-1">
                            {warSideB.map(id => <Badge key={id} variant="outline" className="text-[6px] py-0 px-1 rounded-none bg-white">{world.countries.find(x => x.id === id)?.name}</Badge>)}
                          </div>
                        </div>
                      )}
                    </div>
                 </div>
               </div>

               <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={warSideA.length === 0 || warSideB.length === 0} onClick={startWar}>
                 COMMENCE HOSTILITIES
               </Button>
            </div>
          )}

          {mode === 'alliance-menu' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[7px] uppercase font-bold text-muted-foreground">Existing Blocs</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {world.alliances.map(a => (
                    <div key={a.id} className="flex flex-col bg-white border border-black/10">
                      <div className="flex items-center justify-between p-1.5 border-b border-black/5 bg-black/[0.02]">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-2 h-2 shrink-0" style={{ backgroundColor: a.color }} />
                          <span className="text-[8px] font-bold uppercase truncate">{a.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-4 w-4 text-red-600" onClick={() => handleDisbandAlliance(a.id)}><X className="h-2.5 w-2.5" /></Button>
                      </div>
                      <div className="p-1 flex flex-wrap gap-1">
                        {a.countryIds.map(cid => (
                          <Badge key={cid} variant="outline" className="text-[6px] px-1 py-0 rounded-none border-black/10">{world.countries.find(c => c.id === cid)?.name}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {world.alliances.length === 0 && <p className="text-[8px] italic text-muted-foreground text-center py-4">No active alliances found.</p>}
                </div>
              </div>
              
              <div className="pt-2 border-t border-black/5 space-y-2">
                <p className="text-[7px] font-bold uppercase text-muted-foreground">Form New Alliance</p>
                <div className="bg-white border border-black/10 p-2 min-h-[40px] flex flex-wrap gap-1">
                  {allianceSelection.map(id => (
                    <Badge key={id} variant="default" className="text-[7px] px-1.5 py-0.5 rounded-none bg-black text-white">
                      {world.countries.find(c => c.id === id)?.name}
                      <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => setAllianceSelection(prev => prev.filter(x => x !== id))} />
                    </Badge>
                  ))}
                  {allianceSelection.length === 0 && <span className="text-[7px] text-muted-foreground italic uppercase">Tap countries on map</span>}
                </div>
                <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={allianceSelection.length < 2} onClick={confirmAlliance}>ESTABLISH BLOC</Button>
              </div>
            </div>
          )}

          {mode === 'merge-menu' && (
            <div className="space-y-3">
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                  <p className="text-[7px] font-bold uppercase text-muted-foreground">Union Participants</p>
                  <span className="text-[7px] font-bold bg-black/5 px-1">{selection.length}</span>
                 </div>
                 <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                   {selection.map(id => {
                     const c = world.countries.find(x => x.id === id);
                     if (!c) return null;
                     return (
                       <div key={id} className="group flex items-center justify-between p-1.5 border border-black/10 bg-white">
                         <div className="flex items-center gap-2 overflow-hidden">
                           <div className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: c.color }} />
                           <span className="text-[8px] font-bold uppercase truncate">{c.name}</span>
                         </div>
                         {selection.length === 2 && !isNewUnion && (
                           <Button size="sm" variant="outline" className="h-5 px-1.5 text-[6px] uppercase font-bold rounded-none hover:bg-black hover:text-white" onClick={() => handleMerge(id)}>
                             Absorb into this
                           </Button>
                         )}
                       </div>
                     );
                   })}
                   {selection.length === 0 && <p className="text-[8px] text-muted-foreground uppercase italic text-center py-2">Select nations on map</p>}
                 </div>
               </div>
               {selection.length >= 2 && (
                 <div className="space-y-3 pt-2 border-t border-black/5">
                   {selection.length === 2 ? (
                     <div className="flex items-center justify-between">
                       <label className="text-[7px] font-bold uppercase text-muted-foreground">Protocol</label>
                       <Button variant="ghost" className={cn("h-5 px-1.5 text-[7px] uppercase font-bold rounded-none border", isNewUnion ? "bg-black text-white" : "bg-white")} onClick={() => setIsNewUnion(!isNewUnion)}>
                         {isNewUnion ? "NEW NATION" : "SWITCH TO NEW NATION"}
                       </Button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 border border-blue-100">
                       <Info className="h-3 w-3 shrink-0" />
                       <p className="text-[7px] font-bold uppercase leading-tight">Multilateral mergers automatically create a new nation.</p>
                     </div>
                   )}
                   {(isNewUnion || selection.length > 2) && (
                     <div className="space-y-1.5">
                       <label className="text-[7px] font-bold uppercase text-muted-foreground">Union Name</label>
                       <Input placeholder="e.g. United Federation" className="h-8 text-[10px] rounded-none border-black/20 focus-visible:ring-black px-2 bg-white" value={mergeName} onChange={(e) => setMergeName(e.target.value)} />
                       <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none mt-2" disabled={!mergeName.trim()} onClick={() => handleMerge()}>PROCLAIM UNION</Button>
                     </div>
                   )}
                 </div>
               )}
            </div>
          )}

          {mode === 'split-menu' && (
            <div className="space-y-3">
              {selection.length === 1 ? (
                <div className="space-y-4">
                  <div className="text-[9px] font-bold uppercase truncate border-l-2 border-black pl-2 py-1 bg-white">
                    {world.countries.find(c => c.id === selection[0])?.name}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[8px] font-bold uppercase text-muted-foreground">
                      <span>Splinters</span>
                      <span className="text-black text-[10px]">{splitParts}</span>
                    </div>
                    <Slider value={[splitParts]} onValueChange={(val) => setSplitParts(val[0])} min={2} max={5} step={1} className="py-1" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[7px] font-bold uppercase text-muted-foreground border-b border-black/5 pb-1">Allocation Details</p>
                    {Array.from({ length: splitParts }).map((_, i) => (
                      <div key={i} className="space-y-1.5 p-2 bg-black/[0.02] border border-black/[0.05]">
                        <div className="flex gap-2">
                          <Input placeholder={`Splinter ${i + 1} Name`} className="h-7 text-[9px] rounded-none border-black/15 bg-white px-2 flex-1" value={splitNames[i] || ""} onChange={(e) => {
                            const next = [...splitNames];
                            next[i] = e.target.value;
                            setSplitNames(next);
                          }} />
                          <div className="w-16 flex items-center gap-1 bg-white border border-black/15 px-1.5">
                            <Input type="number" className="h-6 text-[9px] p-0 border-0 focus-visible:ring-0 text-right font-mono" value={splitDistributions[i] || 0} onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const next = [...splitDistributions];
                                next[i] = Math.min(100, Math.max(0, val));
                                setSplitDistributions(next);
                              }} />
                            <span className="text-[8px] font-mono">%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[7px] font-bold uppercase text-muted-foreground">Total (must be 100%)</span>
                      <span className={cn("text-[10px] font-bold font-mono", !isSplitAllocationValid ? "text-red-500" : "text-green-600")}>{splitAllocationTotal}%</span>
                    </div>
                  </div>
                  <Button size="sm" className="w-full text-[9px] uppercase font-bold bg-black text-white rounded-none" disabled={loading || splitNames.some(n => !n.trim()) || !isSplitAllocationValid} onClick={handleSplit}>DIVIDE NATION</Button>
                </div>
              ) : (
                <p className="text-[8px] text-muted-foreground uppercase italic text-center py-2">Select a single nation on map</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!world || !world.gameStarted) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-black gap-8 p-4 text-center">
        <div className="space-y-4">
          <Globe className="h-16 w-16 md:h-24 md:w-24 text-black mx-auto mb-4" />
          <h1 className="text-4xl md:text-6xl font-headline font-bold tracking-tighter">VANTAGE POINT</h1>
          <p className="text-muted-foreground uppercase tracking-[0.4em] text-[10px] md:text-xs">Political Sandbox Simulation</p>
        </div>
        <Button size="lg" className="px-10 py-6 md:px-16 md:py-8 text-lg md:text-xl font-headline bg-black text-white hover:bg-black/80 rounded-none transition-all w-full md:w-auto" onClick={handleStart} disabled={loading}>
          {loading ? "INITIALIZING ATLAS..." : "START SIMULATION"}
        </Button>
      </div>
    );
  }

  const tacticalMapSelection = mode === 'war-menu' ? [...warSideA, ...warSideB] : mode === 'alliance-menu' ? allianceSelection : selection;

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
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={initWorld}><RotateCcw className="h-3.5 w-3.5" /></Button>
          {!isMobile && (
            <>
              <div className="h-4 w-px bg-black/10 mx-1" />
              <Button size="icon" variant={rightSidebarOpen ? "default" : "ghost"} className="h-8 w-8 rounded-none" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}><ListOrdered className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {!isMobile && (
          <aside className={cn("border-r border-black/10 bg-white z-40 transition-all duration-300 flex flex-col shrink-0", leftSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden")}>
            <div className="p-4 border-b border-black/5 flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest">Global Operations</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => setLeftSidebarOpen(false)}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                <Button variant={mode === 'war-menu' ? "default" : "outline"} className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode === 'war-menu' && "bg-black text-white")} onClick={() => { setMode('war-menu'); setWarSideA([]); setWarSideB([]); }}>
                  <Swords className="h-4 w-4" /> Start War
                </Button>
                <Button variant={mode === 'alliance-menu' ? "default" : "outline"} className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode === 'alliance-menu' && "bg-black text-white")} onClick={() => { setMode('alliance-menu'); setAllianceSelection([]); }}>
                  <Shield className="h-4 w-4" /> Diplomatic Alliance
                </Button>
                <div className="h-px bg-black/5 my-2" />
                <Button variant={mode === 'merge-menu' ? "default" : "outline"} className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode === 'merge-menu' && "bg-black text-white")} onClick={() => { setMode('merge-menu'); setSelection([]); setMergeName(''); setIsNewUnion(false); }}>
                  <Combine className="h-4 w-4" /> Territorial Union
                </Button>
                <Button variant={mode === 'split-menu' ? "default" : "outline"} className={cn("w-full justify-start gap-3 h-11 text-[10px] uppercase font-bold rounded-none px-4", mode === 'split-menu' && "bg-black text-white")} onClick={() => { setMode('split-menu'); setSelection([]); setSplitParts(2); }}>
                  <Scissors className="h-4 w-4" /> Advance Partition
                </Button>
              </div>
              <div className="px-2 pb-4">{renderModeSettings()}</div>
            </ScrollArea>
          </aside>
        )}

        {!leftSidebarOpen && !isMobile && (
          <Button variant="outline" size="icon" className="absolute left-4 top-4 z-40 h-8 w-8 rounded-none border-black/10 bg-white shadow-md" onClick={() => setLeftSidebarOpen(true)}><ChevronRight className="h-4 w-4" /></Button>
        )}

        {isMobile && mode !== 'none' && !rightSidebarOpen && (
          <div className="fixed top-14 left-4 right-4 z-[45] animate-in slide-in-from-top-4 duration-300">
            <div className="max-h-[60vh] overflow-y-auto shadow-2xl bg-white border border-black/20">{renderModeSettings()}</div>
          </div>
        )}

        <main className={cn("flex-1 bg-[#E5F1F5] relative overflow-hidden flex items-center justify-center transition-all", isMobile && "pb-16")}>
           <TacticalMap countries={world.countries} alliances={world.alliances} selection={tacticalMapSelection} onSelectCountry={handleCountryClick} />
        </main>

        <aside className={cn("border-l border-black/10 bg-white z-[60] transition-all duration-300 flex flex-col shrink-0 shadow-2xl md:shadow-none", rightSidebarOpen ? (isMobile ? "fixed inset-0 w-full" : "w-[360px]") : "w-0 overflow-hidden")}>
          <div className="p-4 border-b border-black/5 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
            <div className="space-y-0.5">
              <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Global Atlas</h2>
              <p className="text-[7px] text-muted-foreground uppercase font-bold tracking-tight">Geopolitical Rankings</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => { setRightSidebarOpen(false); setEditingId(null); }} className="rounded-none h-8 w-8"><X className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1 bg-white">
            <div className="divide-y divide-black/[0.03]">
              {sortedCountries.map((c, idx) => {
                const isRecovering = c.recoveryEndYear && world.gameYear < c.recoveryEndYear;
                const isExhausted = c.stats.warReadiness < 40;
                const isEditing = editingId === c.id;
                const currentAlliance = world.alliances.find(a => a.id === c.allianceId);
                const isReconstructing = c.settlements.some(s => s.stats.warReadiness < 100);
                const baseGrowth = c.stats.growthRate - 1;
                const penaltyFactor = isRecovering ? (c.points.length < 150 ? 15 : 6) : 1;
                const displayGrowth = (baseGrowth / penaltyFactor) * 100;
                return (
                  <div key={c.id} className="p-4 space-y-4 hover:bg-black/[0.01] transition-colors group/row">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <span className="text-[11px] font-bold text-black bg-black/5 w-6 h-6 flex items-center justify-center shrink-0">#{idx + 1}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="w-5 h-5 shrink-0 border border-black/10 p-0 rounded-none overflow-hidden hover:opacity-80 shadow-inner" style={{ backgroundColor: c.color }} />
                          </PopoverTrigger>
                          <PopoverContent className="w-[180px] p-2 rounded-none border-black/10 shadow-xl bg-white" side="left">
                            <div className="grid grid-cols-5 gap-1 mb-2">
                              {POLITICAL_COLORS.map(pc => (
                                <button key={pc} className={cn("w-6 h-6 border border-black/5 transition-transform hover:scale-110", c.color === pc && "ring-1 ring-black ring-offset-1")} style={{ backgroundColor: pc }} onClick={() => handleColorChange(c.id, pc)} />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input autoFocus className="h-7 text-[10px] font-bold uppercase rounded-none border-black/20 focus-visible:ring-black bg-white px-2" value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') setEditingId(null);
                              }} />
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none shrink-0" onClick={handleSaveRename}><Check className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 group/name">
                              <h3 className="text-[12px] font-headline font-bold uppercase truncate max-w-[150px] tracking-tight">{c.name}</h3>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-40 md:opacity-0 md:group-hover/name:opacity-100 transition-opacity rounded-none" onClick={() => { setEditingId(c.id); setEditingName(c.name); }}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {currentAlliance && (
                                <span className="text-[8px] font-bold uppercase text-muted-foreground bg-black/[0.03] px-1.5 py-0.5 border border-black/5 flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5" style={{ backgroundColor: currentAlliance.color }} />
                                  {currentAlliance.name}
                                </span>
                              )}
                              {isReconstructing && (
                                <Badge variant="outline" className="text-[6px] uppercase font-bold px-1.5 py-0 rounded-none border-blue-200 bg-blue-50 text-blue-700">
                                  <Hammer className="h-2 w-2 mr-1" /> Reconstructing
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[6px] uppercase font-bold text-muted-foreground">Readiness</span>
                        <span className={cn("text-[10px] font-bold font-mono", isExhausted ? "text-red-600" : isRecovering ? "text-orange-600" : "text-green-600")}>{Math.round(c.stats.warReadiness)}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-1">
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><MapIcon className="h-2 w-2" /> Territory</span>
                        <p className="text-[10px] font-bold font-mono tracking-tighter">{c.points.length}km²</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><TrendingUp className="h-2 w-2" /> Economy</span>
                        <p className="text-[10px] font-bold font-mono tracking-tighter">${c.stats.economy.toFixed(1)}B</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><Users className="h-2 w-2" /> Pop.</span>
                        <p className="text-[10px] font-bold font-mono tracking-tighter">{c.stats.population.toFixed(2)}M</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] text-muted-foreground uppercase font-bold flex items-center gap-1 tracking-tighter"><Activity className="h-2 w-2" /> Growth</span>
                        <p className={cn("text-[10px] font-bold font-mono tracking-tighter", isRecovering ? "text-orange-600" : "text-green-600")}>+{displayGrowth.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-black/10 flex items-center justify-around z-50 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", mode === 'none' && !rightSidebarOpen && "bg-black/5 text-black")} onClick={() => { setMode('none'); setRightSidebarOpen(false); }}>
              <Globe className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Map</span>
            </Button>
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", mode === 'war-menu' && "bg-black/5 text-black")} onClick={() => { setMode('war-menu'); setRightSidebarOpen(false); setWarSideA([]); setWarSideB([]); }}>
              <Swords className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">War</span>
            </Button>
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", mode === 'alliance-menu' && "bg-black/5 text-black")} onClick={() => { setMode('alliance-menu'); setRightSidebarOpen(false); setAllianceSelection([]); }}>
              <Handshake className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Alliance</span>
            </Button>
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", mode === 'merge-menu' && "bg-black/5 text-black")} onClick={() => { setMode('merge-menu'); setRightSidebarOpen(false); }}>
              <Combine className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Union</span>
            </Button>
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", mode === 'split-menu' && "bg-black/5 text-black")} onClick={() => { setMode('split-menu'); setRightSidebarOpen(false); }}>
              <Scissors className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Split</span>
            </Button>
            <Button variant="ghost" className={cn("flex flex-col items-center gap-1 h-full py-2 flex-1 rounded-none", rightSidebarOpen && "bg-black/5 text-black")} onClick={() => { setRightSidebarOpen(true); }}>
              <ListOrdered className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Atlas</span>
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
