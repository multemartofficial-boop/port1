import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const Route = createFileRoute("/admin_/products/$id/edit")({
  head: () => ({ meta: [{ title: "Edit product — Yours admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: EditProduct,
});

function EditProduct() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const { id } = useParams({ from: "/admin_/products/$id/edit" });
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);
  if (loading || !user) return <div className="min-h-screen grid place-items-center bg-background text-sm">Loading…</div>;
  if (!isAdmin) return <div className="min-h-screen grid place-items-center text-sm">Not authorised</div>;
  return <ProductEditor productId={id} />;
}
