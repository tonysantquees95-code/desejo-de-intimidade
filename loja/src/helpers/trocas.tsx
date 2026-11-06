/**
 * Trocas e devoluções: os tipos de solicitação, o que a cliente prefere, os estados que a loja usa no painel
 * e a mensagem que vai pronta para o WhatsApp (o robô reconhece essa mensagem e responde).
 */
export const TIPOS_TROCA = {
  arrependimento: "Desisti da compra",
  defeito: "Produto com defeito",
  errado: "Produto errado, faltando ou avariado na entrega",
  troca: "Troca por tamanho, cor ou modelo",
} as const;
export type TipoTroca = keyof typeof TIPOS_TROCA;
export const TIPOS_TROCA_IDS = Object.keys(TIPOS_TROCA) as [TipoTroca, ...TipoTroca[]];

/** Explicação curta de cada tipo, embaixo da opção no formulário. */
export const AJUDA_TIPO: Record<TipoTroca, string> = {
  arrependimento: "Até 7 dias depois de receber, sem precisar explicar. Produto sem uso; os de uso íntimo, lacrados. A loja paga o frete de volta.",
  defeito: "Até 30 dias (géis e cosméticos) ou 90 dias (brinquedos, lingerie e acessórios) depois de receber. A loja paga o frete.",
  errado: "Avise em até 7 dias depois de receber. A loja paga o frete.",
  troca: "Só lingerie e fantasias, sem uso e com etiqueta, até 30 dias depois de receber. O frete fica por conta da cliente.",
};

export const PREFERENCIAS_TROCA = {
  reembolso: "Reembolso do valor",
  mesmo: "Trocar pelo mesmo produto",
  outro: "Trocar por outro produto",
} as const;
export type PreferenciaTroca = keyof typeof PREFERENCIAS_TROCA;
export const PREFERENCIAS_TROCA_IDS = Object.keys(PREFERENCIAS_TROCA) as [PreferenciaTroca, ...PreferenciaTroca[]];

export const ESTADOS_TROCA = {
  nova: "Nova",
  analise: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  concluida: "Concluída",
} as const;
export type EstadoTroca = keyof typeof ESTADOS_TROCA;
export const ESTADOS_TROCA_IDS = Object.keys(ESTADOS_TROCA) as [EstadoTroca, ...EstadoTroca[]];

/** O prazo que o robô e o site prometem para a loja responder. */
export const PRAZO_RESPOSTA_TROCA = "2 dias úteis";

export function nomeTipo(t: string): string {
  return (TIPOS_TROCA as Record<string, string>)[t] ?? t;
}
export function nomePreferencia(p: string): string {
  return (PREFERENCIAS_TROCA as Record<string, string>)[p] ?? p;
}

/** A mensagem que a cliente manda no WhatsApp depois de preencher a solicitação. */
export function mensagemDaSolicitacao(s: { id: number; orderId: number; tipo: string; preferencia: string; itens: string; descricao: string }): string {
  return [
    `Olá! Abri a solicitação de troca/devolução nº ${s.id} no site da Desejo de Intimidade.`,
    "",
    `Pedido: #${s.orderId}`,
    `Motivo: ${nomeTipo(s.tipo)}`,
    `Prefiro: ${nomePreferencia(s.preferencia)}`,
    `Itens: ${s.itens}`,
    `O que aconteceu: ${s.descricao}`,
    "",
    "Vou mandar as fotos e o vídeo aqui na conversa.",
  ].join("\n");
}

/** Reconhece a mensagem acima (texto já normalizado: minúsculas e sem acento). */
export const RE_SOLICITACAO_TROCA = /solicitacao de troca\/devolucao n\D{0,3}(\d+)/;
/** Reconhece a mensagem que o site manda depois da compra ("Fiz o pedido #12 no site..."), já normalizada. */
export const RE_PEDIDO_FEITO = /fiz o pedido #\s?(\d+) no site/;
/** Mensagem do botão "Avisar a loja da compra" do motoboy (normalizada). */
export const RE_PEDIDO_MOTOBOY = /acabei de fazer um pedido no site e escolhi a entrega via motoboy/;