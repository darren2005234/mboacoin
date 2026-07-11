"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { createResidence } from "@/lib/residences";
import imageCompression from "browser-image-compression";

export function NewResidenceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [addressDescription, setAddressDescription] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setCompressing(true);
    try {
      if (!picked.type.startsWith("image/")) {
        setFile(picked);
        return;
      }
      try {
        const compressed = await imageCompression(picked, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
        setFile(compressed);
      } catch {
        setFile(picked); // si la compression échoue, on garde l'originale
      }
    } finally {
      setCompressing(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const nameV = name.trim();
    const cityV = city.trim();

    if (!nameV) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!cityV) {
      setError("La ville est obligatoire.");
      return;
    }

    setLoading(true);
    const result = await createResidence({
      name: nameV,
      city: cityV,
      neighborhood: neighborhood.trim() || null,
      addressDescription: addressDescription.trim() || null,
      description: description.trim() || null,
      file,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/my-residences");
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Créer une résidence" subtitle="Décrivez votre résidence pour pouvoir y rattacher des logements." />

      <p className="px-5 pb-1 text-xs text-muted-foreground">
        Les champs marqués d&apos;un <span className="text-destructive">*</span> sont obligatoires.
      </p>
      <form onSubmit={submit} className="space-y-6 px-5">
        {/* Photo */}
        <div>
          <label className="field-label">Photo <span className="font-normal text-muted-foreground">(facultatif)</span></label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center">
            <Icon name="add_a_photo" size={28} className="text-muted-foreground" filled={false} />
            <span className="text-sm font-medium text-muted-foreground">
              {compressing ? "Optimisation..." : file ? file.name : "Ajouter une photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              className="hidden"
            />
          </label>
        </div>

        {/* Nom */}
        <div>
          <label htmlFor="name" className="field-label">
            Nom<span className="text-destructive"> *</span>
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Résidence Les Palmiers"
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
              Quartier <span className="font-normal text-muted-foreground">(facultatif)</span>
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
            value={addressDescription}
            onChange={(e) => setAddressDescription(e.target.value)}
            rows={2}
            placeholder="Ex : derrière la station Total, à 100m du carrefour Ndokoti"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="description" className="field-label">
              Description <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
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
            placeholder="Décrivez la résidence : équipements communs, sécurité, ambiance..."
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading || compressing}>
          {loading ? "Création en cours..." : compressing ? "Optimisation..." : "Créer la résidence"}
        </Button>
      </form>
    </div>
  );
}
