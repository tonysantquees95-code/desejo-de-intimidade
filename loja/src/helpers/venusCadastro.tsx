const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9$,. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "cadastrar produto", "novo produto gel X"… Devolve o nome, se a pessoa já disse. */
function querCadastrar(frase: string): { nome: string } | null {
  const c = norm(frase);
  const inicio = "(?:(?:vamos|quero|preciso|pode|bora|por favor|favor|vou) )*";
  const direto = new RegExp(`^${inicio}(?:cadastr\\w*|cri\\w*|lanc\\w*) (?:um |o |outro )?(?:novo |nova )?produto\\b`).test(c);
  const brando = new RegExp(`^${inicio}(?:adicion\\w*|inclu\\w*|registr\\w*) (?:um |outro )?(?:novo produto|produto novo)\\b`).test(c);
  const solto = /^(?:um )?(?:novo produto|produto novo|cadastro de produto)\b/.test(c);
  if (!direto && !brando && !solto) return null;
  const resto = frase
    .replace(/^.*?(?:produto novo|novo produto|cadastro de produto|produto)\s*/i, "")
    .replace(/^(?:novo|nova)\s+/i, "")
    .replace(/^(?:(?:chamad[oa]|de nome|com o nome|nome)\s+|[:\-,]\s*)+/i, "")
    .trim();
  return { nome: resto };
}

export const venusCadastro = { querCadastrar };
