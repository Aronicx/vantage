"use client";

import React, { useState, useEffect } from 'react';
import { generateNewWorld, GameState, Country, Settlement } from './lib/game-logic';
import { TacticalMap } from '@/components/game/TacticalMap';
import { HeraldryIcon } from '@/components/game/HeraldryIcon';
import { 
  Shield, 
  Map as MapIcon, 
  Activity, 
  ChevronRight, 
  Layers, 
  Crosshair, 
  Zap,
  RotateCcw,
  Globe,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VantagePoint() {
  const [world, setWorld] = useState<GameState | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<{s: Settlement, c: Country} | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState({
    borders: true,
    military: false,
    economic: false
  });

  useEffect(() => {
    initNewGame();
  }, []);

  const initNewGame = async () => {
    setLoading(true);
    const newWorld = await generateNewWorld(1000, 1000);
    setWorld(newWorld);
    setLoading(false);
    setSelectedCountry(null);
    setSelectedSettlement(null);
  };

  const toggleOverlay = (key: keyof typeof overlays) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
    <div className="h-screen w-screen relative overflow-hidden flex font-body">
      {/* Main Map UI */}
      <main className="flex-1 relative">
        {world && (
          <TacticalMap 
            countries={world.countries} 
            activeOverlays={overlays}
            onSelectCountry={(c) => {
              setSelectedCountry(c);
              setSelectedSettlement(null);
            }}
            onSelectSettlement={(s, c) => {
              setSelectedSettlement({s, c});
              setSelectedCountry(c);
            }}
          />
        )}

        {/* Floating Top Left Controls */}
        <div className="absolute top-6 left-6 flex flex-col gap-3">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg flex flex-col gap-1">
            <Button 
              size="icon" 
              variant={overlays.borders ? "default" : "ghost"} 
              className={overlays.borders ? "bg-accent text-background" : "text-white"}
              onClick={() => toggleOverlay('borders')}
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant={overlays.military ? "default" : "ghost"} 
              className={overlays.military ? "bg-accent text-background" : "text-white"}
              onClick={() => toggleOverlay('military')}
            >
              <Shield className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant={overlays.economic ? "default" : "ghost"} 
              className={overlays.economic ? "bg-accent text-background" : "text-white"}
              onClick={() => toggleOverlay('economic')}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="bg-black/40 backdrop-blur-md border border-white/10 text-white hover:text-accent"
            onClick={initNewGame}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend / Overlay Status */}
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
            {overlays.military && (
              <div className="flex items-center gap-3 text-xs text-accent animate-pulse">
                <Shield className="h-3 w-3" />
                <span>Active Military Reach</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Context Sidebar */}
      <aside className="w-[400px] h-full bg-card border-l border-white/10 flex flex-col z-10 shadow-2xl overflow-hidden">
        {selectedCountry ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-start justify-between mb-4">
                <HeraldryIcon 
                  colors={selectedCountry.flagColors} 
                  pattern={selectedCountry.flagPattern} 
                  className="w-16 h-10 rounded border border-white/20 shadow-lg"
                />
                <Badge variant="outline" className="text-[10px] border-accent/30 text-accent font-code">
                  ID: {selectedCountry.id.toUpperCase()}
                </Badge>
              </div>
              <h2 className="text-2xl font-headline font-bold text-white mb-1 uppercase tracking-tight">
                {selectedCountry.name}
              </h2>
              <p className="text-xs text-muted-foreground font-code flex items-center gap-2">
                <Crosshair className="h-3 w-3 text-accent" />
                SOVEREIGN STATE INTACT
              </p>
            </div>

            <ScrollArea className="flex-1 p-6">
              <Tabs defaultValue="intel" className="w-full">
                <TabsList className="w-full bg-secondary/50 border border-white/5 mb-6">
                  <TabsTrigger value="intel" className="flex-1 text-xs">INTELLIGENCE</TabsTrigger>
                  <TabsTrigger value="diplomacy" className="flex-1 text-xs">DIPLOMACY</TabsTrigger>
                  <TabsTrigger value="strategic" className="flex-1 text-xs">STRATEGIC</TabsTrigger>
                </TabsList>

                <TabsContent value="intel" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-accent">
                      <Zap className="h-4 w-4" />
                      <h3 className="text-sm font-headline uppercase tracking-wider">Historical Narrative</h3>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed font-body italic">
                      {selectedCountry.lore?.historicalNarrative || "Classified historical data processing..."}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-accent">
                      <MapIcon className="h-4 w-4" />
                      <h3 className="text-sm font-headline uppercase tracking-wider">Demographics</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-3 rounded-md border border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase block mb-1">Settlements</span>
                        <span className="text-lg text-white font-headline">{selectedCountry.settlements.length}</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-md border border-white/5">
                        <span className="text-[10px] text-muted-foreground uppercase block mb-1">Influence Area</span>
                        <span className="text-lg text-white font-headline">{selectedCountry.points.length * 40}km²</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="diplomacy" className="space-y-4">
                  {selectedCountry.lore?.diplomaticRelationships.map((rel, idx) => (
                    <div key={idx} className="bg-secondary/30 border border-white/5 p-4 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-headline text-white">{rel.targetCountryName}</span>
                        <Badge variant={rel.type === 'ally' ? 'default' : rel.type === 'enemy' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                          {rel.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">{rel.description}</p>
                    </div>
                  ))}
                  {!selectedCountry.lore?.diplomaticRelationships.length && (
                    <div className="text-center py-10">
                      <Info className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No active diplomatic records found.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="strategic" className="space-y-4">
                  <div className="space-y-2">
                    {selectedCountry.settlements.map(s => (
                      <div 
                        key={s.id} 
                        className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all border ${
                          selectedSettlement?.s.id === s.id 
                            ? 'bg-accent/10 border-accent/50 text-accent' 
                            : 'bg-white/5 border-transparent text-white/70 hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedSettlement({s, c: selectedCountry})}
                      >
                        {s.type === 'capital' ? <Building2 className="h-4 w-4" /> : s.type === 'city' ? <MapIcon className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                        <div className="flex-1">
                          <p className="text-xs font-headline uppercase">{s.name}</p>
                          <p className="text-[10px] opacity-60 uppercase">{s.type}</p>
                        </div>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="h-20 w-20 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/20">
              <Crosshair className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-headline text-white uppercase tracking-widest">Awaiting Command</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Select a territory or tactical settlement on the map to begin intelligence analysis.
              </p>
            </div>
          </div>
        )}

        {/* Global Footer Overlay Information */}
        <div className="p-4 bg-background/80 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-code">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> SYSTEM ONLINE</span>
            <span>WORLD_ID: VP_ALPHA_74</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3" />
            <span>VANTAGE POINT COMMAND</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
