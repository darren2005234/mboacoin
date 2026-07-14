"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/mboacoin/icon";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS, type CreateSupportTicketInput } from "@/lib/support";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

/**
 * Formulaire de création de ticket, partagé par le visiteur (contact requis)
 * et l'utilisateur connecté (identité déjà rattachée, pas de champ contact).
 * Ne promet jamais d'issue ni de délai dans ses libellés (règle du produit :
 * le support reçoit, trace, oriente — il ne tranche pas).
 */
export function SupportTicketForm({
  requireContact,
  busy,
  error,
  onSubmit,
}: {
  requireContact: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (input: CreateSupportTicketInput) => void;
}) {
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const hasContact = contactEmail.trim().length > 0 || contactPhone.trim().length > 0;
  const canSubmit =
    subject.trim().length > 0 && description.trim().length > 0 && (!requireContact || hasContact) && !busy;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      category,
      subject: subject.trim(),
      description: description.trim(),
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      files,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="support-category">
          Catégorie
        </label>
        <select
          id="support-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputCls}
        >
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPORT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="support-subject">
          Sujet
        </label>
        <input
          id="support-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Résumez votre demande en quelques mots"
          className={inputCls}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="support-description">
          Description
        </label>
        <textarea
          id="support-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Décrivez votre situation le plus précisément possible : dates, montants, personnes concernées..."
          className={inputCls}
        />
      </div>

      {requireContact && (
        <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
          <p className="text-xs font-semibold">
            Comment vous répondre ? Laissez un email ou un numéro — un lien de suivi vous sera montré après l&apos;envoi.
          </p>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email"
            className={inputCls}
          />
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Numéro de téléphone"
            className={inputCls}
          />
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="support-files">
          Captures d&apos;écran (facultatif)
        </label>
        <input
          id="support-files"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="w-full text-xs"
        />
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Nous recevons votre demande et l&apos;examinerons. MboaCoin ne tranche pas les litiges entre bailleur et
        locataire, mais peut vous transmettre les éléments en sa possession (quittances, état des lieux...).
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {busy ? (
          "Envoi en cours..."
        ) : (
          <>
            <Icon name="send" size={18} /> Envoyer
          </>
        )}
      </Button>
    </form>
  );
}
