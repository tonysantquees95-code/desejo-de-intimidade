import superjson from "superjson";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import { regionFromCep } from "../../helpers/regionFromCep";
import { loadQuoteLines, quoteShipping } from "../../helpers/quoteShipping";
import { quoteMotoboy } from "../../helpers/motoboy";
import {
  schema,
  type OutputType,
  type ShippingOption,
} from "./shipping_quote_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const config = await loadShippingConfig();
    const options: ShippingOption[] = [];
    let motoboyNote: string | null = null;

    if (input.cep && regionFromCep(input.cep) && input.items.length > 0) {
      const lines = await loadQuoteLines(input.items, config);
      const quotes = await quoteShipping({ config, cep: input.cep, lines });
      for (const q of quotes) {
        options.push({ method: "correios", ...q });
      }
      const moto = await quoteMotoboy(config, input.cep);
      if (moto.ok) {
        options.push({ method: "motoboy", priceCents: moto.priceCents, days: 1, km: moto.km });
      } else if (moto.reason === "longe") {
        motoboyNote = `O motoboy atende até ${moto.maxKm} km da loja e o seu endereço fica a cerca de ${Math.round(moto.km ?? 0)} km.`;
      }
    }
    if (config.pickup.enabled) {
      options.push({
        method: "pickup",
        priceCents: 0,
        address: config.pickup.address,
        note: config.pickup.note,
      });
    }
    return new Response(superjson.stringify({ options, motoboyNote } satisfies OutputType));
  } catch (error) {
    console.error("shipping quote error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível calcular o frete." }),
      { status: 400 },
    );
  }
}