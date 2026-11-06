/**
 * GET /_api/venus/cobranca_status?ref=<order_nsu>&handle=<InfiniteTag>
 * O app pergunta se o link de cobrança da InfinitePay foi pago. Sem aviso ainda → pago=false.
 */
export type OutputType = { pago: boolean; avisado: boolean; valorCentavos: number | null; forma: string | null; recibo: string | null };