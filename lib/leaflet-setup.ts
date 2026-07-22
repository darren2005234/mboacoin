import L from "leaflet";

/**
 * Les icônes par défaut de Leaflet référencent des chemins d'image qui
 * cassent sous un bundler (webpack/Turbopack) — icônes copiées dans
 * public/leaflet/ (voir node_modules/leaflet/dist/images) et servies en
 * chemins statiques plutôt qu'importées, pour éviter toute ambiguïté entre
 * bundlers sur le format d'import d'image.
 */
let configured = false;

export function configureLeafletIcons() {
  if (configured) return;
  configured = true;

  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}

/** Centres approximatifs des grandes villes, pour cadrer la carte au départ — jamais pour positionner le marqueur (le bailleur seul le fait). */
export const CAMEROON_CITY_CENTERS: Record<string, [number, number]> = {
  douala: [4.0511, 9.7679],
  yaounde: [3.848, 11.5021],
  yaoundé: [3.848, 11.5021],
  bafoussam: [5.4737, 10.4179],
  garoua: [9.3017, 13.3921],
  maroua: [10.591, 14.3159],
  bamenda: [5.9631, 10.1591],
  buea: [4.1559, 9.2621],
  limbe: [4.0227, 9.2136],
  kribi: [2.9401, 9.9099],
  ngaoundere: [7.3167, 13.5833],
  ngaoundéré: [7.3167, 13.5833],
};

export const CAMEROON_DEFAULT_CENTER: [number, number] = [5.5, 12.0];

export function cityCenterFor(city: string | null | undefined): [number, number] {
  if (!city) return CAMEROON_DEFAULT_CENTER;
  const key = city.trim().toLowerCase();
  return CAMEROON_CITY_CENTERS[key] ?? CAMEROON_DEFAULT_CENTER;
}
