import { gerarHashSenha } from "./senha";

export async function generatePasswordHash(password: string) {
  // No Cloudflare o bcrypt passa do limite de CPU; usamos PBKDF2 (nativo), ver helpers/senha.
  return gerarHashSenha(password);
}
