import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMap;
        Marker: new (opts: Record<string, unknown>) => GoogleMarker;
      };
    };
  }
}

interface GoogleMap {
  setCenter(c: { lat: number; lng: number }): void;
  setZoom(z: number): void;
  addListener(ev: string, fn: (e: MapClick) => void): void;
}
interface GoogleMarker {
  setMap(m: GoogleMap | null): void;
  setPosition(p: { lat: number; lng: number }): void;
}
interface MapClick {
  latLng: { lat(): number; lng(): number } | null;
}

const MAPS_KEY: string | undefined = import.meta.env
  .VITE_GOOGLE_MAPS_API_KEY as string | undefined;

interface Props {
  onSubmit: (lat: number, lng: number, city?: string) => Promise<void>;
  submitting: boolean;
}

/**
 * Google Maps pinpoint picker. Click the map to place the pin, or use the
 * device's live geolocation. Renders a setup hint when no API key is set.
 */
export default function GoogleMapsPicker({ onSubmit, submitting }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<GoogleMap | null>(null);
  const markerObj = useRef<GoogleMarker | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function placePin(lat: number, lng: number) {
    setPos({ lat, lng });
    const g = window.google?.maps;
    if (g && mapObj.current) {
      if (!markerObj.current) {
        markerObj.current = new g.Marker({ map: mapObj.current });
      }
      markerObj.current.setPosition({ lat, lng });
      mapObj.current.setCenter({ lat, lng });
    }
  }

  useEffect(() => {
    if (!MAPS_KEY || !mapRef.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google || !mapRef.current) return;
      const g = window.google.maps;
      const map = new g.Map(mapRef.current, {
        center: { lat: 6.5244, lng: 3.3792 }, // Lagos, Nigeria
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapObj.current = map;
      map.addListener("click", (e: MapClick) => {
        if (!e.latLng) return;
        placePin(e.latLng.lat(), e.latLng.lng());
      });
      setLoaded(true);
    };

    if (window.google?.maps) {
      init();
    } else {
      const cb = `__orvaMapsInit_${Date.now()}`;
      (window as unknown as Record<string, () => void>)[cb] = () => {
        init();
        delete (window as unknown as Record<string, unknown>)[cb];
      };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=${cb}`;
      s.async = true;
      s.onerror = () => {
        if (!cancelled) setGeoError("Failed to load Google Maps.");
      };
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useLiveLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        placePin(p.coords.latitude, p.coords.longitude);
        mapObj.current?.setZoom(15);
      },
      (err) => setGeoError(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!MAPS_KEY) {
    return (
      <div className="rounded-xl border border-dashed border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <p className="font-semibold text-ember-400">
          Google Maps key not configured
        </p>
        <p className="mt-2">
          To enable the live location picker, set{" "}
          <code className="rounded bg-navy-950 px-1">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
          in <code className="rounded bg-navy-950 px-1">apps/web/.env</code> and
          restart the dev server. See the README for how to create a key with
          the Maps JavaScript API enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="h-96 w-full overflow-hidden rounded-xl border border-navy-700 bg-navy-900"
      >
        {!loaded && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading map…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useLiveLocation}
          className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold hover:bg-navy-800"
        >
          📍 Use my live location
        </button>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Area label (optional, e.g. Osogbo)"
          className="min-w-52 flex-1 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-ember-500"
        />
      </div>

      {geoError && <p className="text-sm text-red-400">{geoError}</p>}

      {pos && (
        <p className="text-sm text-slate-300">
          Pinpoint:{" "}
          <span className="font-mono">
            {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
          </span>
        </p>
      )}

      <button
        type="button"
        disabled={!pos || submitting}
        onClick={() => pos && onSubmit(pos.lat, pos.lng, city || undefined)}
        className="rounded-lg bg-ember-500 px-6 py-2.5 font-semibold text-navy-950 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-ember-400"
      >
        {submitting ? "Sharing…" : "Share pinpoint · +1,500 pts"}
      </button>
    </div>
  );
}
