import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { gbp } from "@/lib/format";

export type ProductLite = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  compare_at_price: number | string | null;
  images: unknown;
  rating_avg?: number | string | null;
  review_count?: number | null;
  stock?: number | null;
  brand?: { name: string } | null;
};

export function ProductCard({ p }: { p: ProductLite }) {
  const price = typeof p.price === "string" ? parseFloat(p.price) : p.price;
  const compare = p.compare_at_price ? (typeof p.compare_at_price === "string" ? parseFloat(p.compare_at_price) : p.compare_at_price) : null;
  const onSale = compare && compare > price;
  const image = Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : "/images/cassette.jpg";
  const rating = Number(p.rating_avg ?? 0);
  const outOfStock = typeof p.stock === "number" && p.stock <= 0;
  return (
    <Link to="/products/$slug" params={{ slug: p.slug }} className="product-tile block rounded-lg overflow-hidden group">
      <div className="relative aspect-square bg-secondary">
        {onSale && !outOfStock && (
          <span className="absolute top-3 left-3 z-10 rounded-sm bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            Save {gbp(compare! - price)}
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 z-10 rounded-sm bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
            Out of stock
          </span>
        )}
        <img src={image} alt={p.name} loading="lazy" className={"absolute inset-0 h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-[1.04] " + (outOfStock ? "opacity-50 grayscale" : "")} />
      </div>
      <div className="p-4 border-t border-border">
        {p.brand?.name && <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.brand.name}</div>}
        <div className="mt-1 text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.name}</div>
        <div className="mt-2 flex items-center gap-1 text-amber-500">
          {[1,2,3,4,5].map(i => <Star key={i} className={"h-3.5 w-3.5 " + (i <= Math.round(rating) ? "fill-current" : "opacity-30")} />)}
          <span className="text-[11px] text-muted-foreground ml-1">({p.review_count ?? 0})</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-primary font-black">{gbp(price)}</span>
          {onSale && <span className="text-xs text-muted-foreground line-through">{gbp(compare!)}</span>}
        </div>
      </div>
    </Link>
  );
}
