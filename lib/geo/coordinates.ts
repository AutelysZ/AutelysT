import Coordinates from "coordinate-parser";

export type CoordinateSource =
  | "coordinate"
  | "geo-uri"
  | "google-maps"
  | "apple-maps"
  | "bing-maps"
  | "openstreetmap"
  | "waze"
  | "here";

export type ParsedCoordinates = {
  lat: number;
  lng: number;
  source: CoordinateSource;
};

export type ParseResult = {
  coordinates?: ParsedCoordinates;
  error?: string;
};

export type PlatformLink = {
  id: string;
  name: string;
  url: string;
};

const DEFAULT_PRECISION = 6;

const SOURCE_LABELS: Record<CoordinateSource, string> = {
  coordinate: "Coordinate input",
  "geo-uri": "Geo URI",
  "google-maps": "Google Maps URL",
  "apple-maps": "Apple Maps URL",
  "bing-maps": "Bing Maps URL",
  openstreetmap: "OpenStreetMap URL",
  waze: "Waze URL",
  here: "HERE WeGo URL",
};

export function getSourceLabel(source: CoordinateSource): string {
  return SOURCE_LABELS[source] ?? "Coordinate input";
}

export function parseCoordinateInput(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a coordinate or maps URL." };

  const geo = parseGeoUri(trimmed);
  if (geo) return { coordinates: { ...geo, source: "geo-uri" } };

  const urlResult = parseUrlCoordinates(trimmed);
  if (urlResult) return { coordinates: urlResult };

  try {
    const parsed = new Coordinates(trimmed);
    const lat = parsed.getLatitude();
    const lng = parsed.getLongitude();
    if (!isValidLatLng(lat, lng)) {
      return { error: "Coordinate is out of range." };
    }
    return { coordinates: { lat, lng, source: "coordinate" } };
  } catch (err) {
    console.error("Failed to parse coordinate input", err);
    return {
      error: err instanceof Error ? err.message : "Unable to parse coordinate.",
    };
  }
}

export function formatDecimal(
  lat: number,
  lng: number,
  precision = DEFAULT_PRECISION,
): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

export function formatDecimalCardinal(
  lat: number,
  lng: number,
  precision = DEFAULT_PRECISION,
): string {
  const latCard = lat >= 0 ? "N" : "S";
  const lngCard = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(precision)} deg ${latCard}, ${Math.abs(
    lng,
  ).toFixed(precision)} deg ${lngCard}`;
}

export function formatDms(lat: number, lng: number): string {
  return `${formatDmsPart(lat, true)}, ${formatDmsPart(lng, false)}`;
}

export function formatDdm(lat: number, lng: number): string {
  return `${formatDdmPart(lat, true)}, ${formatDdmPart(lng, false)}`;
}

export function buildPlatformUrls(
  lat: number,
  lng: number,
  zoom = 16,
): PlatformLink[] {
  const zoomLevel = clampZoom(zoom);
  const latLng = `${lat.toFixed(DEFAULT_PRECISION)},${lng.toFixed(
    DEFAULT_PRECISION,
  )}`;
  const encodedLatLng = encodeURIComponent(latLng);

  return [
    {
      id: "google-maps",
      name: "Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${encodedLatLng}`,
    },
    {
      id: "apple-maps",
      name: "Apple Maps",
      url: `https://maps.apple.com/?ll=${encodedLatLng}`,
    },
    {
      id: "bing-maps",
      name: "Bing Maps",
      url: `https://www.bing.com/maps?cp=${lat.toFixed(6)}~${lng.toFixed(
        6,
      )}&lvl=${zoomLevel}`,
    },
    {
      id: "openstreetmap",
      name: "OpenStreetMap",
      url: `https://www.openstreetmap.org/?mlat=${lat.toFixed(
        6,
      )}&mlon=${lng.toFixed(6)}#map=${zoomLevel}/${lat.toFixed(6)}/${lng.toFixed(
        6,
      )}`,
    },
    {
      id: "waze",
      name: "Waze",
      url: `https://www.waze.com/ul?ll=${encodedLatLng}&navigate=yes`,
    },
    {
      id: "here",
      name: "HERE WeGo",
      url: `https://wego.here.com/?map=${lat.toFixed(6)},${lng.toFixed(
        6,
      )},${zoomLevel},normal`,
    },
    {
      id: "geo-uri",
      name: "Geo URI",
      url: `geo:${lat.toFixed(DEFAULT_PRECISION)},${lng.toFixed(
        DEFAULT_PRECISION,
      )}`,
    },
  ];
}

function parseGeoUri(input: string): { lat: number; lng: number } | null {
  if (!input.toLowerCase().startsWith("geo:")) return null;
  const withoutScheme = input.slice(4);
  const mainPart = withoutScheme.split(/[?;]/)[0];
  return parseLatLngPair(mainPart);
}

