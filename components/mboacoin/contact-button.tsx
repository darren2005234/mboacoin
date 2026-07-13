"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openConversation } from "@/lib/conversations";
import { loginUrl } from "@/lib/auth-redirect";

interface ContactButtonProps {
  listingId: string;
  ownerId: string;
}

export function ContactButton({ listingId, ownerId }: ContactButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const result = await openConversation(listingId, ownerId);

    if (result.error === "not-authenticated") {
      router.push(loginUrl());
      return;
    }
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/messages/${result.id}`);
  }

  return (
    <div className="flex-1">
      <Button variant="outline" size="lg" className="w-full" onClick={handleClick} disabled={loading}>
        <MessageSquare className="size-5" /> {loading ? "..." : "Chat"}
      </Button>
      {error && <p className="mt-1 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}