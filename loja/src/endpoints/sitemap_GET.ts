import { db } from "../helpers/db";
import { SITE_URL } from "../helpers/siteUrl";
import { productCategories } from "../helpers/productCategories";

const day = (d: Date | string) => new Date(d).toISOString().split("T")[0];

/** Served at /sitemap.xml: home, category pages and every visible product. */
export async function handle(_request: Request) {
  const products = await db
    .selectFrom("products")
    .select(["id", "updatedAt"])
    .where("active", "=", true)
    .orderBy("id")
    .execute();

  const urls = [
    `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...productCategories.map(
      (c) =>
        `<url><loc>${SITE_URL}/categoria/${c.slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ),
    ...products.map(
      (p) =>
        `<url><loc>${SITE_URL}/produto/${p.id}</loc><lastmod>${day(p.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}