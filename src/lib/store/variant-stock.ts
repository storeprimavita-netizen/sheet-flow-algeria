/** D54.4 / D58: a size is out only when its own count plus the product's not-assigned pieces are used up. */
export function sizeInStock(variantStock: number, productStock: number, allVariantsStock: number): boolean {
  const unassigned = productStock - allVariantsStock;
  return variantStock + Math.max(0, unassigned) > 0;
}
