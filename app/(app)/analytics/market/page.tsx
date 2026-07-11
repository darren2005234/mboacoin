import { requireAccountType } from "@/lib/profile";
import { MarketDataView } from "@/components/mboacoin/market-data-view";

export default async function MarketDataPage() {
  await requireAccountType("agence");
  return <MarketDataView />;
}
