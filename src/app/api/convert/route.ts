import { extractDiagram, PREFERRED_MODEL } from "@/lib/extract-diagram";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

function isConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
  );
}

export async function GET() {
  return Response.json({
    configured: isConfigured(),
    model: PREFERRED_MODEL,
  });
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return Response.json(
      {
        error:
          "Falta configurar la IA. Crea un archivo .env.local con AI_GATEWAY_API_KEY (vercel.com/ai-gateway) y reinicia el servidor.",
        code: "NO_AI_KEY",
      },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "El archivo supera 15 MB. Exporta el PDF más liviano e inténtalo de nuevo." },
      { status: 413 },
    );
  }

  const pageFiles = form
    .getAll("page")
    .filter((value): value is File => value instanceof File)
    .slice(0, 2);

  if (!pageFiles.length) {
    return Response.json(
      {
        error:
          "No se recibieron capturas de página. Sube de nuevo el PDF para que se rasterice el diagrama.",
      },
      { status: 400 },
    );
  }

  const content: Parameters<typeof extractDiagram>[0] = [];

  for (const [index, page] of pageFiles.entries()) {
    const type = page.type || "image/jpeg";
    content.push({
      type: "file",
      data: new Uint8Array(await page.arrayBuffer()),
      mediaType: type.startsWith("image/") ? type : "image/jpeg",
      filename: page.name || `page-${index + 1}.jpg`,
    });
  }

  const { result, model, failures } = await extractDiagram(content);
  if (result?.diagrams.length) {
    console.info(`[convert] modelo usado: ${model}`);
    return Response.json({
      diagrams: result.diagrams,
      sourceName: file.name,
      model,
    });
  }

  return Response.json(
    {
      error:
        failures.find((item) => !/did not match schema|No object generated/i.test(item)) ??
        "Gemini no pudo reconstruir el diagrama. Vuelve a intentar; si persiste, usa una captura más nítida o una sola página.",
      detail: failures,
    },
    { status: 422 },
  );
}
