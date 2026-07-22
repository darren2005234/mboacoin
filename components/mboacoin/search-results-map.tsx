"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import { configureLeafletIcons, CAMEROON_DEFAULT_CENTER } from "@/lib/leaflet-setup";
import { getMapListings, type MapListing } from "@/lib/search";
import type { Filters } from "@/components/mboacoin/filters-sheet";

configureLeafletIcons();

/** Carte des résultats de recherche — mêmes filtres que la liste (prix, type de bien). */
export function SearchResultsMap({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [listings, setListings] = useState<MapListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMapListings({
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      propertyType: filters.propertyType || undefined,
    }).then((data) => {
      setListings(data);
      setLoading(false);
    });
  }, [filters]);

  const center: [number, number] =
    listings.length > 0 ? [listings[0].latitude, listings[0].longitude] : CAMEROON_DEFAULT_CENTER;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      {loading && (
        <p className="absolute inset-x-0 top-2 z-[1000] mx-auto w-fit rounded-full bg-card px-3 py-1 text-xs font-semibold shadow-card">
          Chargement...
        </p>
      )}
      <MapContainer center={center} zoom={listings.length > 0 ? 12 : 6} style={{ height: 420, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {listings.map((l) =>
          l.isExact ? (
            <Marker
              key={l.id}
              position={[l.latitude, l.longitude]}
              eventHandlers={{ click: () => router.push(`/listings/${l.id}`) }}
            >
              <Popup>
                <button onClick={() => router.push(`/listings/${l.id}`)} className="text-left text-sm font-semibold">
                  {l.title}
                </button>
              </Popup>
            </Marker>
          ) : (
            <Circle
              key={l.id}
              center={[l.latitude, l.longitude]}
              radius={l.radiusMeters ?? 800}
              pathOptions={{ color: "#0f766e", fillOpacity: 0.15 }}
              eventHandlers={{ click: () => router.push(`/listings/${l.id}`) }}
            >
              <Popup>
                <button onClick={() => router.push(`/listings/${l.id}`)} className="text-left text-sm font-semibold">
                  {l.title}
                </button>
              </Popup>
            </Circle>
          )
        )}
      </MapContainer>
    </div>
  );
}
