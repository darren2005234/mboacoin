"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/components/mboacoin/avatar";
import { Icon } from "@/components/mboacoin/icon";
import { uploadAvatar } from "@/lib/avatar";

interface EditableAvatarProps {
  name: string;
  initialSrc: string | null;
  size?: number;
}

/** Avatar cliquable qui permet de changer sa photo de profil. */
export function EditableAvatar({ name, initialSrc, size = 80 }: EditableAvatarProps) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const result = await uploadAvatar(file);
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      setSrc(result.url);
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative"
        aria-label="Changer la photo de profil"
      >
        <Avatar name={name} src={src} size={size} />
        <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground">
          <Icon name="photo_camera" size={14} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
      {uploading && <p className="text-xs text-muted-foreground">Envoi...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}