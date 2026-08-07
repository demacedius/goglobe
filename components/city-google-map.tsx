"use client";

import { useEffect, useRef, useState } from "react";
import { Globe as GlobeIcon, X } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

const GOLD = "#C4B000";
const INK = "#0a0a06";

interface HotelPoint {
  name: string;
  lat: number;
  lon: number;
  rating: number;
  address?: string;
  website?: string;
  mapsUrl: string;
  bookingUrl: string;
}

function hotelCardHtml(h: HotelPoint): string {
  const primaryUrl = h.website ?? h.mapsUrl;
  return `
    <div style="font-family:inherit;min-width:190px;max-width:220px;">
      <p style="margin:0 0 2px;font-weight:600;font-size:13px;color:${INK};">${h.name}</p>
      <p style="margin:0 0 6px;font-size:12px;color:${GOLD};letter-spacing:1px;">${"★".repeat(h.rating)}</p>
      ${h.address ? `<p style="margin:0 0 8px;font-size:11px;color:#666;">${h.address}</p>` : ""}
      <div style="display:flex;gap:6px;">
        <a href="${primaryUrl}" target="_blank" rel="noopener noreferrer"
           style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px 4px;border-radius:8px;background:${GOLD};color:${INK};text-decoration:none;">
          ${h.website ? "Site officiel" : "Voir sur Maps"}
        </a>
        <a href="${h.bookingUrl}" target="_blank" rel="noopener noreferrer"
           style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px 4px;border-radius:8px;border:1px solid ${GOLD};color:#8a7d00;text-decoration:none;">
          Booking.com
        </a>
      </div>
    </div>
  `;
}

export interface CityGoogleMapProps {
  lat: number;
  lon: number;
  hotels: HotelPoint[];
  onExit: () => void;
  className?: string;
}

// Real, natively zoomable Google Maps view of the selected city — takes over
// from the 3D globe at the closest zoom tier, since an interactive Maps
// embed can't be textured onto the WebGL sphere. Hotel points are plotted at
// their true coordinates (no exaggerated offset math needed here, unlike the
// globe's satellite patch) with the same hover(desktop)/tap(mobile) card.
export function CityGoogleMap({ lat, lon, hotels, onExit, className = "" }: CityGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat, lng: lon },
      zoom: 16,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      streetViewControl: true,
      fullscreenControl: false,
      mapTypeControl: false,
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [ready, lat, lon]);

  // Recenter (without resetting zoom) when the selected city changes.
  useEffect(() => {
    mapRef.current?.setCenter({ lat, lng: lon });
  }, [lat, lon]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    const isTouch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = hotels.map((h) => {
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lon },
        map,
        title: h.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#f5f0e6",
          fillOpacity: 1,
          strokeColor: INK,
          strokeWeight: 1.5,
        },
      });

      const open = () => {
        infoWindow?.setContent(hotelCardHtml(h));
        infoWindow?.open({ map, anchor: marker });
      };
      const close = () => infoWindow?.close();

      if (isTouch) {
        marker.addListener("click", open);
      } else {
        marker.addListener("mouseover", open);
        marker.addListener("mouseout", close);
      }

      return marker;
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
    };
  }, [hotels, ready]);

  return (
    <div className={className}>
      {failed ? (
        <div className="flex h-full w-full items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Carte indisponible</p>
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}

      <button
        onClick={onExit}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-4 py-2 text-xs font-medium text-primary shadow-xl hover:bg-primary/10 transition-colors"
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        Retour au globe 3D
      </button>
      <button
        onClick={onExit}
        aria-label="Fermer la carte"
        className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full border border-primary/30 bg-card/95 flex items-center justify-center text-primary shadow-xl hover:bg-primary/10 transition-colors sm:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
