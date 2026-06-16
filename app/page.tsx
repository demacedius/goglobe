"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  Globe,
  Hotel,
  Utensils,
  Waves,
  Plane,
  MapPin,
  X,
} from "lucide-react";

const MOCK_DESTINATIONS = [
  { name: "Paris", country: "France", lat: 48.85, lng: 2.35 },
  { name: "Tokyo", country: "Japon", lat: 35.68, lng: 139.69 },
  { name: "New York", country: "États-Unis", lat: 40.71, lng: -74.0 },
  { name: "Bali", country: "Indonésie", lat: -8.34, lng: 115.09 },
];

const TABS = [
  { value: "hotels", label: "Hôtels", icon: Hotel },
  { value: "restaurants", label: "Restau", icon: Utensils },
  { value: "beaches", label: "Plages", icon: Waves },
  { value: "flights", label: "Vols", icon: Plane },
] as const;

export default function Home() {
  const [selectedDestination, setSelectedDestination] = useState<
    (typeof MOCK_DESTINATIONS)[0] | null
  >(null);
  const [search, setSearch] = useState("");

  const filtered = MOCK_DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      {/* Navbar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 border-b border-border/40 backdrop-blur-sm bg-background/60">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Go<span className="text-primary">Globe</span>
          </span>
        </div>

        {/* Search bar */}
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher une destination…"
            className="pl-9 bg-card border-border/60 focus:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="absolute top-full mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden z-30">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Aucune destination trouvée
                </p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.name}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      setSelectedDestination(d);
                      setSearch("");
                    }}
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {d.country}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            MVP
          </Badge>
          <Button variant="outline" size="sm">
            Se connecter
          </Button>
        </div>
      </header>

      {/* Globe placeholder — sera remplacé par la scène R3F */}
      <main className="flex-1 flex items-center justify-center pt-16">
        <div className="relative flex items-center justify-center">
          {/* Halo atmosphérique */}
          <div className="absolute h-[540px] w-[540px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute h-[420px] w-[420px] rounded-full border border-primary/10" />

          {/* Globe */}
          <div className="relative h-80 w-80 rounded-full bg-gradient-to-br from-slate-700 via-blue-900/80 to-slate-900 border border-white/10 shadow-2xl shadow-primary/10 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none">
            <Globe className="h-24 w-24 text-primary/50" />
            <p className="absolute bottom-10 text-[11px] text-muted-foreground/60">
              Globe 3D — bientôt disponible
            </p>
          </div>

          {/* Marqueurs de destination */}
          {MOCK_DESTINATIONS.map((d, i) => {
            const angles = [20, 75, 140, 225];
            const radii = [130, 158, 122, 148];
            const a = (angles[i] * Math.PI) / 180;
            const r = radii[i];
            return (
              <button
                key={d.name}
                className="absolute flex flex-col items-center gap-1 group"
                style={{
                  left: `calc(50% + ${Math.cos(a) * r}px)`,
                  top: `calc(50% + ${Math.sin(a) * r}px)`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => setSelectedDestination(d)}
              >
                <span className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/60 group-hover:scale-125 transition-transform ring-2 ring-primary/20" />
                <Badge
                  variant="secondary"
                  className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                >
                  {d.name}
                </Badge>
              </button>
            );
          })}
        </div>
      </main>

      {/* Destination Panel */}
      <Sheet
        open={!!selectedDestination}
        onOpenChange={(open) => !open && setSelectedDestination(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] bg-card border-l border-border/40 p-0 overflow-y-auto"
        >
          {selectedDestination && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-2xl font-bold">
                      {selectedDestination.name}
                    </SheetTitle>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {selectedDestination.country}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-1 -mr-2 shrink-0"
                    onClick={() => setSelectedDestination(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              <Separator className="opacity-40" />

              <div className="px-6 py-4">
                <Tabs defaultValue="hotels">
                  <TabsList className="w-full bg-muted/50 mb-4">
                    {TABS.map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="flex-1 gap-1.5 text-xs"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {TABS.map(({ value, label }) => (
                    <TabsContent key={value} value={value} className="mt-0 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border/40 bg-background/60 p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm group-hover:text-primary transition-colors">
                                {label} exemple {i}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Données disponibles prochainement
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 text-primary border-primary/40"
                            >
                              {value === "flights" ? "299€" : "★ 4.5"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      <Button className="w-full mt-2" variant="outline">
                        Voir plus
                      </Button>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
