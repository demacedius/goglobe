import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  // Fetch all hotels — most OSM entries have no "stars" tag at all, so
  // filtering on it server-side would exclude them outright. The frontend
  // instead defaults untagged hotels to 4★ and filters by zoom tier.
  //
  // Radius stays within the tightest satellite-patch tier's real-world
  // coverage (see SATELLITE_TIERS in globe-3d.tsx — 6km fetch = 3km half-
  // width at the closest zoom). A wider radius here would return hotels
  // that sit outside the visible map image at closer zoom tiers, which
  // then render as points floating off the edge of the city map.
  const query = `[out:json][timeout:25];(node["tourism"="hotel"](around:3000,${lat},${lon});way["tourism"="hotel"](around:3000,${lat},${lon}););out center 50;`;

  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    {
      headers: {
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
