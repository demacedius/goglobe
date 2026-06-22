import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const query = `[out:json][timeout:25];(node["tourism"="hotel"]["stars"~"^[45]$"](around:8000,${lat},${lon});way["tourism"="hotel"]["stars"~"^[45]$"](around:8000,${lat},${lon}););out body 15;`;

  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    {
      headers: {
        // Overpass rejects requests with Accept: application/json (returns 406)
        Accept: "*/*",
        "User-Agent": "GoGlobe/1.0 (travel app; contact: demacedius@gmail.com)",
      },
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Overpass ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
