"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { createListing } from "@/lib/create-listing";

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

const DRAFT_KEY = "mboacoin-draft-annonce";

export default function PublishPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState("Studio");
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rooms, setRooms] = useState("");
  const [area, setArea] = useState("");
  const [advance, setAdvance] = useState("");
  const [deposit, setDeposit] = useState("");
  const [furnishing, setFurnishing] = useState("non_meuble");
  const [water, setWater] = useState("");
  const [electricity, setElectricity] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [availableNow, setAvailableNow] = useState(true);
  const [availableFrom, setAvailableFrom] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restauration : true = brouillon détecté, on propose de reprendre
  const [draftFound, setDraftFound] = useState(false);
  // "checking" = on regarde s'il y a un brouillon ; "blocked" = bandeau affiché, saisie non reprise ; "active" = on peut sauvegarder
  const [saveMode, setSaveMode] = useState<"checking" | "blocked" | "active">("checking");

// Au chargement : détecter un brouillon sauvegardé
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title || d.description || d.city || d.price) {
          setDraftFound(true);
          setSaveMode("blocked"); // on bloque la sauvegarde tant qu'on n'a pas décidé
          return;
        }
      }
    } catch {
      // ignore
    }
    setSaveMode("active"); // pas de brouillon : on peut sauvegarder normalement
  }, []);

