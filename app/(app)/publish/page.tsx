"use client";

import { useState } from "react";
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

export default function PublishPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState("Studio");
  const [description, setDescription] = useState("");
  const [furnishing, setFurnishing] = useState("non_meuble");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const form = new FormData(e.currentTarget);

    if (files.length === 0) {
      setError("Ajoutez au moins une photo.");
      return;
    }

    setLoading(true);
    const result = await createListing({
      title: String(form.get("title")),
      propertyType: type,
      city: String(form.get("city")),
      neighborhood: String(form.get("neighborhood")),
      price: Number(form.get("price")),
      bedrooms: Number(form.get("bedrooms")) || 0,
      bathrooms: Number(form.get("bathrooms")) || 0,
      advanceMonths: Number(form.get("advance")) || 1,
      depositMonths: Number(form.get("deposit")) || 1,
      furnishing,
      water: String(form.get("water")) || null,
      electricity: String(form.get("electricity")) || null,
      amenities,
      description: description,
      files,
    }); 

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/listings/${result.id}`);
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Publier une annonce" subtitle="Décrivez votre bien pour le mettre en ligne." />

      <form onSubmit={submit} className="space-y-6 px-5">
        {/* Photos */}
        <div>
          <label className="field-label">Photos (max 6)</label>
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

        <Field name="title" label="Titre" placeholder="Ex : Appartement standing" required />

        <div className="grid grid-cols-2 gap-3">
          <Field name="city" label="Ville" placeholder="Douala" required />
          <Field name="neighborhood" label="Quartier" placeholder="Akwa" required />
        </div>

        <Field name="price" label="Loyer mensuel (FCFA)" type="number" placeholder="150000" required />

        <div className="grid grid-cols-3 gap-3">
          <Field name="bedrooms" label="Chambres" type="number" placeholder="2" />
          <Field name="advance" label="Avance" type="number" placeholder="3" />
          <Field name="deposit" label="Caution" type="number" placeholder="2" />
        </div>

        {/* Ameublement (obligatoire) */}
        <div>
          <label htmlFor="furnishing" className="field-label">Ameublement</label>
          <select
            id="furnishing"
            value={furnishing}
            onChange={(e) => setFurnishing(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          >
            <option value="non_meuble">Non meublé</option>
            <option value="semi_meuble">Semi-meublé</option>
            <option value="meuble">Meublé</option>
          </select>
        </div>

        {/* Eau et électricité (optionnels) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="water" className="field-label">Eau</label>
            <select
              id="water"
              name="water"
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
              name="electricity"
              className="w-full rounded-xl border border-input bg-card px-3 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            >
              <option value="">Non précisé</option>
              <option value="prepaye">Compteur prépayé</option>
              <option value="postpaye">Compteur postpayé</option>
              <option value="incluse">Incluse dans le loyer</option>
            </select>
          </div>
        </div>

        <Field name="bathrooms" label="Salles d'eau (douches)" type="number" placeholder="2" />

        {/* Commodités (cases à cocher) */}
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
            <label htmlFor="description" className="field-label">Description</label>
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
            name="description"
            rows={5}
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le bien : commodités (eau, électricité), quartier, conditions, ce qui le rend unique..."
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Publication en cours..." : "Publier l'annonce"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
      />
    </div>
  );
}