"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X, ExternalLink, Star } from "lucide-react";
import { Globe3D } from "@/components/globe-3d";
interface HotelResult {
  hotelId: string;
  name: string;
  rating: number;
  address?: string;
  website?: string;
  mapsUrl: string;
  bookingUrl: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "hotels" | "restaurants" | "beaches" | "flights";

interface PlaceItem {
  name: string;
  badge: string;
}

interface Destination {
  name: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  cityCode: string; // Amadeus IATA city code
  restaurants: PlaceItem[];
  beaches: PlaceItem[];
  flights: PlaceItem[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DESTINATIONS: Destination[] = [
  {
    name: "Paris",
    country: "France",
    flag: "🇫🇷",
    lat: 48.85,
    lon: 2.35,
    cityCode: "PAR",
    restaurants: [
      { name: "Guy Savoy", badge: "★ 4.9" },
      { name: "Le Jules Verne", badge: "★ 4.8" },
      { name: "L'Ambroisie", badge: "★ 4.8" },
    ],
    beaches: [
      { name: "Plage du Touquet", badge: "★ 4.5" },
      { name: "Plage de Deauville", badge: "★ 4.4" },
      { name: "Falaise d'Étretat", badge: "★ 4.6" },
    ],
    flights: [
      { name: "Air France CDG", badge: "89€" },
      { name: "EasyJet ORY", badge: "65€" },
      { name: "Transavia", badge: "72€" },
    ],
  },
  {
    name: "Tokyo",
    country: "Japon",
    flag: "🇯🇵",
    lat: 35.68,
    lon: 139.69,
    cityCode: "TYO",
    restaurants: [
      { name: "Sukiyabashi Jiro", badge: "★ 5.0" },
      { name: "Narisawa", badge: "★ 4.9" },
      { name: "Quintessence", badge: "★ 4.8" },
    ],
    beaches: [
      { name: "Shonan Beach", badge: "★ 4.3" },
      { name: "Enoshima", badge: "★ 4.5" },
      { name: "Kamakura Beach", badge: "★ 4.4" },
    ],
    flights: [
      { name: "Air France CDG → HND", badge: "899€" },
      { name: "Japan Airlines", badge: "850€" },
      { name: "ANA", badge: "820€" },
    ],
  },
  {
    name: "New York",
    country: "États-Unis",
    flag: "🇺🇸",
    lat: 40.71,
    lon: -74.0,
    cityCode: "NYC",
    restaurants: [
      { name: "Le Bernardin", badge: "★ 4.9" },
      { name: "Daniel", badge: "★ 4.8" },
      { name: "Eleven Madison Park", badge: "★ 4.9" },
    ],
    beaches: [
      { name: "Hampton Beach", badge: "★ 4.5" },
      { name: "Jones Beach", badge: "★ 4.3" },
      { name: "Fire Island", badge: "★ 4.6" },
    ],
    flights: [
      { name: "Air France CDG → JFK", badge: "499€" },
      { name: "Delta Airlines", badge: "450€" },
      { name: "American Airlines", badge: "420€" },
    ],
  },
  {
    name: "Bali",
    country: "Indonésie",
    flag: "🇮🇩",
    lat: -8.34,
    lon: 115.09,
    cityCode: "DPS",
    restaurants: [
      { name: "Locavore", badge: "★ 4.8" },
      { name: "Merah Putih", badge: "★ 4.7" },
      { name: "Sarong", badge: "★ 4.7" },
    ],
    beaches: [
      { name: "Seminyak Beach", badge: "★ 4.7" },
      { name: "Nusa Dua", badge: "★ 4.8" },
      { name: "Uluwatu", badge: "★ 4.9" },
    ],
    flights: [
      { name: "Air France CDG → DPS", badge: "1 199€" },
      { name: "Singapore Airlines", badge: "1 050€" },
      { name: "Emirates", badge: "980€" },
    ],
  },
];

// ─── City markers (tier 2 + 3, label-only, appear on zoom) ──────────────────

const CITY_MARKERS: Array<{ name: string; lat: number; lon: number; tier: 2 | 3 }> = [
  // Tier 2 — appear when camera distance < 2.3 (moderate zoom-in)
  { name: "London",     lat: 51.51,   lon: -0.13,   tier: 2 },
  { name: "Rome",       lat: 41.90,   lon: 12.50,   tier: 2 },
  { name: "Dubai",      lat: 25.20,   lon: 55.27,   tier: 2 },
  { name: "Sydney",     lat: -33.87,  lon: 151.21,  tier: 2 },
  { name: "Barcelona",  lat: 41.39,   lon: 2.17,    tier: 2 },
  { name: "Amsterdam",  lat: 52.37,   lon: 4.90,    tier: 2 },
  { name: "Singapore",  lat: 1.35,    lon: 103.82,  tier: 2 },
  { name: "Maldives",   lat: 3.20,    lon: 73.22,   tier: 2 },
  { name: "Santorini",  lat: 36.39,   lon: 25.46,   tier: 2 },
  { name: "Miami",      lat: 25.76,   lon: -80.19,  tier: 2 },
  { name: "Marrakech",  lat: 31.63,   lon: -7.98,   tier: 2 },
  { name: "Vienna",     lat: 48.21,   lon: 16.37,   tier: 2 },
  { name: "Cape Town",  lat: -33.93,  lon: 18.42,   tier: 2 },
  { name: "Kyoto",      lat: 35.01,   lon: 135.77,  tier: 2 },
  { name: "Prague",     lat: 50.08,   lon: 14.44,   tier: 2 },
  // Tier 3 — appear only when very close (camera distance < 1.75)
  { name: "Nice",        lat: 43.71,  lon: 7.26,    tier: 3 },
  { name: "Monaco",      lat: 43.74,  lon: 7.42,    tier: 3 },
  { name: "Cannes",      lat: 43.55,  lon: 7.02,    tier: 3 },
  { name: "Saint-Tropez",lat: 43.27,  lon: 6.64,    tier: 3 },
  { name: "Portofino",   lat: 44.30,  lon: 9.21,    tier: 3 },
  { name: "Positano",    lat: 40.63,  lon: 14.49,   tier: 3 },
  { name: "Mykonos",     lat: 37.45,  lon: 25.33,   tier: 3 },
  { name: "Dubrovnik",   lat: 42.65,  lon: 18.09,   tier: 3 },
  { name: "Florence",    lat: 43.77,  lon: 11.26,   tier: 3 },
  { name: "Malibu",      lat: 34.03,  lon: -118.78, tier: 3 },
  { name: "Aspen",       lat: 39.19,  lon: -106.82, tier: 3 },
  { name: "Osaka",       lat: 34.69,  lon: 135.50,  tier: 3 },
  { name: "Hakone",      lat: 35.23,  lon: 139.11,  tier: 3 },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "hotels", label: "Hôtels" },
  { key: "restaurants", label: "Restau" },
  { key: "beaches", label: "Plages" },
  { key: "flights", label: "Vols" },
];

// ─── Cards ────────────────────────────────────────────────────────────────────

function PlaceCard({ item }: { item: PlaceItem }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-background/60 p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
        <span className="shrink-0 text-primary text-sm font-medium">{item.badge}</span>
      </div>
    </div>
  );
}

function HotelCard({ hotel }: { hotel: HotelResult }) {
  // Priority: official website → Google Maps (shows Booking/Expedia inline prices)
  const primaryUrl = hotel.website ?? hotel.mapsUrl;

  return (
    <div className="rounded-xl border border-primary/10 bg-background/60 p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{hotel.name}</p>
          <div className="flex items-center gap-0.5 mt-1">
            {Array.from({ length: hotel.rating }).map((_, i) => (
              <Star key={i} className="h-3 w-3 fill-primary text-primary" />
            ))}
          </div>
          {hotel.address && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{hotel.address}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {/* Primary: official site or Google Maps */}
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-background text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {hotel.website ? "Site officiel" : "Voir sur Maps"}
        </a>
        {/* Secondary: Booking.com search */}
        <a
          href={hotel.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
        >
          Booking.com
        </a>
      </div>
    </div>
  );
}

function HotelSkeleton() {
  return (
    <div className="rounded-xl border border-primary/10 bg-background/60 p-4 animate-pulse">
      <div className="h-3.5 bg-primary/10 rounded w-3/4 mb-2" />
      <div className="h-3 bg-primary/10 rounded w-1/3" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [selected, setSelected] = useState<Destination | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("hotels");
  const [liveHotels, setLiveHotels] = useState<HotelResult[] | null>(null);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [hotelsError, setHotelsError] = useState<string | null>(null);

  // Fetch live hotels via Overpass (OpenStreetMap) — client-side, no API key
  useEffect(() => {
    if (!selected) { setLiveHotels(null); return; }
    setLiveHotels(null);
    setHotelsError(null);
    setHotelsLoading(true);

    const { lat, lon, name } = selected;
    const query = `[out:json][timeout:20];(node["tourism"="hotel"]["stars"~"^[45]$"](around:8000,${lat},${lon});way["tourism"="hotel"]["stars"~"^[45]$"](around:8000,${lat},${lon}););out body 10;`;

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((json) => {
        const seen = new Set<string>();
        const hotels: HotelResult[] = [];
        for (const el of json.elements ?? []) {
          const hotelName = el.tags?.name;
          if (!hotelName || seen.has(hotelName)) continue;
          seen.add(hotelName);
          const website = el.tags?.website ?? el.tags?.["contact:website"];
          const addr = [el.tags?.["addr:street"], el.tags?.["addr:housenumber"]].filter(Boolean).join(" ") || undefined;
          hotels.push({
            hotelId: `osm-${el.id}`,
            name: hotelName,
            rating: parseInt(el.tags?.stars ?? "4") || 4,
            address: addr,
            website: website ? (website.startsWith("http") ? website : `https://${website}`) : undefined,
            mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(hotelName + " " + name)}`,
            bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&nflt=class%3D4%3Bclass%3D5&src=searchresults&ac_suggestion_list_length=1&search_selected=true`,
          });
        }
        setLiveHotels(
          hotels.length > 0
            ? hotels
            : [{
                hotelId: "fallback",
                name: `Hôtels luxe — ${name}`,
                rating: 5,
                mapsUrl: `https://www.google.com/maps/search/hotel+luxe+${encodeURIComponent(name)}`,
                bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(name)}&nflt=class%3D5`,
              }]
        );
      })
      .catch(() => setHotelsError("Impossible de charger les hôtels"))
      .finally(() => setHotelsLoading(false));
  }, [selected?.name]);

  const filtered = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.country.toLowerCase().includes(search.toLowerCase())
  );

  function openDestination(name: string) {
    const d = DESTINATIONS.find((d) => d.name === name);
    if (d) {
      setSelected(d);
      setActiveTab("hotels");
      setSearch("");
    }
  }

  const tabItems: PlaceItem[] = selected
    ? activeTab === "restaurants"
      ? selected.restaurants
      : activeTab === "beaches"
      ? selected.beaches
      : activeTab === "flights"
      ? selected.flights
      : []
    : [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 border-b border-primary/10 bg-background/80 backdrop-blur-sm">

        {/* Logo — replace inner content with <Image src="/logo.png" .../> */}
        <div className="shrink-0">
          <div className="h-9 w-9 rounded border border-primary/30 bg-black flex items-center justify-center">
            <span className="text-primary text-[10px] font-bold tracking-tight">GG</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-lg mx-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50 pointer-events-none" />
          <Input
            placeholder="Rechercher une destination..."
            className="pl-9 bg-card/80 border-primary/20 focus:border-primary/50 placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="absolute top-full mt-1 w-full rounded-xl border border-primary/20 bg-card shadow-2xl overflow-hidden z-30">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Aucune destination trouvée</p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.name}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-primary/10 transition-colors text-left border-l-2 border-transparent hover:border-primary"
                    onClick={() => openDestination(d.name)}
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {d.flag} {d.country}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-full px-3 py-1 bg-black/40">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            MVP
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
          >
            Se connecter
          </Button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-[57px]">

        {/* Globe area — fills remaining space */}
        <main className="flex-1 relative min-w-0 overflow-hidden">
          {/* Tagline */}
          <p className="absolute top-5 left-1/2 -translate-x-1/2 z-10 text-[11px] tracking-[0.35em] text-primary/60 uppercase font-light select-none whitespace-nowrap">
            Votre concierge de voyage de luxe
          </p>

          {/* 3D Globe — full area */}
          <Globe3D
            destinations={DESTINATIONS}
            cityMarkers={CITY_MARKERS}
            selected={selected}
            onSelect={openDestination}
            className="absolute inset-0 w-full h-full"
          />

          {/* Bottom text overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
            <h2
              className="text-4xl italic text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Explorez le Monde
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Cliquez sur une destination pour découvrir nos sélections exclusives
            </p>
          </div>
        </main>

        {/* ── Side panel — fixed overlay, slides over the globe ───────────── */}
        <aside
          className="fixed top-0 right-0 h-full z-40 flex flex-col border-l border-primary/10 bg-card overflow-hidden transition-transform duration-300 ease-out w-[420px]"
          style={{ transform: selected ? "translateX(0)" : "translateX(100%)" }}
        >
          {selected && (
            <div className="flex flex-col h-full w-[420px]">

              {/* Header */}
              <div className="px-8 pt-8 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2
                      className="text-4xl font-bold text-primary"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      {selected.name}
                    </h2>
                    <p className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary/50" />
                      <span>{selected.flag}</span>
                      <span>{selected.country}</span>
                    </p>
                  </div>
                  <button
                    className="mt-1 h-8 w-8 rounded-full border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                    onClick={() => setSelected(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-8 border-b border-primary/10">
                <div className="flex gap-6">
                  {TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === key
                          ? "text-primary border-primary"
                          : "text-muted-foreground border-transparent hover:text-foreground"
                      }`}
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-8 py-5 space-y-3">
                {activeTab === "hotels" ? (
                  hotelsLoading ? (
                    <>
                      <HotelSkeleton />
                      <HotelSkeleton />
                      <HotelSkeleton />
                    </>
                  ) : hotelsError ? (
                    <div className="rounded-xl border border-primary/10 bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">
                        Impossible de charger les hôtels.
                      </p>
                      <p className="text-xs text-primary/60 mt-1 font-mono">{hotelsError}</p>
                    </div>
                  ) : liveHotels && liveHotels.length > 0 ? (
                    liveHotels.map((h) => <HotelCard key={h.hotelId} hotel={h} />)
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">Aucun hôtel trouvé.</p>
                  )
                ) : (
                  tabItems.map((item) => <PlaceCard key={item.name} item={item} />)
                )}
              </div>

              {/* CTA */}
              <div className="px-8 pb-8 pt-3">
                {activeTab === "hotels" && liveHotels && liveHotels.length > 0 ? (
                  <a
                    href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(selected?.name ?? "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full gap-2 bg-primary text-background hover:bg-primary/90">
                      <ExternalLink className="h-4 w-4" />
                      Tous les hôtels sur Booking.com
                    </Button>
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/70"
                  >
                    Voir plus
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Help button */}
      <button className="fixed bottom-6 right-6 z-30 h-9 w-9 rounded-full border border-primary/25 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-sm font-semibold">
        ?
      </button>
    </div>
  );
}