function parseUrlCoordinates(input: string): ParsedCoordinates | null {
  let url: URL | null = null;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host.includes("maps.app.goo.gl") || host.includes("goo.gl")) {
    return null;
  }

  if (host.includes("google")) {
    const coords = parseGoogleMaps(url);
    if (coords) return { ...coords, source: "google-maps" };
  }

  if (host.includes("apple.com")) {
    const coords = parseAppleMaps(url);
    if (coords) return { ...coords, source: "apple-maps" };
  }

  if (host.includes("bing.com")) {
    const coords = parseBingMaps(url);
    if (coords) return { ...coords, source: "bing-maps" };
  }

  if (host.includes("openstreetmap.org") || host.includes("osm.org")) {
    const coords = parseOpenStreetMap(url);
    if (coords) return { ...coords, source: "openstreetmap" };
  }

  if (host.includes("waze.com")) {
    const coords = parseWaze(url);
    if (coords) return { ...coords, source: "waze" };
  }

  if (host.includes("here.com")) {
    const coords = parseHere(url);
    if (coords) return { ...coords, source: "here" };
  }

  return null;
}

function parseGoogleMaps(url: URL): { lat: number; lng: number } | null {
  const pathMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (pathMatch) {
    return parseLatLngPair(`${pathMatch[1]},${pathMatch[2]}`);
  }

  const params = url.searchParams;
  const candidates = [
    params.get("q"),
    params.get("query"),
    params.get("ll"),
    params.get("center"),
    params.get("destination"),
    params.get("origin"),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const coords = parseLatLngPair(candidate);
    if (coords) return coords;
  }
  return null;
}

function parseAppleMaps(url: URL): { lat: number; lng: number } | null {
  const params = url.searchParams;
  const candidates = [params.get("ll"), params.get("sll"), params.get("q")];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const coords = parseLatLngPair(candidate);
    if (coords) return coords;
  }
  return null;
}

function parseBingMaps(url: URL): { lat: number; lng: number } | null {
  const params = url.searchParams;
  const cp = params.get("cp");
  if (cp) {
    const match = cp.match(/(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)/);
    if (match) {
      return parseLatLngPair(`${match[1]},${match[2]}`);
    }
  }

  const sp = params.get("sp");
  if (sp) {
    const match = sp.match(/point\.(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)/);
    if (match) {
      return parseLatLngPair(`${match[1]},${match[2]}`);
    }
  }

  const q = params.get("q");
  if (q) {
    const coords = parseLatLngPair(q);
    if (coords) return coords;
  }
  return null;
}

function parseOpenStreetMap(url: URL): { lat: number; lng: number } | null {
  const hashMatch = url.hash.match(
    /map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
  );
  if (hashMatch) {
    return parseLatLngPair(`${hashMatch[1]},${hashMatch[2]}`);
  }

  const params = url.searchParams;
  const mlat = params.get("mlat");
  const mlon = params.get("mlon");
  if (mlat && mlon) {
    return parseLatLngPair(`${mlat},${mlon}`);
  }

  const lat = params.get("lat");
  const lon = params.get("lon");
  if (lat && lon) {
    return parseLatLngPair(`${lat},${lon}`);
  }
  return null;
}

function parseWaze(url: URL): { lat: number; lng: number } | null {
  const params = url.searchParams;
  const ll = params.get("ll");
  if (ll) {
    const coords = parseLatLngPair(ll);
    if (coords) return coords;
  }

  const lat = params.get("lat");
  const lon = params.get("lon");
  if (lat && lon) {
    return parseLatLngPair(`${lat},${lon}`);
  }
  return null;
}

function parseHere(url: URL): { lat: number; lng: number } | null {
  const params = url.searchParams;
  const map = params.get("map");
  if (map) {
    const [lat, lng] = map.split(",");
    if (lat && lng) {
      const coords = parseLatLngPair(`${lat},${lng}`);
      if (coords) return coords;
    }
  }

  const center = params.get("center");
  if (center) {
    const coords = parseLatLngPair(center);
    if (coords) return coords;
  }
  return null;
}

function parseLatLngPair(raw: string): { lat: number; lng: number } | null {
  const cleaned = raw.replace(/[()]/g, " ").trim();
  const match = cleaned.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatDmsPart(value: number, isLat: boolean): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutesFull = (abs - deg) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = (minutesFull - minutes) * 60;
  const card = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg} deg ${minutes}' ${seconds.toFixed(2)}\" ${card}`;
}

function formatDdmPart(value: number, isLat: boolean): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutes = (abs - deg) * 60;
  const card = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg} deg ${minutes.toFixed(4)}' ${card}`;
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 16;
  if (value < 1) return 1;
  if (value > 20) return 20;
  return Math.round(value);
}
