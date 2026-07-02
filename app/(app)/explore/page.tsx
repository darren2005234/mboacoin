import { ListingCard } from "@/components/mboacoin/listing-card";
import { getPublishedListings } from "@/lib/listings";
import { Bell, Search, SlidersHorizontal } from "lucide-react";

const CATEGORIES = ["Studios", "Appartements", "Villas", "Chambres", "Meublés"];

export default async function ExplorePage() {
  const listings = await getPublishedListings();

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] text-muted-foreground">Bonjour,</p>
          <p className="text-sm font-bold">Samuel N.</p>
        </div>
        <button aria-label="Notifications" className="text-muted-foreground">
          <Bell className="size-5" />
        </button>
      </header>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5 shadow-card">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="Ville, quartier, budget..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <SlidersHorizontal className="size-4 text-primary" />
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 text-xs">
        {CATEGORIES.map((c, i) => (
          <button
            key={c}
            className={
              i === 0
                ? "whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground shadow-btn"
                : "whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-1.5 font-medium text-muted-foreground"
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold">Annonces récentes ({listings.length})</p>
          <span className="text-[11px] font-semibold text-primary">Voir tout</span>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-bold">Aucune annonce pour l&apos;instant</p>
            <p className="text-xs text-muted-foreground">
              Les annonces publiées apparaîtront ici.
            </p>
          </div>
        ) : (
          listings.map((l) => <ListingCard key={l.id} listing={l} />)
        )}
      </div>
    </div>
  );
}