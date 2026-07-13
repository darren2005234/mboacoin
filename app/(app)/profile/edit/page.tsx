"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Button } from "@/components/ui/button";
import { getMyProfileForEdit, updateMyProfile } from "@/lib/edit-profile";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/account-types";
import { loginUrl } from "@/lib/auth-redirect";

export default function EditProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [accountType, setAccountType] = useState("personne_physique");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState("");

  useEffect(() => {
    (async () => {
      const data = await getMyProfileForEdit();
      if (!data) {
        router.push(loginUrl());
        return;
      }
      setFullName(data.fullName);
      setCity(data.city);
      setAccountType(data.accountType);
      setEmail(data.email);
      setBio(data.bio);
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    setError(null);
    if (!fullName.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    const result = await updateMyProfile({ fullName, city, email, bio, accountType });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    setTimeout(() => router.push("/profile"), 800);
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Modifier mon profil" subtitle="Mettez à jour vos informations." />

      <div className="space-y-5 px-5">
        <div>
          <label className="field-label">Nom complet</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Ex : Darren Touopi" />
        </div>

        <div>
          <label className="field-label">Ville</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Ex : Douala" />
        </div>

        <div>
          <label className="field-label">Type de compte</label>
          <div className="flex flex-col gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAccountType(t)}
                className={
                  accountType === t
                    ? "rounded-xl bg-primary px-4 py-3 text-left text-sm font-bold text-primary-foreground"
                    : "rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                }
              >
                {ACCOUNT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">
            Adresse e-mail <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="votre@email.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Une adresse secondaire pour être contacté ou retrouver votre compte.
          </p>
          <div>
            <label className="field-label">
                Bio <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Présentez-vous en quelques mots..."
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            />
            <p className="mt-1 text-xs text-muted-foreground">{bio.length} / 300</p>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {saved && <p className="text-sm font-medium text-ok-text">Profil mis à jour.</p>}

        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}