// Sauvegarde automatique, seulement en mode "active"
  useEffect(() => {
    if (saveMode !== "active") return;
    const data = {
      type, title, city, neighborhood, address, price, bedrooms, bathrooms,
      rooms, area, advance, deposit, furnishing, water, electricity,
      amenities, availableNow, availableFrom, description,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [
    saveMode, type, title, city, neighborhood, address, price, bedrooms, bathrooms,
    rooms, area, advance, deposit, furnishing, water, electricity,
    amenities, availableNow, availableFrom, description,
  ]);

function restoreDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      setType(d.type ?? "Studio");
      setTitle(d.title ?? "");
      setCity(d.city ?? "");
      setNeighborhood(d.neighborhood ?? "");
      setAddress(d.address ?? "");
      setPrice(d.price ?? "");
      setBedrooms(d.bedrooms ?? "");
      setBathrooms(d.bathrooms ?? "");
      setRooms(d.rooms ?? "");
      setArea(d.area ?? "");
      setAdvance(d.advance ?? "");
      setDeposit(d.deposit ?? "");
      setFurnishing(d.furnishing ?? "non_meuble");
      setWater(d.water ?? "");
      setElectricity(d.electricity ?? "");
      setAmenities(Array.isArray(d.amenities) ? d.amenities : []);
      setAvailableNow(d.availableNow ?? true);
      setAvailableFrom(d.availableFrom ?? "");
      setDescription(d.description ?? "");
    } catch {
      // ignore
    }
    setDraftFound(false);
    setSaveMode("active"); // à partir de maintenant, on sauvegarde les modifications
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setDraftFound(false);
    setSaveMode("active"); // on repart de zéro, sauvegarde active
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 6);
    setFiles(picked);
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const titleV = title.trim();
    const cityV = city.trim();
    const neighborhoodV = neighborhood.trim();
    const priceV = Number(price);

    // Validation des champs obligatoires
    if (files.length === 0) {
      setError("Ajoutez au moins une photo.");
      return;
    }
    if (!titleV) {
      setError("Le titre est obligatoire.");
      return;
    }
    if (!cityV) {
      setError("La ville est obligatoire.");
      return;
    }
    if (!neighborhoodV) {
      setError("Le quartier est obligatoire.");
      return;
    }
    if (!priceV || priceV <= 0) {
      setError("Indiquez un prix valide.");
      return;
    }
    if (description.trim().length < 20) {
      setError("La description doit faire au moins 20 caractères.");
      return;
    }

    setLoading(true);
    const result = await createListing({
      title: titleV,
      propertyType: type,
      city: cityV,
      neighborhood: neighborhoodV,
      addressDescription: address.trim() || null,
      price: priceV,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      rooms: Number(rooms) || null,
      area: Number(area) || null,
      advanceMonths: Number(advance) || 1,
      depositMonths: Number(deposit) || 1,
      furnishing,
      water: water || null,
      electricity: electricity || null,
      amenities,
      availableFrom: availableNow ? null : availableFrom || null,
      description: description,
      files,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    clearDraft(); // publication réussie : on efface le brouillon
    router.push(`/listings/${result.id}`);
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Publier une annonce" subtitle="Décrivez votre bien pour le mettre en ligne." />

      {/* Bandeau de reprise de brouillon */}
      {draftFound && (
        <div className="mx-5 mb-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <p className="text-sm font-bold">Reprendre votre annonce ?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vous avez une annonce non terminée. Souhaitez-vous la reprendre là où vous vous êtes arrêté ?
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" className="flex-1" onClick={restoreDraft}>Reprendre</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={discardDraft}>Recommencer</Button>
          </div>
        </div>
      )}

      <p className="px-5 pb-1 text-xs text-muted-foreground">
        Les champs marqués d&apos;un <span className="text-destructive">*</span> sont obligatoires.
      </p>
      <form onSubmit={submit} className="space-y-6 px-5">
        {/* Photos */}
        <div>
          <label className="field-label">Photos (max 6)<span className="text-destructive"> *</span></label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center">
            <Icon name="add_a_photo" size={28} className="text-muted-foreground" filled={false} />
            <span className="text-sm font-medium text-muted-foreground">
              {files.length > 0 ? `${files.length} photo(s) sélectionnée(s)` : "Ajouter des photos"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onPick}
              className="hidden"
            />
          </label>
        </div>

        {/* Type */}
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

        {/* Titre */}
        <div>
          <label htmlFor="title" className="field-label">
            Titre<span className="text-destructive"> *</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Appartement standing"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="city" className="field-label">
              Ville<span className="text-destructive"> *</span>
            </label>
            <input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Douala"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="neighborhood" className="field-label">
              Quartier<span className="text-destructive"> *</span>
            </label>
            <input
              id="neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Akwa"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="field-label">
            Adresse / indications <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="Ex : derrière la station Total, à 100m du carrefour Ndokoti"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        <div>
          <label htmlFor="price" className="field-label">
            Loyer mensuel (FCFA)<span className="text-destructive"> *</span>
          </label>
          <input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="150000"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="rooms" className="field-label">Pièces</label>
            <input
              id="rooms"
              type="number"
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              placeholder="3"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="bedrooms" className="field-label">Chambres</label>
            <input
              id="bedrooms"
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              placeholder="2"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="bathrooms" className="field-label">Douches</label>
            <input
              id="bathrooms"
              type="number"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              placeholder="1"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="area" className="field-label">
            Superficie (m²) <span className="font-normal text-muted-foreground">(optionnel)</span>
          </label>
          <input
            id="area"
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ex : 75"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="advance" className="field-label">Avance (mois)</label>
            <input
              id="advance"
              type="number"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="3"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="deposit" className="field-label">Caution (mois)</label>
            <input
              id="deposit"
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="2"
              className={inputCls}
            />
          </div>
        </div>

        {/* Ameublement */}
        <div>
          <label htmlFor="furnishing" className="field-label">Ameublement</label>
          <select
            id="furnishing"
            value={furnishing}
            onChange={(e) => setFurnishing(e.target.value)}
            className={inputCls}
          >
            <option value="non_meuble">Non meublé</option>
            <option value="semi_meuble">Semi-meublé</option>
            <option value="meuble">Meublé</option>
          </select>
        </div>

        {/* Eau et électricité */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="water" className="field-label">Eau</label>
            <select
              id="water"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            >
              <option value="">Non précisé</option>
              <option value="forage">Forage</option>
              <option value="camwater">Camwater</option>
              <option value="forage_camwater">Forage + Camwater</option>
            </select>
          </div>
          <div>
            <label htmlFor="electricity" className="field-label">Électricité</label>
            <select
              id="electricity"
              value={electricity}
              onChange={(e) => setElectricity(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            >
              <option value="">Non précisé</option>
              <option value="prepaye">Compteur prépayé</option>
              <option value="postpaye">Compteur postpayé</option>
              <option value="incluse">Incluse dans le loyer</option>
            </select>
          </div>
        </div>

        {/* Commodités */}
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

        {/* Description */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="description" className="field-label">Description<span className="text-destructive"> *</span></label>
            <span
              className={
                description.length >= 1500
                  ? "text-xs font-medium text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {description.length} / 1500
            </span>
          </div>
          <textarea
            id="description"
            rows={5}
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le bien : commodités (eau, électricité), quartier, conditions, ce qui le rend unique..."
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        {/* Disponibilité */}
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
              className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            />
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Publication en cours..." : "Publier l'annonce"}
        </Button>
      </form>
    </div>
  );
}