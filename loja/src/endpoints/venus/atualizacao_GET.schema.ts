/**
 * Canal público de atualização da Vênus e do Vênus Robô (para lojistas sem token do GitHub).
 * GET /_api/venus/atualizacao?app=venus|robo → a versão mais nova, com um link de download que vale poucos minutos.
 */
export type OutputType = {
  numero: number;
  tag: string;
  notas: string;
  tamanho: number;
  /** SHA-256 publicado pelo GitHub para o APK (vazio se não houver). */
  sha256: string;
  /** Link direto e temporário (alguns minutos) para baixar o APK. */
  url: string;
};