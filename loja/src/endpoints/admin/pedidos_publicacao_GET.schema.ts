/** Para a Vênus app: pedidos novos da página Publicações (já marcados como "fazendo"). */
export type PedidoParaApp = {
  id: number;
  tipo: string;
  turno: string | null;
  ideiaRef: string | null;
  ideiaTitulo: string | null;
  quando: Date | null;
  legenda: string | null;
};
export type OutputType = { pedidos: PedidoParaApp[] };