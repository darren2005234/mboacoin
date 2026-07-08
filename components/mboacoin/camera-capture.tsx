"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";

export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError(
          "Impossible d'accéder à la caméra. Autorisez l'accès à la caméra dans votre navigateur, puis réessayez."
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        onCapture(file);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Barre du haut, en superposition */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 text-white">
        <button onClick={onCancel} aria-label="Annuler">
          <Icon name="close" size={26} />
        </button>
        <p className="text-sm font-semibold">Prenez votre photo</p>
        <span className="size-6" />
      </div>

      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white">
          <Icon name="videocam_off" size={40} />
          <p className="text-sm">{error}</p>
          <Button variant="outline" onClick={onCancel}>Retour</Button>
        </div>
      ) : (
        <>
          {/* La vidéo occupe tout l'écran */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {/* Bouton de capture EN SUPERPOSITION, toujours visible en bas */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center pb-10">
            <button
              onClick={capture}
              aria-label="Prendre la photo"
              className="grid size-16 place-items-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-95"
            >
              <span className="size-12 rounded-full bg-white" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}