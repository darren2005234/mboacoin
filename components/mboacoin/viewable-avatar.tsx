"use client";

import { useState } from "react";
import { Avatar } from "@/components/mboacoin/avatar";
import { Lightbox } from "@/components/mboacoin/lightbox";

interface ViewableAvatarProps {
  name: string;
  src: string | null;
  size?: number;
}

/** Avatar cliquable : si une photo existe, un clic l'ouvre en plein écran. */
export function ViewableAvatar({ name, src, size = 88 }: ViewableAvatarProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    // Pas de photo : on affiche juste les initiales, non cliquable
    return <Avatar name={name} src={null} size={size} />;
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Voir la photo en grand">
        <Avatar name={name} src={src} size={size} />
      </button>
      {open && <Lightbox images={[src]} onClose={() => setOpen(false)} />}
    </>
  );
}