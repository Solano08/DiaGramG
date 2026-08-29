"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Download,
  Eye,
  FileJson,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Sparkles,
  Upload,
} from "lucide-react";
import { SAMPLE_DIAGRAM } from "@/lib/sample";
import { diagramToHtml, downloadTextFile } from "@/lib/export-html";
import { isSupportedFile } from "@/lib/files";
import type { Diagram, NodeKind } from "@/lib/schema";
import { cn } from "@/lib/cn";
import { HeroWaves } from "./hero-waves";

const DiagramCanvas = dynamic(
  () => import("./diagram-canvas").then((mod) => mod.DiagramCanvas),
  { ssr: false },
);

type Status = "idle" | "converting" | "ready" | "error";

const KIND_LABEL: Record<NodeKind, string> = {
  start: "Inicio",
  end: "Cierre",
  process: "Proceso",
  decision: "Decisión",
  data: "Datos",
  actor: "Actor",
  system: "Sistema",
  io: "Entrada / salida",
  note: "Nota",
  document: "Documento",
};

const STEPS = [
  "Leyendo el PDF a alta resolución…",
  "Gemini recorre cajas, columnas, filas y flechas…",
  "Componiendo un diagrama legible…",
];

export function Studio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [step, setStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);

  const diagram = diagrams[active];

  const selected = useMemo(
    () => diagram?.nodes.find((n) => n.id === selectedId),
    [diagram, selectedId],
  );

  useEffect(() => {
    void fetch("/api/convert")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (status !== "converting") return;
    const a = window.setTimeout(() => setStep(1), 1600);
    const b = window.setTimeout(() => setStep(2), 14000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [status]);

  const reset = useCallback(() => {
    setPages((prev) => {
      for (const src of prev) {
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      }
      return [];
    });
    setStatus("idle");
    setError(null);
    setFileName(null);
    setDiagrams([]);
    setActive(0);
    setSelectedId(null);
    setCompare(false);
    setUsedModel(null);
    setModelNote(null);
  }, []);

  const convertFile = useCallback(async (file: File) => {
    if (!isSupportedFile(file)) {
      setError("Usa un PDF o una imagen del diagrama.");
      setStatus("error");
      return;
    }
    setError(null);
    setFileName(file.name);
    setStep(0);
    setStatus("converting");
    setSelectedId(null);
    setUsedModel(null);
    setModelNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { renderPdfPages } = await import("@/lib/pdf");
        const preview = await renderPdfPages(file, {
          scale: 2.1,
          quality: 0.92,
          maxPages: 2,
          format: "png",
        });
        setPages(preview);
        for (const [index, dataUrl] of preview.slice(0, 2).entries()) {
          const blob = await (await fetch(dataUrl)).blob();
          form.append("page", blob, `page-${index + 1}.png`);
        }
      } else {
        setPages([URL.createObjectURL(file)]);
        form.append("page", file, file.name);
      }
      const res = await fetch("/api/convert", { method: "POST", body: form });
      const data = (await res.json()) as {
        diagrams?: Diagram[];
        error?: string;
        model?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo convertir el archivo.");
      if (!data.diagrams?.length) throw new Error("No se encontró un diagrama en el archivo.");
      setDiagrams(data.diagrams);
      setUsedModel(data.model ?? "google/gemini-2.5-flash");
      setModelNote(null);
      setActive(0);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error al convertir.");
    }
  }, []);

  const onFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (file) void convertFile(file);
    },
    [convertFile],
  );

  const loadSample = useCallback(() => {
    setFileName("ejemplo-proceso.pdf");
    setPages([]);
    setDiagrams([SAMPLE_DIAGRAM]);
    setActive(0);
    setSelectedId(null);
    setError(null);
    setStatus("ready");
    setCompare(false);
    setUsedModel("ejemplo local");
    setModelNote(null);
  }, []);

  const exportHtml = useCallback(() => {
    if (!diagram) return;
    downloadTextFile(
      `${slug(diagram.title)}.html`,
      diagramToHtml(diagram),
      "text/html;charset=utf-8",
    );
  }, [diagram]);

  const exportJson = useCallback(() => {
    if (!diagram) return;
    downloadTextFile(
      `${slug(diagram.title)}.json`,
      JSON.stringify(diagram, null, 2),
      "application/json",
    );
  }, [diagram]);

  const present = useCallback(() => {
    const node = document.querySelector(".canvas-shell");
    if (node && !document.fullscreenElement) {
      void (node as HTMLElement).requestFullscreen();
    } else if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }, []);

  return (
    <div className="studio">
      <header className="topbar">
        <button type="button" className="brand" onClick={reset}>
          {/* Logo local en /public/logo.png */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png?v=2" alt="DiaGramG" className="brand-logo" />
          <strong>DiaGramG</strong>
        </button>
        <div className="top-actions">
          {configured === false ? (
            <span className="pill warn">Configura AI_GATEWAY_API_KEY</span>
          ) : null}
          {status === "ready" ? (
            <>
              <button type="button" className="ghost" onClick={reset}>
                <ArrowLeft size={16} /> Nuevo
              </button>
              <button type="button" className="ghost" onClick={() => setCompare((v) => !v)}>
                <Eye size={16} /> {compare ? "Ocultar original" : "Comparar original"}
              </button>
              <button type="button" className="ghost" onClick={present}>
                <Maximize2 size={16} /> Presentar
              </button>
              <button type="button" className="ghost" onClick={exportJson}>
                <FileJson size={16} /> JSON
              </button>
              <button type="button" className="solid" onClick={exportHtml}>
                <Download size={16} /> Exportar HTML
              </button>
            </>
          ) : (
            <button type="button" className="ghost dash" onClick={loadSample}>
              <Sparkles size={16} /> Ver ejemplo
            </button>
          )}
        </div>
      </header>

      {status === "idle" || status === "error" ? (
        <main className="hero">
          <HeroWaves />
          <div className="hero-stack">
            <div
              className={cn("drop", dragOver && "over")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => onFiles(e.target.files)}
              />
              <div className="drop-icon">
                <Upload size={22} />
              </div>
              <h2>Suelta el PDF aquí</h2>
              <div className="drop-actions">
                <button type="button" className="solid" onClick={() => inputRef.current?.click()}>
                  Elegir archivo
                </button>
                <button type="button" className="ghost" onClick={loadSample}>
                  Probar con un ejemplo
                </button>
              </div>
              {error ? <p className="error">{error}</p> : null}
              {configured === false ? (
                <p className="hint">
                  Para convertir tus propios PDF crea <code>.env.local</code> con
                  {" "}
                  <code>AI_GATEWAY_API_KEY</code> desde vercel.com/ai-gateway y reinicia
                  <code> npm run dev</code>.
                </p>
              ) : null}
            </div>
            <p className="drop-sub">También acepta una captura PNG o JPG del diagrama.</p>
          </div>
        </main>
      ) : null}

      {status === "converting" ? (
        <main className="busy">
          <LoaderCircle className="spin" size={28} />
          <h2>{STEPS[step]}</h2>
          <p>{fileName}</p>
          <p className="hint">Gemini 2.5 Flash lee el diagrama. Suele tardar unos 30–60 segundos.</p>
          {pages[0] ? (
            // Previews are data/blob URLs from the local PDF renderer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pages[0]} alt="Vista previa del PDF" className="busy-preview" />
          ) : (
            <div className="busy-preview placeholder">
              <ImageIcon size={28} />
            </div>
          )}
        </main>
      ) : null}

      {status === "ready" && diagram ? (
        <main className={cn("workspace", compare && pages.length > 0 && "split")}>
          {compare && pages.length > 0 ? (
            <aside className="original">
              <p>Original</p>
              <div className="page-stack">
                {pages.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={`Página ${i + 1} del PDF`} />
                ))}
              </div>
            </aside>
          ) : null}

          <section className="canvas-shell">
            <div className="canvas-meta">
              <div>
                <p className="eyebrow">{diagram.subtitle || diagram.type}</p>
                <h2>{diagram.title}</h2>
                {usedModel ? (
                  <p className="model-used">Modelo: {modelLabel(usedModel)}</p>
                ) : null}
              </div>
              {diagrams.length > 1 ? (
                <div className="tabs">
                  {diagrams.map((d, i) => (
                    <button
                      key={`${d.title}-${i}`}
                      type="button"
                      className={cn(i === active && "on")}
                      onClick={() => {
                        setActive(i);
                        setSelectedId(null);
                      }}
                    >
                      {d.title || `Diagrama ${i + 1}`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {modelNote ? <p className="model-banner">{modelNote}</p> : null}
            <div className="canvas-body">
              <DiagramCanvas
                diagram={diagram}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </section>

          <aside className="inspector">
            <p className="eyebrow">Detalle</p>
            {selected ? (
              <>
                <p className="kicker">
                  {KIND_LABEL[selected.kind]}
                  {selected.badge ? ` · ${selected.badge}` : ""}
                </p>
                <h3>{selected.label}</h3>
                <p>{selected.description || "Sin detalle adicional en el original."}</p>
                <Connected diagram={diagram} nodeId={selected.id} onPick={setSelectedId} />
              </>
            ) : (
              <>
                <h3>Explora el diagrama</h3>
                <p>
                  Haz clic en un recuadro para ver su contenido. Puedes arrastrar nodos,
                  hacer zoom y exportar un HTML independiente.
                </p>
                <ul className="stats">
                  <li>
                    <b>{diagram.nodes.length}</b> nodos
                  </li>
                  <li>
                    <b>{diagram.edges.length}</b> conexiones
                  </li>
                  <li>
                    <b>{diagram.groups.length}</b> carriles
                  </li>
                </ul>
              </>
            )}
            {diagram.notes?.length ? (
              <ol className="notes">
                {diagram.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ol>
            ) : null}
          </aside>
        </main>
      ) : null}
    </div>
  );
}

function Connected({
  diagram,
  nodeId,
  onPick,
}: {
  diagram: Diagram;
  nodeId: string;
  onPick: (id: string) => void;
}) {
  const outgoing = diagram.edges.filter((e) => e.source === nodeId);
  const incoming = diagram.edges.filter((e) => e.target === nodeId);
  const labelOf = (id: string) => diagram.nodes.find((n) => n.id === id)?.label ?? id;
  if (!outgoing.length && !incoming.length) return null;
  return (
    <div className="links">
      {incoming.map((e) => (
        <button key={e.id} type="button" onClick={() => onPick(e.source)}>
          ← {labelOf(e.source)}
        </button>
      ))}
      {outgoing.map((e) => (
        <button key={e.id} type="button" onClick={() => onPick(e.target)}>
          {e.label ? `${e.label} → ` : "→ "}
          {labelOf(e.target)}
        </button>
      ))}
    </div>
  );
}

function modelLabel(id: string) {
  if (id.includes("gemini-2.5-flash-lite")) return "Gemini 2.5 Flash Lite";
  if (id.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
  if (id === "ejemplo local") return "Ejemplo local";
  return id;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "")
    .slice(0, 60) || "diagrama";
}
