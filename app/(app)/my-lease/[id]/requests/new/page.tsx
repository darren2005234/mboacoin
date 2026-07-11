"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { createLeaseRequest, REQUEST_TYPES, REQUEST_TYPE_LABELS } from "@/lib/lease-requests";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

const MAX_PHOTOS = 5;

export default function NewLeaseRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [type, setType] = useState<string>(REQUEST_TYPES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    setFiles(picked);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const subjectV = subject.trim();
    const descriptionV = description.trim();
    if (!subjectV) {
      setError("Le sujet est obligatoire.");
      return;
    }
    if (!descriptionV) {
      setError("La description est obligatoire.");
      return;
    }

    setLoading(true);
    const result = await createLeaseRequest({
      leaseId: id,
      type,
      subject: subjectV,
      description: descriptionV,
      files,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/requests/${result.id}`);
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Nouvelle demande" subtitle="Décrivez votre demande, le bailleur y répondra dans l'app." />

      <form onSubmit={submit} className="space-y-5 px-5">
        <div>
          <label htmlFor="type" className="field-label">
            Type de demande<span className="text-destructive"> *</span>
          </label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="field-label">
            Sujet<span className="text-destructive"> *</span>
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex : Fuite d'eau sous l'évier"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="description" className="field-label">
            Description<span className="text-destructive"> *</span>
          </label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez la situation en détail..."
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        <div>
          <label className="field-label">
            Photos <span className="font-normal text-muted-foreground">(facultatif, {MAX_PHOTOS} max)</span>
          </label>
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

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Envoi en cours..." : "Envoyer la demande"}
        </Button>
      </form>
    </div>
  );
}
