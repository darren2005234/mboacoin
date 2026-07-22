"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import { configureLeafletIcons } from "@/lib/leaflet-setup";

configureLeafletIcons();

/** Carte en lecture seule d'une fiche d'annonce — jamais de marqueur déplaçable (voir listing-location-picker.tsx pour l'édition). */
export function ListingLocationMap({
  latitude,
  longitude,
  isExact,
  radiusMeters,
}: {
  latitude: number;
  longitude: number;
  isExact: boolean;
  radiusMeters: number | null;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-border">
        <MapContainer
          center={[latitude, longitude]}
          zoom={isExact ? 15 : 13}
          scrollWheelZoom={false}
          dragging={true}
          style={{ height: 180, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {isExact ? (
            <Marker position={[latitude, longitude]} />
          ) : (
            <Circle center={[latitude, longitude]} radius={radiusMeters ?? 800} pathOptions={{ color: "#0f766e", fillOpacity: 0.15 }} />
          )}
        </MapContainer>
      </div>
      {!isExact && (
        <p className="text-xs text-muted-foreground">
          Zone approximative. L&apos;emplacement exact est communiqué après une visite confirmée.
        </p>
      )}
    </div>
  );
}
