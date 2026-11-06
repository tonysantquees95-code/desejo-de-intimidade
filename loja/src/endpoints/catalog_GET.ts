import superjson from "superjson";
import { loadCatalog } from "../helpers/loadCatalog";

export async function handle(_request: Request) {
  try {
    return new Response(superjson.stringify(await loadCatalog()));
  } catch (error) {
    console.error("catalog error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar o catálogo." }),
      { status: 500 },
    );
  }
}