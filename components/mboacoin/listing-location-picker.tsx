"use client";

import { useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent, Marker as LeafletMarker, LeafletEvent } from "leaflet";
import { Icon } from "@/components/mboacoin/icon";
import { configureLeafletIcons, cityCenterFor } from "@/lib/leaflet-setup";

configureLeafletIcons();

export interface ListingLocationValue {
  latitude: number | null;
  longitude: number | null;
  locationPrecision: "approximatif" | "precis";
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Le bailleur place lui-même son marqueur — jamais de conversion automatique
 * adresse->GPS (l'adressage camerounais n'est pas normalisé, ça échouerait
 * pour la majorité des annonces). `cityHint` ne sert qu'à cadrer la carte au
 * démarrage, jamais à positionner le marqueur.
 */
export function ListingLocationPicker({
  value,
  onChange,
  cityHint,
}: {
  value: ListingLocationValue;
  onChange: (value: ListingLocationValue) => void;
  cityHint?: string;
}) {
  const hasLocation = value.latitude != null && value.longitude != null;
  const center = useMemo<[number, number]>(
    () => (hasLocation ? [value.latitude!, value.longitude!] : cityCenterFor(cityHint)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function place(lat: number, lng: number) {
    onChange({ ...value, latitude: lat, longitude: lng });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border">
        <MapContainer center={center} zoom={hasLocation ? 15 : 12} scrollWheelZoom={false} style={{ height: 220, width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={place} />
          {hasLocation && (
            <Marker
              position={[value.latitude!, value.longitude!]}
              draggable
              eventHandlers={{
                dragend: (e: LeafletEvent) => {
                  const marker = e.target as LeafletMarker;
                  const pos = marker.getLatLng();
                  place(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasLocation
          ? "Cliquez sur la carte ou déplacez le marqueur pour ajuster l'emplacement."
          : "Cliquez sur la carte à l'emplacement de votre bien pour le géolocaliser (facultatif)."}
      </p>

      {hasLocation && (
        <>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, locationPrecision: "approximatif" })}
              className={
                value.locationPrecision === "approximatif"
                  ? "w-full rounded-xl border-2 border-accent bg-brand-50 p-3 text-left"
                  : "w-full rounded-xl border border-border bg-card p-3 text-left"
              }
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon name="blur_circular" size={18} className="text-accent" />
                Zone approximative <span className="font-normal text-muted-foreground">(recommandé)</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Les visiteurs voient le quartier ; l&apos;emplacement exact est communiqué après une visite confirmée.
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, locationPrecision: "precis" })}
              className={
                value.locationPrecision === "precis"
                  ? "w-full rounded-xl border-2 border-accent bg-brand-50 p-3 text-left"
                  : "w-full rounded-xl border border-border bg-card p-3 text-left"
              }
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon name="location_on" size={18} className="text-accent" />
                Emplacement précis
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Le point exact du bien est visible directement par tout visiteur.
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChange({ latitude: null, longitude: null, locationPrecision: "approximatif" })}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            Retirer la géolocalisation
          </button>
        </>
      )}
    </div>
  );
}
