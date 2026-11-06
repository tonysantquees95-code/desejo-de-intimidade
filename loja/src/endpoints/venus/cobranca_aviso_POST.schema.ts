/**
 * Aviso de pagamento da InfinitePay (webhook dos links de cobrança que a Vênus app cria para lojistas sem site).
 * O corpo não tem assinatura: só guardamos os códigos, e quem confirma o pagamento é a própria InfinitePay
 * (payment_check) quando o app pergunta em /_api/venus/cobranca_status.
 */
export type OutputType = { ok: true };