"use client";

import { useEffect } from "react";
import { recordListingView } from "@/lib/listing-views";

export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    recordListingView(listingId);
  }, [listingId]);
  return null;
}