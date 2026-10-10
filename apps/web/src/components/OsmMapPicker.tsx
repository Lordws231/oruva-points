import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  onSubmit: (lat: number, lng: number, city?: string) => Promise<void>;
  submitting: boolean;
}

// Osogbo, Osun State — Oruva's field-testing hub
const DEFAULT_CENTER: [number, number] = [7.77, 4.56];
const DEFAULT_ZOOM = 12;

function makePinIcon(): L.DivIcon {
  // divIcon (not the default image assets) — avoids the classic
  // Leaflet+Vite broken-marker-icon issue.
  return L.divIcon({
    className: "orva-pin",
    html: `<div class="orva-pin-dot"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Free pinpoint picker: Leaflet + OpenStreetMap tiles. No API key, no
 * billing. Behavior parity with GoogleMapsPicker — click to place/move the
 * pin (marker is draggable), or use the device's live geolocation.
 */
export default function OsmMapPicker({ onSubmit, submitting }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markerObj = useRef<L.Marker | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function placePin(lat: number, lng: number) {
    setPos({ lat, lng });
    const map = mapObj.current;
    if (!map) return;
    if (!markerObj.current) {
      markerObj.current = L.marker([lat, lng], {
        icon: makePinIcon(),
        draggable: true,
      })
        .addTo(map)
        .on("dragend", (e: L.LeafletEvent) => {
          const ll = (e.target as L.Marker).getLatLng();
          setPos({ lat: ll.lat, lng: ll.lng });
        });
    } else {
      markerObj.current.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }
  const placePinRef = useRef(placePin);
  placePinRef.current = placePin;

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) =>
      placePinRef.current(e.latlng.lat, e.latlng.lng)
    );
    mapObj.current = map;
    setReady(true);
    return () => {
      map.remove();
      mapObj.current = null;
      markerObj.current = null;
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
      (p) => placePinRef.current(p.coords.latitude, p.coords.longitude),
      (err) => setGeoError(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="z-0 h-96 w-full overflow-hidden rounded-xl border border-navy-700 bg-navy-900"
      >
        {!ready && (
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
