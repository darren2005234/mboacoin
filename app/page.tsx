import { ListingCard, type Listing } from "@/components/mboacoin/listing-card";

const DEMO: Listing[] = [
  {
    id: "1",
    title: "Appartement standing",
    location: "Bastos, Yaoundé",
    price: 350000,
    priceSuffix: "/ mois",
    image: "/img/listings/demo-1.jpg",
    verified: true,
    bedrooms: 3,
    favorite: true,
  },
  {
    id: "2",
    title: "Studio moderne",
    location: "Akwa, Douala",
    price: 150000,
    priceSuffix: "/ mois",
    image: "/img/listings/demo-1.jpg",
    verified: false,
    bedrooms: 1,
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4">
      <h1 className="text-lg font-bold">Annonces récentes</h1>
      {DEMO.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </main>
  );
}