"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X, Plane } from "lucide-react";
import { Globe3D, TIER2_DIST, TIER3_DIST } from "@/components/globe-3d";
import { CityGoogleMap } from "@/components/city-google-map";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatFlightTime(km: number): string {
  const hours = km / 850 + 0.75;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}`;
}
interface HotelResult {
  hotelId: string;
  name: string;
  rating: number;
  address?: string;
  website?: string;
  mapsUrl: string;
  bookingUrl: string;
  lat?: number;
  lon?: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [selected, setSelected] = useState<Destination | null>(null);
  const [search, setSearch] = useState("");
  const [liveHotels, setLiveHotels] = useState<HotelResult[] | null>(null);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [hotelsError, setHotelsError] = useState<string | null>(null);
  const [camDist, setCamDist] = useState(9);
  const [userLatLon, setUserLatLon] = useState<{ lat: number; lon: number } | null>(null);

  // Geolocation on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLatLon({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {} // silently ignore denied
    );
  }, []);

  // Estimated flight time
  const flightTime = useMemo(() => {
    if (!selected || !userLatLon) return null;
    const km = haversineKm(userLatLon.lat, userLatLon.lon, selected.lat, selected.lon);
    return formatFlightTime(km);
  }, [selected, userLatLon]);

  // Hotel zoom tier: 5★ far → 3-4★ medium → 2★ close (cumulative reveal)
  const hotelMinStars = camDist > TIER2_DIST ? 5 : camDist > TIER3_DIST ? 3 : 2;

  // At the closest zoom tier, hand off from the 3D globe to a real,
  // natively-zoomable Google Map (see CityGoogleMap) — dismissible so the
  // user can drop back to the 3D view without fully deselecting the city,
  // and it re-arms once they scroll back out past the tier-3 threshold.
  const [mapDismissed, setMapDismissed] = useState(false);
  useEffect(() => setMapDismissed(false), [selected?.name]);
  useEffect(() => {
    if (camDist > TIER3_DIST) setMapDismissed(false);
  }, [camDist]);
  const showGoogleMap = !!selected && camDist <= TIER3_DIST && !mapDismissed;

  // Filtered by star tier, plotted directly on the globe/city map as points
  const hotelMarkers = useMemo(
    () =>
      (liveHotels ?? [])
        .filter((h): h is HotelResult & { lat: number; lon: number } =>
          h.rating >= hotelMinStars && h.lat != null && h.lon != null
        )
        .map((h) => ({
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          rating: h.rating,
          address: h.address,
          website: h.website,
          mapsUrl: h.mapsUrl,
          bookingUrl: h.bookingUrl,
        })),
    [liveHotels, hotelMinStars]
  );

  // Fetch live hotels via Overpass (OpenStreetMap) — client-side, no API key
  useEffect(() => {
    if (!selected) { setLiveHotels(null); return; }
    setLiveHotels(null);
    setHotelsError(null);
    setHotelsLoading(true);

    const { lat, lon, name } = selected;

    fetch(`/api/hotels?lat=${lat}&lon=${lon}`)
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
            lat: el.lat ?? el.center?.lat,
            lon: el.lon ?? el.center?.lon,
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
      setSearch("");
    }
  }

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-background text-foreground">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b border-primary/10 bg-background/80 backdrop-blur-sm">

        {/* Logo */}
        <div className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="GoGlobe" className="h-9 sm:h-14 w-auto object-contain mix-blend-lighten" />
        </div>

        {/* Search */}
        <div className="relative w-full max-w-lg mx-1 sm:mx-6 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50 pointer-events-none" />
          <Input
            placeholder="Rechercher une destination..."
            className="pl-9 bg-card/80 border-primary/20 focus:border-primary/50 placeholder:text-muted-foreground text-sm"
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
        <div className="shrink-0 flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-full px-3 py-1 bg-black/40">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            MVP
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary px-2.5 sm:px-4 text-xs sm:text-sm"
          >
            Se connecter
          </Button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-[52px] sm:pt-[57px]">

        {/* Globe area — fills remaining space */}
        <main className="flex-1 relative min-w-0 overflow-hidden">
          {/* Tagline */}
          <p className="hidden sm:block absolute top-5 left-1/2 -translate-x-1/2 z-10 text-[11px] tracking-[0.35em] text-primary/60 uppercase font-light select-none whitespace-nowrap">
            Votre concierge de voyage de luxe
          </p>

          {/* 3D Globe — full area */}
          <Globe3D
            destinations={DESTINATIONS}
            cityMarkers={CITY_MARKERS}
            hotelMarkers={hotelMarkers}
            selected={selected}
            onSelect={openDestination}
            onCamDist={setCamDist}
            userLatLon={userLatLon ?? undefined}
            className="absolute inset-0 w-full h-full"
          />

          {/* Closest zoom tier: real Google Map takes over from the 3D globe.
              Rendered as a sibling (not nested inside Globe3D) so it captures
              its own scroll/click input instead of fighting the globe's wheel
              zoom listener underneath. */}
          {showGoogleMap && selected && (
            <CityGoogleMap
              lat={selected.lat}
              lon={selected.lon}
              hotels={hotelMarkers}
              onExit={() => setMapDismissed(true)}
              className="absolute inset-0 w-full h-full z-20"
            />
          )}

          {/* Centered text overlay */}
          <div className="absolute bottom-[15%] sm:bottom-[22%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none px-4 w-full max-w-md">
            <p className="text-[9px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.4em] uppercase text-primary/50 font-light mb-2 sm:mb-3">
              Trouvez votre prochain voyage
            </p>
            <h2
              className="text-2xl sm:text-4xl italic text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Explorez le Monde
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Cliquez sur une destination pour découvrir nos sélections exclusives
            </p>
          </div>

          {/* Selected destination badge — no more side panel: hotels live as
              points on the globe/city map, hover (desktop) or tap (mobile) on
              a point to see its card. */}
          {selected && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 sm:left-4 sm:translate-x-0 z-20 flex items-start gap-3 rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-sm px-4 py-2.5 shadow-2xl max-w-[calc(100%-1.5rem)] sm:max-w-xs">
              <div className="min-w-0">
                <p
                  className="flex items-center gap-1.5 text-lg font-bold text-primary truncate"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  <span>{selected.flag}</span>
                  <span className="truncate">{selected.name}</span>
                </p>
                <p className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                  <span>{selected.country}</span>
                  {flightTime && (
                    <span className="flex items-center gap-1 text-primary/70">
                      <Plane className="h-3 w-3" />
                      ~{flightTime}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[10px] tracking-widest uppercase text-primary/40 font-light">
                  {hotelsLoading
                    ? "Recherche des hôtels…"
                    : hotelsError
                    ? "Hôtels indisponibles"
                    : hotelMinStars === 5
                    ? "★★★★★ Luxe"
                    : hotelMinStars === 3
                    ? "★★★+ Premium"
                    : "Tous les hébergements"}
                </p>
              </div>
              <button
                className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                onClick={() => setSelected(null)}
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Help button */}
      <button className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-primary/25 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-sm font-semibold">
        ?
      </button>
    </div>
  );
}
