"use client";

import { useEffect } from "react";
import { recordListingView } from "@/lib/listing-views";
import { createClient } from "@/lib/supabase/client";

export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    recordListingView(listingId);
    createClient()
      .rpc("increment_listing_view", { p_listing_id: listingId })
      .then(undefined, () => {
        // échec silencieux
      });
  }, [listingId]);
  return null;
}