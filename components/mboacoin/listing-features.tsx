import { Icon } from "@/components/mboacoin/icon";

interface Features {
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  water: string | null;
  electricity: string | null;
  amenities: string[];
}

/** Libellés lisibles pour les valeurs stockées. */
const FURNISHING: Record<string, string> = {
  non_meuble: "Non meublé",
  semi_meuble: "Semi-meublé",
  meuble: "Meublé",
};
const WATER: Record<string, string> = {
  forage: "Forage",
  camwater: "Camwater",
  forage_camwater: "Forage + Camwater",
};
const ELECTRICITY: Record<string, string> = {
  prepaye: "Compteur prépayé",
  postpaye: "Compteur postpayé",
  incluse: "Électricité incluse",
};

/** Icône Material par commodité. */
const AMENITY_ICON: Record<string, string> = {
  Climatisation: "ac_unit",
  "Groupe électrogène": "bolt",
  Parking: "local_parking",
  "Gardien / sécurité": "security",
  "Caméras de surveillance": "videocam",
  "Eau chaude": "water_drop",
  "Internet / fibre": "wifi",
  Balcon: "balcony",
  "Cuisine équipée": "kitchen",
};

function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
      <span className="icon-badge size-8 shrink-0">
        <Icon name={icon} size={18} />
      </span>
      {children}
    </li>
  );
}

export function ListingFeatures({ features }: { features: Features }) {
  const { bedrooms, bathrooms, furnishing, water, electricity, amenities } = features;

  // Caractéristiques principales (on n'affiche que ce qui est renseigné)
  const main: { icon: string; label: string }[] = [];
  if (bedrooms) main.push({ icon: "bed", label: `${bedrooms} chambre${bedrooms > 1 ? "s" : ""}` });
  if (bathrooms) main.push({ icon: "bathtub", label: `${bathrooms} salle${bathrooms > 1 ? "s" : ""} d'eau` });
  if (furnishing) main.push({ icon: "chair", label: FURNISHING[furnishing] ?? furnishing });
  if (water) main.push({ icon: "water_drop", label: WATER[water] ?? water });
  if (electricity) main.push({ icon: "bolt", label: ELECTRICITY[electricity] ?? electricity });

  const hasAmenities = amenities && amenities.length > 0;
  if (main.length === 0 && !hasAmenities) return null;

  return (
    <div className="space-y-4">
      {main.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold">Caractéristiques</h2>
          <ul className="grid grid-cols-1 gap-2.5">
            {main.map((m) => (
              <Row key={m.label} icon={m.icon}>{m.label}</Row>
            ))}
          </ul>
        </div>
      )}

      {hasAmenities && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold">Commodités</h2>
          <ul className="grid grid-cols-2 gap-2.5">
            {amenities.map((a) => (
              <Row key={a} icon={AMENITY_ICON[a] ?? "check_circle"}>{a}</Row>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}