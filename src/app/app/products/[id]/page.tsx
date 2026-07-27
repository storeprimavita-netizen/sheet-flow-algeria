import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ProductForm } from "../product-form";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: product }, { data: cost }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("*").eq("product_id", id).maybeSingle(),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <ProductForm product={product} cost={cost} />
      <div className="flex justify-end border-t border-border pt-4">
        <DeleteButton table="products" id={product.id} redirectTo="/app/products" />
      </div>
    </div>
  );
}
