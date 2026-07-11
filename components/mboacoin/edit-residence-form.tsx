"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { getResidenceForEdit, updateResidence } from "@/lib/residences";
import imageCompression from "browser-image-compression";

export function EditResidenceForm({ id }: { id: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [addressDescription, setAddressDescription] = useState("");
  const [description, setDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getResidenceForEdit(id);
      if (!data) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }
      setName(data.name);
      setCity(data.city);
      setNeighborhood(data.neighborhood);
      setAddressDescription(data.addressDescription);
      setDescription(data.description);
      setLoading(false);
    })();
  }, [id]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setCompressing(true);
    try {
      if (!picked.type.startsWith("image/")) {
        setNewFile(picked);
        return;
      }
      try {
        const compressed = await imageCompression(picked, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
        setNewFile(compressed);
      } catch {
        setNewFile(picked); // si la compression échoue, on garde l'originale
      }
    } finally {
      setCompressing(false);
    }
  }

  async function save() {
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

    setSaving(true);
    const result = await updateResidence(id, {
      name: nameV,
      city: cityV,
      neighborhood: neighborhood.trim() || null,
      addressDescription: addressDescription.trim() || null,
      description: description.trim() || null,
      newFile,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push("/my-residences");
  }

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (notAllowed) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm font-bold">Modification impossible</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette résidence n&apos;existe pas ou ne vous appartient pas.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Modifier la résidence" subtitle="Mettez à jour les informations de votre résidence." />

      <div className="space-y-6 px-5">
        <div>
          <label className="field-label">Photo <span className="font-normal text-muted-foreground">(facultatif)</span></label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center">
            <Icon name="add_a_photo" size={28} className="text-muted-foreground" filled={false} />
            <span className="text-sm font-medium text-muted-foreground">
              {compressing ? "Optimisation..." : newFile ? newFile.name : "Changer la photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <label className="field-label">Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
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

        <Button size="lg" className="w-full" onClick={save} disabled={saving || compressing}>
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  );
}
