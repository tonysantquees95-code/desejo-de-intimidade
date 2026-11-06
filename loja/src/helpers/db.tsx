import { Kysely, CamelCasePlugin } from "kysely";
import { env } from "cloudflare:workers";
import { DialetoD1 } from "../../worker/d1";
import { DB, kyselyIdentifierOverrides } from "./schema";

// kysely's CamelCasePlugin can't recover a snake_case name that has an
// underscore directly before a digit (reminder_48h_sent -> reminder48hSent ->
// reminder48h_sent). The generated schema exports the exact spelling for such
// identifiers; everything else falls through to the default mapping.
class FlootCamelCasePlugin extends CamelCasePlugin {
  protected override snakeCase(str: string): string {
    return kyselyIdentifierOverrides[str] ?? super.snakeCase(str);
  }
}

// No Cloudflare o banco é o D1 (binding DB do wrangler.toml), no lugar do Postgres do Floot.
export const db = new Kysely<DB>({
  plugins: [new FlootCamelCasePlugin()],
  dialect: new DialetoD1(() => (env as unknown as { DB: never }).DB),
});
