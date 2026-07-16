"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getMessageAttachmentSignedUrl, type MessageAttachment } from "@/lib/messages";

/** Miniatures des pièces jointes d'un message, clic → ouverture plein écran (Lightbox du parent). */
export function MessageImages({
  attachments,
  onZoom,
}: {
  attachments: MessageAttachment[];
  onZoom: (images: string[], index: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(attachments.map((a) => getMessageAttachmentSignedUrl(a.storagePath))).then((resolved) => {
      if (!cancelled) setUrls(resolved.filter((u): u is string => !!u));
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (urls.length === 0) return null;

  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
      {urls.map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => onZoom(urls, i)}
          className="relative aspect-square w-full overflow-hidden rounded-xl"
        >
          <Image src={url} alt="" fill className="object-cover" sizes="160px" unoptimized />
        </button>
      ))}
    </div>
  );
}
