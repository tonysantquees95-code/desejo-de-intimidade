const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 8990 -> "R$ 89,90" */
export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}
