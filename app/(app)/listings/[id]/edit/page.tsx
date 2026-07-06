"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { getListingForEdit, updateListing } from "@/lib/edit-listing";

const TYPES = ["Studio", "Appartement", "Villa", "Chambre"];
const AMENITIES = [
  "Climatisation",
  "Groupe électrogène",
  "Parking",
  "Gardien / sécurité",
  "Caméras de surveillance",
  "Eau chaude",
  "Internet / fibre",
  "Balcon",
  "Cuisine équipée",
];

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Studio");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [advance, setAdvance] = useState("");
  const [deposit, setDeposit] = useState("");
  const [furnishing, setFurnishing] = useState("non_meuble");
  const [water, setWater] = useState("");
  const [electricity, setElectricity] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [rooms, setRooms] = useState("");
  const [area, setArea] = useState("");
  const [availableNow, setAvailableNow] = useState(true);
  const [availableFrom, setAvailableFrom] = useState("");
  const [addressDescription, setAddressDescription] = useState("");

  useEffect(() => {
    (async () => {
      const data = await getListingForEdit(id);
      if (!data) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }
      setRooms(data.rooms != null ? String(data.rooms) : "");
      setArea(data.area != null ? String(data.area) : "");
      setAvailableNow(data.availableFrom == null);
      setAvailableFrom(data.availableFrom ?? "");
      setTitle(data.title);
      setType(data.propertyType.charAt(0).toUpperCase() + data.propertyType.slice(1));
      setCity(data.city);
      setNeighborhood(data.neighborhood);
      setAddressDescription(data.addressDescription ?? "");
      setPrice(String(data.price));
      setBedrooms(data.bedrooms != null ? String(data.bedrooms) : "");
      setBathrooms(data.bathrooms != null ? String(data.bathrooms) : "");
      setAdvance(data.advanceMonths != null ? String(data.advanceMonths) : "");
      setDeposit(data.depositMonths != null ? String(data.depositMonths) : "");
      setFurnishing(data.furnishing);
      setWater(data.water ?? "");
      setElectricity(data.electricity ?? "");
      setAmenities(data.amenities);
      setDescription(data.description ?? "");
      setLoading(false);
    })();
  }, [id]);

  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function save() {
    setError(null);
    setSaving(true);
    const result = await updateListing(id, {
      title,
      propertyType: type,
      city,
      neighborhood,
      price: Number(price),
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      advanceMonths: Number(advance) || 1,
      depositMonths: Number(deposit) || 1,
      furnishing,
      water: water || null,
      electricity: electricity || null,
      amenities,
      description,
      newFiles,
      rooms: Number(rooms) || null,
      area: Number(area) || null,
      availableFrom: availableNow ? null : availableFrom || null,
      addressDescription: addressDescription.trim() || null,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/listings/${id}`);
  }

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (notAllowed) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm font-bold">Modification impossible</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette annonce n&apos;existe pas ou ne vous appartient pas.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Modifier l'annonce" subtitle="Mettez à jour les informations de votre bien." />

      <div className="space-y-6 px-5">
        <div>
          <label className="field-label">Titre</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="field-label">Type de bien</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  type === t
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Ville</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="field-label">Quartier</label>
            <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} />
          </div>

        </div>
          <div>
            <label className="field-label">
              Adresse / indications <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <textarea
              value={addressDescription}
              onChange={(e) => setAddressDescription(e.target.value)}
              rows={2}
              placeholder="Ex : derrière la station Total, à 100m du carrefour Ndokoti"
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            />
          </div>

        <div>
          <label className="field-label">Loyer mensuel (FCFA)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">Chambres</label>
            <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="field-label">Avance</label>
            <input type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="field-label">Caution</label>
            <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} />
          </div>
        </div>
                  <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Pièces</label>
            <input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="field-label">Superficie (m²)</label>
            <input type="number" value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="field-label">Disponibilité</label>
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <input
              type="checkbox"
              checked={availableNow}
              onChange={(e) => setAvailableNow(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium">Disponible immédiatement</span>
          </label>
          {!availableNow && (
            <input
              type="date"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className={`mt-2 ${inputCls}`}
            />
          )}
        </div>

        <div>
          <label className="field-label">Ameublement</label>
          <select value={furnishing} onChange={(e) => setFurnishing(e.target.value)} className={inputCls}>
            <option value="non_meuble">Non meublé</option>
            <option value="semi_meuble">Semi-meublé</option>
            <option value="meuble">Meublé</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Eau</label>
            <select value={water} onChange={(e) => setWater(e.target.value)} className={inputCls}>
              <option value="">Non précisé</option>
              <option value="forage">Forage</option>
              <option value="camwater">Camwater</option>
              <option value="forage_camwater">Forage + Camwater</option>
            </select>
          </div>
          <div>
            <label className="field-label">Électricité</label>
            <select value={electricity} onChange={(e) => setElectricity(e.target.value)} className={inputCls}>
              <option value="">Non précisé</option>
              <option value="prepaye">Compteur prépayé</option>
              <option value="postpaye">Compteur postpayé</option>
              <option value="incluse">Incluse dans le loyer</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Salles d&apos;eau (douches)</label>
          <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="field-label">Commodités</label>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const active = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={
                    active
                      ? "rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
                      : "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground"
                  }
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="field-label">Ajouter des photos (optionnel)</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-6 text-center">
            <Icon name="add_a_photo" size={24} className="text-muted-foreground" filled={false} />
            <span className="text-sm font-medium text-muted-foreground">
              {newFiles.length > 0 ? `${newFiles.length} nouvelle(s) photo(s)` : "Ajouter aux photos existantes"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setNewFiles(Array.from(e.target.files ?? []).slice(0, 6))}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="field-label">Description</label>
            <span className={description.length >= 1500 ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
              {description.length} / 1500
            </span>
          </div>
          <textarea
            rows={5}
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  );
}