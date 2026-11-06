import superjson from "superjson";
import { nanoid } from "nanoid";
import { upload } from "@floot/storage";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { schema, OutputType } from "./upload_POST.schema";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const filename = `produtos/${nanoid()}.${EXTENSIONS[input.contentType]}`;
    const result = await upload({
      visibility: "public",
      filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    if (!result.ok) {
      return new Response(
        superjson.stringify({ error: result.error.message }),
        { status: 400 },
      );
    }
    return new Response(
      superjson.stringify({
        presignedUrl: result.presignedUrl,
        headers: result.headers,
        url: result.url,
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("upload error", error);
    return new Response(
      superjson.stringify({
        error: "Imagem inválida. Use PNG, JPG, WEBP ou GIF de até 8 MB.",
      }),
      { status: 400 },
    );
  }
}