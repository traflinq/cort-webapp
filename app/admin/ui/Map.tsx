'use client';

import { useEffect, useRef, useState } from 'react';


/** Info-window content is raw HTML: escape user-provided stop/person names to prevent injection. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type MapMarker = {
  id: string;
  position: [number, number]; // [lat, lng]
  label?: string;
  description?: string;
  color?: string;
  type?: string;
  /** Degrees clockwise from north (same as mobile / GPS heading). Vehicles rotate to face this. */
  heading?: number;
};

export type MapPolyline = {
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
};

export type MapPolygon = {
  id?: string;
  positions: [number, number][];
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWeight?: number;
};

type MapProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  polygons?: MapPolygon[];
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  className?: string;
  /** When true, keep panning to `center` even after the user drags (e.g. ride tracking). Default false. */
  followCenter?: boolean;
};

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const VEHICLE_ICON_SIZE = 44;
const HEADING_JITTER_DEG = 2;

let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (!mapsPromise) {
    mapsPromise = new Promise<void>((resolve, reject) => {
      // Reuse the script tag the Places hook may have already added
      if (document.querySelector('script[data-gm-loader]')) {
        // Script is in-flight; poll until google.maps is available
        const poll = setInterval(() => {
          if (window.google?.maps?.Map) { clearInterval(poll); resolve(); }
        }, 50);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.gmLoader = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

function isVehicleMarker(marker: MapMarker): boolean {
  const type = marker.type ?? marker.id;
  return type === 'driver' || type === 'chauffeur' || type === 'shuttle';
}

function vehicleIconSrc(marker: MapMarker): string {
  const type = marker.type ?? marker.id;
  return type === 'shuttle' ? '/bus_birdeye.png' : '/car_birdeye.png';
}

/** Bearing in degrees clockwise from north (matches mobile calculateHeading). */
function bearingDegrees(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = Math.PI / 180;
  const lat1 = fromLat * toRad;
  const lat2 = toLat * toRad;
  const dLon = (toLng - fromLng) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function shortestHeadingDiff(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

const imageCache = new globalThis.Map<string, HTMLImageElement>();
const rotatedIconCache = new globalThis.Map<string, string>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load marker image: ${src}`));
    img.src = src;
  });
}

async function getRotatedVehicleIconUrl(src: string, headingDeg: number): Promise<string> {
  const rounded = Math.round(headingDeg / 2) * 2; // 2° buckets — less cache churn, still smooth
  const key = `${src}|${rounded}`;
  const hit = rotatedIconCache.get(key);
  if (hit) return hit;

  const img = await loadImage(src);
  const size = VEHICLE_ICON_SIZE * 2; // retina
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.rotate((rounded * Math.PI) / 180);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);

  const url = canvas.toDataURL('image/png');
  if (rotatedIconCache.size > 360) rotatedIconCache.clear();
  rotatedIconCache.set(key, url);
  return url;
}

function getStopMarkerIcon(marker: MapMarker): google.maps.Icon {
  const bg = marker.color ?? '#6366f1';
  const labelText = marker.label
    ? (marker.label.length <= 3 ? marker.label : marker.label.slice(0, 2))
    : '';
  const size = 34;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
    <circle cx="17" cy="17" r="15" fill="${bg}" stroke="white" stroke-width="3"/>
    ${labelText ? `<text x="17" y="17" font-size="11" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${labelText}</text>` : ''}
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

export default function Map({
  center,
  zoom = 13,
  markers = [],
  polylines = [],
  polygons = [],
  height = '400px',
  onMapClick,
  onMarkerClick,
  className = '',
  followCenter = false,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const gmMarkersRef = useRef<{ marker: google.maps.Marker; id: string }[]>([]);
  const gmPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const gmPolygonsRef = useRef<google.maps.Polygon[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const userHasPannedRef = useRef(false);
  const lastPannedCenterRef = useRef<[number, number] | null>(null);
  /** Last known lat/lng/heading per marker — used when socket heading is missing. */
  const lastMotionRef = useRef<globalThis.Map<string, { lat: number; lng: number; heading: number }>>(new globalThis.Map());

  // Keep latest callbacks in refs so effects don't re-run on every render
  const onMapClickRef = useRef(onMapClick);
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  // Inject ping keyframe once
  useEffect(() => {
    const id = 'cort-gmap-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = '@keyframes cort-ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.85}}';
    document.head.appendChild(s);
  }, []);

  const resolveHeading = (marker: MapMarker): number => {
    const [lat, lng] = marker.position;
    const prev = lastMotionRef.current.get(marker.id);

    let heading =
      typeof marker.heading === 'number' && !Number.isNaN(marker.heading)
        ? ((marker.heading % 360) + 360) % 360
        : null;

    if (heading == null && prev) {
      const moved =
        Math.abs(lat - prev.lat) > 1e-7 || Math.abs(lng - prev.lng) > 1e-7;
      if (moved) {
        const fromMotion = bearingDegrees(prev.lat, prev.lng, lat, lng);
        const diff = shortestHeadingDiff(prev.heading, fromMotion);
        heading = Math.abs(diff) > HEADING_JITTER_DEG ? fromMotion : prev.heading;
      } else {
        heading = prev.heading;
      }
    }

    if (heading == null) heading = prev?.heading ?? 0;

    lastMotionRef.current.set(marker.id, { lat, lng, heading });
    return heading;
  };

  // ── Initialise map (once) ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const defaultCenter = center
        ? { lat: center[0], lng: center[1] }
        : { lat: 24.8607, lng: 67.0011 };

      mapRef.current = new google.maps.Map(containerRef.current, {
        center: defaultCenter,
        zoom,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();

      mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) onMapClickRef.current?.(e.latLng.lat(), e.latLng.lng());
      });
      // Stop programmatic re-centering once the user takes control of the camera
      mapRef.current.addListener('dragstart', () => {
        userHasPannedRef.current = true;
      });

      setMapReady(true);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync markers (update in place when possible so live GPS doesn't rebuild the map) ─
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;

    const nextIds = new Set(markers.map((m) => m.id));
    const existingById = new globalThis.Map(gmMarkersRef.current.map((e) => [e.id, e.marker]));

    // Remove markers that disappeared
    gmMarkersRef.current.forEach(({ marker, id }) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        existingById.delete(id);
        lastMotionRef.current.delete(id);
      }
    });

    const nextRefs: { marker: google.maps.Marker; id: string }[] = [];

    const applyIcon = (gmMarker: google.maps.Marker, icon: google.maps.Icon) => {
      gmMarker.setIcon(icon);
    };

    markers.forEach((marker) => {
      const existing = existingById.get(marker.id);
      const gmMarker =
        existing ??
        new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: marker.position[0], lng: marker.position[1] },
          title: marker.label,
        });

      gmMarker.setPosition({ lat: marker.position[0], lng: marker.position[1] });
      gmMarker.setTitle(marker.label ?? '');

      if (!existing) {
        if (marker.label) {
          const iw = infoWindowRef.current!;
          gmMarker.addListener('click', () => {
            const description = marker.description
              ? `<div style="font-size:11px;color:#4b5563;margin-top:4px">${escapeHtml(marker.description)}</div>`
              : '';
            iw.setContent(
              `<div style="font-size:12px;font-weight:600">${escapeHtml(marker.label ?? '')}</div>${description}`,
            );
            iw.open({ anchor: gmMarker, map: mapRef.current });
            onMarkerClickRef.current?.(marker.id);
          });
        } else {
          gmMarker.addListener('click', () => onMarkerClickRef.current?.(marker.id));
        }
      }

      if (isVehicleMarker(marker)) {
        const heading = resolveHeading(marker);
        const src = vehicleIconSrc(marker);
        const size = VEHICLE_ICON_SIZE;
        const rounded = Math.round(heading / 2) * 2;
        const cacheKey = `${src}|${rounded}`;
        const cachedUrl = rotatedIconCache.get(cacheKey);

        applyIcon(gmMarker, {
          url: cachedUrl ?? src,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        });

        if (!cachedUrl) {
          getRotatedVehicleIconUrl(src, heading)
            .then((url) => {
              if (cancelled) return;
              applyIcon(gmMarker, {
                url,
                scaledSize: new google.maps.Size(size, size),
                anchor: new google.maps.Point(size / 2, size / 2),
              });
            })
            .catch(() => { /* keep unrotated fallback */ });
        }
      } else {
        applyIcon(gmMarker, getStopMarkerIcon(marker));
      }

      nextRefs.push({ marker: gmMarker, id: marker.id });
    });

    gmMarkersRef.current = nextRefs;

    // Auto-fit bounds when no explicit center was given (and user hasn't taken over)
    if (!center && markers.length > 0 && !userHasPannedRef.current) {
      if (markers.length === 1) {
        mapRef.current.panTo({ lat: markers[0].position[0], lng: markers[0].position[1] });
        mapRef.current.setZoom(14);
      } else {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach((m) => bounds.extend({ lat: m.position[0], lng: m.position[1] }));
        mapRef.current.fitBounds(bounds, 40);
      }
    }

    return () => { cancelled = true; };
  }, [mapReady, markers, center]);

  // ── Sync polylines ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    gmPolylinesRef.current.forEach((p) => p.setMap(null));
    gmPolylinesRef.current = [];

    polylines.forEach((pl) => {
      const path = pl.positions.map(([lat, lng]) => ({ lat, lng }));
      const isDashed = !!pl.dashArray;
      const line = new google.maps.Polyline({
        path,
        map: mapRef.current!,
        strokeColor: pl.color ?? '#0C225E',
        strokeWeight: pl.weight ?? 4,
        strokeOpacity: isDashed ? 0 : (pl.opacity ?? 0.85),
        ...(isDashed ? {
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: pl.opacity ?? 1, scale: pl.weight ?? 4 },
            offset: '0',
            repeat: '12px',
          }],
        } : {}),
      });
      gmPolylinesRef.current.push(line);
    });
  }, [mapReady, polylines]);

  // ── Sync polygons ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    gmPolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    gmPolygonsRef.current = [];

    polygons.forEach((polygon) => {
      const path = polygon.positions.map(([lat, lng]) => ({ lat, lng }));
      const shape = new google.maps.Polygon({
        paths: path,
        map: mapRef.current!,
        fillColor: polygon.fillColor ?? '#f97316',
        fillOpacity: polygon.fillOpacity ?? 0.18,
        strokeColor: polygon.strokeColor ?? '#ea580c',
        strokeOpacity: polygon.strokeOpacity ?? 0.9,
        strokeWeight: polygon.strokeWeight ?? 2,
      });
      gmPolygonsRef.current.push(shape);
    });
  }, [mapReady, polygons]);

  // ── Pan to explicit center when it changes (respect user pan unless followCenter) ─
  useEffect(() => {
    if (!mapReady || !mapRef.current || !center) return;
    if (!followCenter && userHasPannedRef.current) return;

    const prev = lastPannedCenterRef.current;
    if (prev && prev[0] === center[0] && prev[1] === center[1]) return;

    lastPannedCenterRef.current = center;
    mapRef.current.panTo({ lat: center[0], lng: center[1] });
  }, [mapReady, center, followCenter]);

  return (
    <div
      ref={containerRef}
      className={`rounded-lg overflow-hidden border border-line shadow-lg ${className}`}
      style={{ height, width: '100%' }}
    />
  );
}
