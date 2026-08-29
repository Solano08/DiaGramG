import { generateText, NoObjectGeneratedError, Output } from "ai";
import { cleanConversion } from "./clean-diagram";
import {
  parseConversion,
  parseConversionText,
  pickConversion,
} from "./parse-diagram";
import { conversionModelSchema, type ConversionResult } from "./schema";

export const PREFERRED_MODEL = "google/gemini-2.5-flash";
export const MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
] as const;

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "file"; data: Uint8Array; mediaType: string; filename?: string };

const PROMPT = `Eres un transcriptor visual de diagramas. Copia lo que se VE en la imagen. No rediseñes, no resumas, no pongas todo en una sola fila.

RAZONA EN ESTE ORDEN (no escribas el razonamiento, solo el resultado):
1. Recorre la página de IZQUIERDA a DERECHA y de ARRIBA a ABAJO.
2. Cada recuadro, óvalo, rombo, cilindro o nota visible es un NODE distinto. Nunca fusiones dos cajas aunque el texto sea parecido.
3. Imagina una cuadrícula de 16 columnas (0–15) y 10 filas (0–9) encima de la página.
   - Cajas apiladas (Tower 1, Tower 2, Tower 3) = MISMA col, DISTINTA row.
   - Cajas en una fila = MISMA row, DISTINTA col.
   - Un fork hacia ARRIBA = row menor; hacia ABAJO = row mayor.
   - Una decisión (rombo, ¿…?) abre dos caminos: Sí y No son etiquetas de FLECHA, no nodos.
4. Cada flecha visible es un EDGE. El texto sobre la flecha va en el EDGE.
5. Un recuadro grande que envuelve varios nodos es un GROUP.
6. Texto suelto al margen = NODE kind=note, no lo omitas.

SALIDA: primero inventario, luego JSON. Sin markdown.

INVENTARIO (una línea por elemento, campos separados por |):
TITLE|título del diagrama
DIR|LR
TYPE|flowchart
GRID|16|10
NODE|id|col|row|kind|texto exacto del recuadro
GROUP|id|col|row|anchoCols|altoRows|etiqueta
EDGE|origen|destino|etiqueta o vacío|fromSide|toSide
NOTE|texto al margen

kind: start | end | process | decision | data | actor | system | io | note | document
fromSide/toSide: left | right | top | bottom
ids cortos: n1, n2, e1, g1.

JSON (los mismos datos):
{"diagrams":[{"title":"","type":"flowchart","direction":"LR","groups":[],"nodes":[{"id":"n1","label":"","kind":"process","col":0,"row":4,"x":3,"y":45,"w":10,"h":8}],"edges":[{"id":"e1","source":"n1","target":"n2","label":"Sí","fromSide":"right","toSide":"left"}],"notes":[]}]}

x,y = centro del recuadro en % de la página (0–100). Deben coincidir con col/row.`;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isRestricted(error: unknown) {
  return /free tier|restricted model|model.*not.*available/i.test(errorMessage(error));
}

function isSchemaMismatch(error: unknown) {
  return /did not match schema|No object generated|Type validation failed|invalid_type/i.test(
    errorMessage(error),
  );
}

function recoveryText(error: unknown) {
  if (NoObjectGeneratedError.isInstance(error)) {
    if (typeof error.text === "string" && error.text.trim()) return error.text;
    const cause = error.cause;
    if (typeof cause === "string" && cause.trim()) return cause;
    if (cause instanceof Error) return cause.message;
  }
  return "";
}

function finalize(parsed: ConversionResult | null) {
  if (!parsed?.diagrams.length) return null;
  return cleanConversion(parsed);
}

function parseAny(payload: unknown, text?: string) {
  return pickConversion(
    finalize(payload ? parseConversion(payload) : null),
    finalize(text ? parseConversionText(text) : null),
  );
}

const GENERATE = {
  maxOutputTokens: 24000,
  timeout: 120000,
} as const;

async function extractWithModel(model: string, content: ContentPart[]) {
  const messages = [{ role: "user" as const, content }];

  try {
    const plain = await generateText({
      model,
      ...GENERATE,
      messages,
    });
    const fromPlain = parseAny(null, plain.text);
    if (fromPlain) return fromPlain;
  } catch (error) {
    if (isRestricted(error)) throw error;
    const recovered = parseAny(null, recoveryText(error));
    if (recovered) return recovered;
  }

  try {
    const structured = await generateText({
      model,
      ...GENERATE,
      output: Output.object({
        name: "DiagramConversion",
        description: "Diagrama extraído de la imagen.",
        schema: conversionModelSchema,
      }),
      messages,
    });
    return parseAny(structured.output, structured.text ?? "");
  } catch (error) {
    const recovered = parseAny(null, recoveryText(error));
    if (recovered) return recovered;
    if (isRestricted(error)) throw error;
    if (isSchemaMismatch(error)) {
      throw new Error(
        "Gemini no devolvió un diagrama válido. Vuelve a intentar con el mismo PDF.",
      );
    }
    throw error;
  }
}

function publicFailure(model: string, error: unknown) {
  if (isRestricted(error)) return `${model}: no disponible en este plan`;
  if (isSchemaMismatch(error)) {
    return `${model}: no pudo armar el JSON del diagrama. Vuelve a intentar con el mismo PDF.`;
  }
  return `${model}: ${errorMessage(error)}`;
}

export async function extractDiagram(content: ContentPart[]) {
  const failures: string[] = [];
  const withPrompt: ContentPart[] = [
    { type: "text", text: PROMPT },
    ...content.filter((part) => part.type === "file"),
  ];

  for (const model of MODELS) {
    try {
      const result = await extractWithModel(model, withPrompt);
      if (result?.diagrams.length) {
        return { result, model, failures };
      }
      failures.push(`${model}: JSON incompleto. Vuelve a intentar.`);
    } catch (error) {
      failures.push(publicFailure(model, error));
    }
  }

  return { result: null, model: MODELS[0], failures };
}
