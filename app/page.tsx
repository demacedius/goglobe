"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD = "#C4B000";
const GLOBE_BG = "#0a0a06";
const CENTER_LON = -30; // Atlantic-centered: shows Americas + Europe/Africa
const DOT_SPACING = 5;  // degrees between dots
const DOT_RADIUS = 1.8;
const GLOB_RATIO = 0.42; // globe radius as fraction of container size

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "hotels" | "restaurants" | "beaches" | "flights";

interface PlaceItem {
  name: string;
  subtitle: string;
  badge: string;
}

interface Destination {
  name: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  hotels: PlaceItem[];
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
    hotels: [
      { name: "Hôtel Le Meurice", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Ritz Paris", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Four Seasons George V", subtitle: "Données disponibles prochainement", badge: "★ 4.7" },
    ],
    restaurants: [
      { name: "Guy Savoy", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Le Jules Verne", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "L'Ambroisie", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
    ],
    beaches: [
      { name: "Plage du Touquet", subtitle: "Données disponibles prochainement", badge: "★ 4.5" },
      { name: "Plage de Deauville", subtitle: "Données disponibles prochainement", badge: "★ 4.4" },
      { name: "Falaise d'Étretat", subtitle: "Données disponibles prochainement", badge: "★ 4.6" },
    ],
    flights: [
      { name: "Air France CDG", subtitle: "Données disponibles prochainement", badge: "89€" },
      { name: "EasyJet ORY", subtitle: "Données disponibles prochainement", badge: "65€" },
      { name: "Transavia", subtitle: "Données disponibles prochainement", badge: "72€" },
    ],
  },
  {
    name: "Tokyo",
    country: "Japon",
    flag: "🇯🇵",
    lat: 35.68,
    lon: 139.69,
    hotels: [
      { name: "Park Hyatt Tokyo", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "The Peninsula Tokyo", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Aman Tokyo", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
    ],
    restaurants: [
      { name: "Sukiyabashi Jiro", subtitle: "Données disponibles prochainement", badge: "★ 5.0" },
      { name: "Narisawa", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Quintessence", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
    ],
    beaches: [
      { name: "Shonan Beach", subtitle: "Données disponibles prochainement", badge: "★ 4.3" },
      { name: "Enoshima", subtitle: "Données disponibles prochainement", badge: "★ 4.5" },
      { name: "Kamakura Beach", subtitle: "Données disponibles prochainement", badge: "★ 4.4" },
    ],
    flights: [
      { name: "Air France CDG → HND", subtitle: "Données disponibles prochainement", badge: "899€" },
      { name: "Japan Airlines", subtitle: "Données disponibles prochainement", badge: "850€" },
      { name: "ANA", subtitle: "Données disponibles prochainement", badge: "820€" },
    ],
  },
  {
    name: "New York",
    country: "États-Unis",
    flag: "🇺🇸",
    lat: 40.71,
    lon: -74.0,
    hotels: [
      { name: "The Plaza Hotel", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Four Seasons New York", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "The St. Regis", subtitle: "Données disponibles prochainement", badge: "★ 4.7" },
    ],
    restaurants: [
      { name: "Le Bernardin", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Daniel", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Eleven Madison Park", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
    ],
    beaches: [
      { name: "Hampton Beach", subtitle: "Données disponibles prochainement", badge: "★ 4.5" },
      { name: "Jones Beach", subtitle: "Données disponibles prochainement", badge: "★ 4.3" },
      { name: "Fire Island", subtitle: "Données disponibles prochainement", badge: "★ 4.6" },
    ],
    flights: [
      { name: "Air France CDG → JFK", subtitle: "Données disponibles prochainement", badge: "499€" },
      { name: "Delta Airlines", subtitle: "Données disponibles prochainement", badge: "450€" },
      { name: "American Airlines", subtitle: "Données disponibles prochainement", badge: "420€" },
    ],
  },
  {
    name: "Bali",
    country: "Indonésie",
    flag: "🇮🇩",
    lat: -8.34,
    lon: 115.09,
    hotels: [
      { name: "COMO Uma Ubud", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Amandari", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
      { name: "Four Seasons Jimbaran", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
    ],
    restaurants: [
      { name: "Locavore", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Merah Putih", subtitle: "Données disponibles prochainement", badge: "★ 4.7" },
      { name: "Sarong", subtitle: "Données disponibles prochainement", badge: "★ 4.7" },
    ],
    beaches: [
      { name: "Seminyak Beach", subtitle: "Données disponibles prochainement", badge: "★ 4.7" },
      { name: "Nusa Dua", subtitle: "Données disponibles prochainement", badge: "★ 4.8" },
      { name: "Uluwatu", subtitle: "Données disponibles prochainement", badge: "★ 4.9" },
    ],
    flights: [
      { name: "Air France CDG → DPS", subtitle: "Données disponibles prochainement", badge: "1 199€" },
      { name: "Singapore Airlines", subtitle: "Données disponibles prochainement", badge: "1 050€" },
      { name: "Emirates", subtitle: "Données disponibles prochainement", badge: "980€" },
    ],
  },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "hotels", label: "Hôtels" },
  { key: "restaurants", label: "Restau" },
  { key: "beaches", label: "Plages" },
  { key: "flights", label: "Vols" },
];

// ─── Geography helpers ────────────────────────────────────────────────────────

function isLandArea(lat: number, lon: number): boolean {
  // North America (main body)
  if (lat > 15 && lat < 72 && lon > -168 && lon < -52) {
    if (lat > 55 && lat < 65 && lon > -97 && lon < -78) return false; // Hudson Bay
    return true;
  }
  // Greenland
  if (lat > 60 && lat < 84 && lon > -58 && lon < -14) return true;
  // Central America / Caribbean
  if (lat > 5 && lat < 30 && lon > -120 && lon < -60) return true;
  // South America
  if (lat > -56 && lat < 13 && lon > -82 && lon < -34) return true;
  // Iceland
  if (lat > 63 && lat < 67 && lon > -25 && lon < -12) return true;
  // UK / Ireland
  if (lat > 50 && lat < 59 && lon > -8 && lon < 2) return true;
  // Europe
  if (lat > 36 && lat < 70 && lon > -10 && lon < 42) return true;
  // Scandinavia
  if (lat > 56 && lat < 72 && lon > 4 && lon < 31) return true;
  // Africa
  if (lat > -35 && lat < 38 && lon > -18 && lon < 52) return true;
  // Madagascar
  if (lat > -26 && lat < -12 && lon > 43 && lon < 51) return true;
  // Middle East / Arabian Peninsula
  if (lat > 12 && lat < 40 && lon > 35 && lon < 62) return true;
  // Russia / Siberia
  if (lat > 50 && lat < 78 && lon > 30 && lon < 180) return true;
  // Central / South Asia
  if (lat > 5 && lat < 55 && lon > 55 && lon < 145) return true;
  // Southeast Asia
  if (lat > -10 && lat < 28 && lon > 95 && lon < 142) return true;
  // Japan
  if (lat > 30 && lat < 46 && lon > 129 && lon < 146) return true;
  // Australia
  if (lat > -40 && lat < -10 && lon > 113 && lon < 155) return true;
  // New Zealand
  if (lat > -47 && lat < -34 && lon > 166 && lon < 178) return true;
  return false;
}

function projectToGlobe(
  lat: number,
  lon: number,
  cx: number,
  cy: number,
  radius: number
): { x: number; y: number; visible: boolean } {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lon - CENTER_LON) * Math.PI) / 180;
  const cosc = Math.cos(phi) * Math.cos(lambda);
  return {
    x: cx + radius * Math.cos(phi) * Math.sin(lambda),
    y: cy - radius * Math.sin(phi),
    visible: cosc >= 0,
  };
}

// ─── Globe Canvas ─────────────────────────────────────────────────────────────

function GlobeCanvas({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * GLOB_RATIO;

    // Clip everything to the globe circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Dark sphere background
    ctx.fillStyle = GLOBE_BG;
    ctx.fillRect(0, 0, size, size);

    // Subtle inner light (upper-left)
    const grd = ctx.createRadialGradient(
      cx - radius * 0.28,
      cy - radius * 0.28,
      0,
      cx,
      cy,
      radius
    );
    grd.addColorStop(0, "rgba(196, 176, 0, 0.07)");
    grd.addColorStop(0.5, "rgba(196, 176, 0, 0.02)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);

    // Draw continent dots
    ctx.fillStyle = GOLD;
    for (let lat = -80; lat <= 80; lat += DOT_SPACING) {
      for (let lon = -180; lon <= 180; lon += DOT_SPACING) {
        if (!isLandArea(lat, lon)) continue;

        const phi = (lat * Math.PI) / 180;
        const lambda = ((lon - CENTER_LON) * Math.PI) / 180;
        const cosc = Math.cos(phi) * Math.cos(lambda);
        if (cosc < 0) continue;

        const x = radius * Math.cos(phi) * Math.sin(lambda);
        const y = -radius * Math.sin(phi);

        // Fade dots toward the limb of the globe
        const dist = Math.sqrt(x * x + y * y) / radius;
        ctx.globalAlpha = 0.22 + (1 - dist) * 0.68;

        ctx.beginPath();
        ctx.arc(cx + x, cy + y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}

// ─── Destination Card ─────────────────────────────────────────────────────────

function PlaceCard({ item }: { item: PlaceItem }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-background/60 p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
        </div>
        <span className="shrink-0 text-primary text-sm font-medium">{item.badge}</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [selected, setSelected] = useState<Destination | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("hotels");
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [globeSize, setGlobeSize] = useState(440);

  const mainRef = useRef<HTMLDivElement>(null);

  // Resize the globe to fit the available area
  const updateGlobeSize = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const available = Math.min(el.clientWidth * 0.82, el.clientHeight * 0.6);
    setGlobeSize(Math.max(260, Math.min(500, available)));
  }, []);

  useEffect(() => {
    updateGlobeSize();
    window.addEventListener("resize", updateGlobeSize);
    return () => window.removeEventListener("resize", updateGlobeSize);
  }, [updateGlobeSize, selected]);

  const filtered = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.country.toLowerCase().includes(search.toLowerCase())
  );

  const cx = globeSize / 2;
  const cy = globeSize / 2;
  const radius = globeSize * GLOB_RATIO;

  function openDestination(d: Destination) {
    setSelected(d);
    setActiveTab("hotels");
    setSearch("");
  }

  const tabItems: PlaceItem[] =
    selected
      ? activeTab === "hotels"
        ? selected.hotels
        : activeTab === "restaurants"
        ? selected.restaurants
        : activeTab === "beaches"
        ? selected.beaches
        : selected.flights
      : [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 border-b border-primary/10 bg-background/80 backdrop-blur-sm">

        {/* Logo placeholder — replace with <Image src="/logo.png" .../> */}
        <div className="shrink-0 flex items-center gap-2">
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
                    onClick={() => openDestination(d)}
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

        {/* Right actions */}
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

        {/* Globe area */}
        <main
          ref={mainRef}
          className="flex-1 flex flex-col items-center justify-center gap-5 min-w-0 overflow-hidden"
        >
          {/* Tagline */}
          <p className="text-[11px] tracking-[0.35em] text-primary/60 uppercase font-light select-none">
            Votre concierge de voyage de luxe
          </p>

          {/* Globe + orbital ring + pins */}
          <div className="relative" style={{ width: globeSize, height: globeSize }}>

            {/* Atmosphere halo */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: -globeSize * 0.06,
                background: `radial-gradient(circle, rgba(196,176,0,0.06) 30%, transparent 70%)`,
              }}
            />

            {/* Dotted-continent canvas */}
            <GlobeCanvas size={globeSize} />

            {/* Orbital ring */}
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible"
              width={globeSize}
              height={globeSize}
              viewBox={`0 0 ${globeSize} ${globeSize}`}
            >
              <ellipse
                cx={cx}
                cy={cy}
                rx={radius * 1.24}
                ry={radius * 0.33}
                fill="none"
                stroke={GOLD}
                strokeWidth="1.2"
                strokeOpacity="0.5"
                transform={`rotate(-18, ${cx}, ${cy})`}
              />
            </svg>

            {/* Destination pins */}
            {DESTINATIONS.map((d) => {
              const pos = projectToGlobe(d.lat, d.lon, cx, cy, radius);
              if (!pos.visible) return null;
              const isActive = selected?.name === d.name;
              const isHovered = hoveredPin === d.name;
              const highlight = isActive || isHovered;
              return (
                <button
                  key={d.name}
                  className="absolute"
                  style={{ left: pos.x, top: pos.y, transform: "translate(-50%, -50%)" }}
                  onClick={() => openDestination(d)}
                  onMouseEnter={() => setHoveredPin(d.name)}
                  onMouseLeave={() => setHoveredPin(null)}
                >
                  {/* Label */}
                  {highlight && (
                    <span
                      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 pointer-events-none"
                      style={{ backgroundColor: GOLD, color: GLOBE_BG }}
                    >
                      {d.name}
                    </span>
                  )}
                  {/* Dot */}
                  <span
                    className="block rounded-full transition-all duration-200"
                    style={{
                      width: highlight ? 12 : 8,
                      height: highlight ? 12 : 8,
                      backgroundColor: GOLD,
                      boxShadow: highlight
                        ? `0 0 14px 5px rgba(196,176,0,0.55)`
                        : `0 0 6px 2px rgba(196,176,0,0.35)`,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Bottom text */}
          <div className="text-center select-none">
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

        {/* ── Side panel ───────────────────────────────────────────────────── */}
        <aside
          className="shrink-0 flex flex-col border-l border-primary/10 bg-card overflow-hidden transition-[width,opacity] duration-300 ease-out"
          style={{ width: selected ? 420 : 0, opacity: selected ? 1 : 0 }}
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
                {tabItems.map((item) => (
                  <PlaceCard key={item.name} item={item} />
                ))}
              </div>

              {/* Voir plus */}
              <div className="px-8 pb-8 pt-3">
                <Button
                  variant="outline"
                  className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/70"
                >
                  Voir plus
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Help button ───────────────────────────────────────────────────────── */}
      <button className="fixed bottom-6 right-6 z-30 h-9 w-9 rounded-full border border-primary/25 bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-sm font-semibold">
        ?
      </button>
    </div>
  );
}
