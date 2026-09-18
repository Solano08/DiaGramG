import { extractDiagram, PREFERRED_MODEL } from "@/lib/extract-diagram";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const MAX_BYTES = 4.5 * 1024 * 1024;

function isConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
  );
}

function missingKeyMessage() {
  if (process.env.VERCEL) {
    return "Falta AI_GATEWAY_API_KEY en las variables de entorno del proyecto de Vercel (Settings → Environment Variables).";
  }
  return "Falta configurar la IA. Crea un archivo .env.local con AI_GATEWAY_API_KEY (vercel.com/ai-gateway) y reinicia el servidor.";
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
        error: missingKeyMessage(),
        code: "NO_AI_KEY",
      },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const sourceNameField = form.get("sourceName");
  const file = form.get("file");
  const sourceName =
    (typeof sourceNameField === "string" && sourceNameField.trim()) ||
    (file instanceof File ? file.name : "diagrama");

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

  const pageBytes = pageFiles.reduce((total, page) => total + page.size, 0);
  if (pageBytes > MAX_BYTES) {
    return Response.json(
      {
        error:
          "Las capturas superan 4.5 MB (límite de Vercel). Usa una sola página o un PDF más liviano.",
      },
      { status: 413 },
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
      sourceName,
      model,
    });
  }

  return Response.json(
    {
      error:
        failures.find((item) => !/did not match schema|No object generated/i.test(item)) ??
        "No se pudo reconstruir el diagrama. Vuelve a intentar; si persiste, usa una captura más nítida o una sola página.",
      detail: failures,
    },
    { status: 422 },
  );
}
