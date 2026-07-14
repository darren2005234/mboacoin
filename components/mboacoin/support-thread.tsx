"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { getSupportAttachmentSignedUrl, type SupportAttachment, type SupportThreadMessage } from "@/lib/support";

function AttachmentLink({ attachment }: { attachment: SupportAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    getSupportAttachmentSignedUrl(attachment.storagePath).then(setUrl);
  }, [attachment.storagePath]);

  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold text-accent underline"
    >
      <Icon name="image" size={14} /> Pièce jointe
    </a>
  );
}

/** Fil d'un ticket de support (lecture + réponse) — partagé par la vue connectée et la vue visiteur par jeton. */
export function SupportThread({
  description,
  descriptionAttachments,
  messages,
  onSendMessage,
  disabled,
  allowAttachments = true,
}: {
  description: string;
  descriptionAttachments: SupportAttachment[];
  messages: SupportThreadMessage[];
  onSendMessage: (body: string, files: File[]) => Promise<{ error?: string }>;
  disabled?: boolean;
  allowAttachments?: boolean;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSendMessage(body, files);
    if (result.error) {
      setError(result.error);
    } else {
      setBody("");
      setFiles([]);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-sm">{description}</p>
        {descriptionAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {descriptionAttachments.map((a) => (
              <AttachmentLink key={a.id} attachment={a} />
            ))}
          </div>
        )}
      </div>

      {messages.map((m) => (
        <div
          key={m.id}
          className={`space-y-2 rounded-2xl border p-4 shadow-card ${
            m.isAdmin ? "border-accent/30 bg-accent/5" : "border-border bg-card"
          }`}
        >
          <p className="text-xs font-bold text-muted-foreground">
            {m.isAdmin ? "MboaCoin" : "Vous"} · {new Date(m.createdAt).toLocaleDateString("fr-FR")}
          </p>
          <p className="text-sm">{m.body}</p>
          {m.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {m.attachments.map((a) => (
                <AttachmentLink key={a.id} attachment={a} />
              ))}
            </div>
          )}
        </div>
      ))}

      {!disabled && (
        <form onSubmit={submit} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Écrire un message..."
            className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
          {allowAttachments && (
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-xs"
            />
          )}
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={!body.trim() || busy}>
            {busy ? "Envoi..." : "Envoyer"}
          </Button>
        </form>
      )}
    </div>
  );
}
