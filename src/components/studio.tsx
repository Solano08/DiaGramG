"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Eye,
  FileJson,
  Image as ImageIcon,
  LoaderCircle,
  Presentation,
  Sparkles,
  Upload,
} from "lucide-react";
import { SAMPLE_DIAGRAM } from "@/lib/sample";
import { diagramToHtml, downloadTextFile } from "@/lib/export-html";
import { diagramToSvg, downloadPngFile, downloadSvgFile } from "@/lib/export-image";
import {
  addNode,
  applyNodePositions,
  connectNodes,
  deleteEdges,
  deleteNodes,
} from "@/lib/edit-diagram";
import { presentationSteps } from "@/lib/graph-flow";
import { isSupportedFile } from "@/lib/files";
import type { Diagram } from "@/lib/schema";
import { cn } from "@/lib/cn";
import { DiagramEditor } from "./diagram-editor";
import { ExportSplit } from "./export-split";
import { HeroWaves } from "./hero-waves";
import { PresentationBar } from "./presentation-bar";
import { SplashScreen, type SplashMode } from "./splash-screen";

const DiagramCanvas = dynamic(
  () => import("./diagram-canvas").then((mod) => mod.DiagramCanvas),
  { ssr: false },
);

type Status = "idle" | "converting" | "ready" | "error";
type PresentPhase =
  | "off"
  | "enter-cover"
  | "enter-hold"
  | "enter-reveal"
  | "enter-overview"
  | "enter-zoom"
  | "live"
  | "leave-cover"
  | "leave-hold"
  | "leave-reveal";

type PresentCamera = "overview" | "zoom" | "follow";

const STEPS = [
  "Leyendo el PDF a alta resolución…",
  "Gemini 3.1 Pro recorre cajas, columnas, filas y flechas…",
  "Componiendo un diagrama legible…",
];

const PRESENT_MS = {
  cover: 520,
  hold: 420,
  reveal: 560,
  overview: 580,
  zoom: 980,
} as const;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Studio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [splashKey, setSplashKey] = useState(0);
  const [splashMode, setSplashMode] = useState<SplashMode>("enter");
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
  const [past, setPast] = useState<Diagram[][]>([]);
  const [future, setFuture] = useState<Diagram[][]>([]);
  const [presentPhase, setPresentPhase] = useState<PresentPhase>("off");
  const [presentStep, setPresentStep] = useState(0);
  const [presentPlaying, setPresentPlaying] = useState(false);
  const presenting =
    presentPhase === "enter-hold" ||
    presentPhase === "enter-reveal" ||
    presentPhase === "enter-overview" ||
    presentPhase === "enter-zoom" ||
    presentPhase === "live" ||
    presentPhase === "leave-cover";
  const presentSession = presentPhase !== "off";
  const presentLeaving = presentPhase.startsWith("leave");
  const presentVeilOn =
    presentPhase === "enter-cover" ||
    presentPhase === "enter-hold" ||
    presentPhase === "leave-cover" ||
    presentPhase === "leave-hold";
  const presentOverview =
    presentPhase === "enter-hold" ||
    presentPhase === "enter-reveal" ||
    presentPhase === "enter-overview" ||
    presentPhase === "enter-zoom";
  const presentCamera: PresentCamera =
    presentPhase === "enter-zoom"
      ? "zoom"
      : presentPhase === "live" || presentPhase === "leave-cover"
        ? "follow"
        : "overview";
  const instantCamera =
    presentPhase !== "off" && presentPhase !== "live" && presentPhase !== "enter-zoom";
  const [fullscreen, setFullscreen] = useState(false);
  const diagramsRef = useRef(diagrams);
  const activeRef = useRef(active);
  const draftStart = useRef<Diagram[] | null>(null);
  diagramsRef.current = diagrams;
  activeRef.current = active;

  const diagram = diagrams[active];
  const steps = useMemo(() => (diagram ? presentationSteps(diagram) : []), [diagram]);

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

  const replaySplash = useCallback((mode: SplashMode = "enter") => {
    setSplashMode(mode);
    setSplashKey((key) => key + 1);
  }, []);

  const applyReset = useCallback(() => {
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
    setPast([]);
    setFuture([]);
    setPresentPhase("off");
    setPresentStep(0);
    setPresentPlaying(false);
    draftStart.current = null;
  }, []);

  const reset = useCallback(() => {
    if (status === "ready" || status === "converting") {
      replaySplash("leave");
      return;
    }
    applyReset();
  }, [applyReset, replaySplash, status]);

  const convertFile = useCallback(async (file: File) => {
    if (!isSupportedFile(file)) {
      setError("Usa un PDF o una imagen del diagrama.");
      setStatus("error");
      return;
    }
    replaySplash();
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
      setUsedModel(data.model ?? "google/gemini-3.1-pro-preview");
      setModelNote(null);
      setActive(0);
      setPast([]);
      setFuture([]);
      setPresentPhase("off");
      setPresentStep(0);
      setPresentPlaying(false);
      draftStart.current = null;
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error al convertir.");
    }
  }, [replaySplash]);

  const onFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (file) void convertFile(file);
    },
    [convertFile],
  );

  const loadSample = useCallback(() => {
    replaySplash();
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
    setPast([]);
    setFuture([]);
    setPresentPhase("off");
    setPresentStep(0);
    setPresentPlaying(false);
    draftStart.current = null;
  }, [replaySplash]);

  const applyDiagrams = useCallback((next: Diagram[]) => {
    diagramsRef.current = next;
    setDiagrams(next);
  }, []);

  const changeActive = useCallback(
    (next: Diagram, options?: { history?: boolean }) => {
      const index = activeRef.current;
      const current = diagramsRef.current;
      const same = current[index] === next;
      if (options?.history === false) {
        if (!draftStart.current) draftStart.current = current;
        applyDiagrams(current.map((item, i) => (i === index ? next : item)));
        return;
      }
      if (draftStart.current) {
        setPast((value) => [...value.slice(-40), draftStart.current as Diagram[]]);
        draftStart.current = null;
        setFuture([]);
        if (!same) applyDiagrams(current.map((item, i) => (i === index ? next : item)));
        return;
      }
      if (same) return;
      setPast((value) => [...value.slice(-40), current]);
      setFuture([]);
      applyDiagrams(current.map((item, i) => (i === index ? next : item)));
    },
    [applyDiagrams],
  );

  const mutateActive = useCallback(
    (updater: (current: Diagram) => Diagram, options?: { history?: boolean }) => {
      const current = diagramsRef.current[activeRef.current];
      if (!current) return;
      changeActive(updater(current), options);
    },
    [changeActive],
  );

  const undo = useCallback(() => {
    setPast((value) => {
      if (!value.length) return value;
      const prev = value[value.length - 1];
      setFuture((next) => [diagramsRef.current, ...next].slice(0, 40));
      draftStart.current = null;
      applyDiagrams(prev);
      return value.slice(0, -1);
    });
  }, [applyDiagrams]);

  const redo = useCallback(() => {
    setFuture((value) => {
      if (!value.length) return value;
      const [next, ...rest] = value;
      setPast((prev) => [...prev.slice(-40), diagramsRef.current]);
      draftStart.current = null;
      applyDiagrams(next);
      return rest;
    });
  }, [applyDiagrams]);

  const exitPresentation = useCallback(() => {
    setPresentPlaying(false);
    if (document.fullscreenElement) void document.exitFullscreen();
    setPresentPhase((current) => {
      if (current === "off" || current.startsWith("leave")) return current;
      if (prefersReducedMotion() || current === "enter-cover") return "leave-reveal";
      return "leave-cover";
    });
  }, []);

  const startPresentation = useCallback(() => {
    setSelectedId(null);
    setPresentPlaying(true);
    setPresentStep(0);
    if (prefersReducedMotion()) {
      setPresentPhase("live");
      return;
    }
    setPresentPhase("enter-cover");
  }, []);

  const toggleFullscreen = useCallback(() => {
    const node = document.querySelector(".canvas-shell");
    if (node && !document.fullscreenElement) {
      void (node as HTMLElement).requestFullscreen();
    } else if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (event.key === "Escape" && presentSession) {
        event.preventDefault();
        if (!presentLeaving) exitPresentation();
        return;
      }
      if (presentPhase === "live") {
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          setPresentPlaying(false);
          setPresentStep((value) => Math.min(steps.length - 1, value + 1));
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          setPresentPlaying(false);
          setPresentStep((value) => Math.max(0, value - 1));
          return;
        }
        if (event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          setPresentPlaying((value) => !value);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          setPresentPlaying(false);
          setPresentStep(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          setPresentPlaying(false);
          setPresentStep(Math.max(0, steps.length - 1));
          return;
        }
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitPresentation, presentLeaving, presentPhase, presentSession, redo, steps.length, undo]);

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

  const exportPng = useCallback(() => {
    if (!diagram) return;
    void downloadPngFile(`${slug(diagram.title)}.png`, diagramToSvg(diagram));
  }, [diagram]);

  const exportSvg = useCallback(() => {
    if (!diagram) return;
    downloadSvgFile(`${slug(diagram.title)}.svg`, diagramToSvg(diagram));
  }, [diagram]);

  useEffect(() => {
    const onFull = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  useEffect(() => {
    if (presentPhase !== "live" || !presentPlaying || steps.length === 0) return;
    const timer = window.setInterval(() => {
      setPresentStep((value) => {
        if (value >= steps.length - 1) {
          setPresentPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [presentPhase, presentPlaying, steps.length]);

  useEffect(() => {
    if (presentPhase === "off" || presentPhase === "live") return;
    const reduce = prefersReducedMotion();
    const wait = (ms: number) => (reduce ? 0 : ms);
    let timer = 0;
    if (presentPhase === "enter-cover") {
      timer = window.setTimeout(() => setPresentPhase("enter-hold"), wait(PRESENT_MS.cover));
    } else if (presentPhase === "enter-hold") {
      timer = window.setTimeout(() => setPresentPhase("enter-reveal"), wait(PRESENT_MS.hold));
    } else if (presentPhase === "enter-reveal") {
      timer = window.setTimeout(() => setPresentPhase("enter-overview"), wait(PRESENT_MS.reveal));
    } else if (presentPhase === "enter-overview") {
      timer = window.setTimeout(() => setPresentPhase("enter-zoom"), wait(PRESENT_MS.overview));
    } else if (presentPhase === "enter-zoom") {
      timer = window.setTimeout(() => setPresentPhase("live"), wait(PRESENT_MS.zoom));
    } else if (presentPhase === "leave-cover") {
      timer = window.setTimeout(() => setPresentPhase("leave-hold"), wait(PRESENT_MS.cover));
    } else if (presentPhase === "leave-hold") {
      setPresentStep(0);
      timer = window.setTimeout(() => setPresentPhase("leave-reveal"), wait(PRESENT_MS.hold));
    } else if (presentPhase === "leave-reveal") {
      timer = window.setTimeout(() => setPresentPhase("off"), wait(PRESENT_MS.reveal));
    }
    return () => window.clearTimeout(timer);
  }, [presentPhase]);

  const safePresentStep = steps.length ? Math.min(presentStep, steps.length - 1) : 0;

  return (
    <div className="studio">
      <SplashScreen
        key={splashKey}
        mode={splashMode}
        onCovered={splashMode === "leave" ? applyReset : undefined}
      />
      <header className="topbar">
        <button type="button" className="brand" onClick={reset}>
          {/* Logo local en /public/logo.png */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.jpeg?v=2" alt="DiagramG" className="brand-logo" />
          <strong>DiagramG</strong>
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
              <button
                type="button"
                className={cn("ghost", presentSession && "on")}
                onClick={() => {
                  if (presentSession) {
                    if (!presentLeaving) exitPresentation();
                    return;
                  }
                  startPresentation();
                }}
              >
                <Presentation size={16} /> {presentSession ? "Salir" : "Presentar"}
              </button>
              <button type="button" className="ghost" onClick={exportJson}>
                <FileJson size={16} /> JSON
              </button>
              <ExportSplit onHtml={exportHtml} onPng={exportPng} onSvg={exportSvg} />
            </>
          ) : (
            <button type="button" className="ghost dash" onClick={loadSample}>
              <Sparkles size={16} /> Ver ejemplo
            </button>
          )}
        </div>
      </header>

      <div className="studio-stage">
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
          <p className="hint">Gemini 3.1 Pro lee el diagrama. Suele tardar unos 30–60 segundos.</p>
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
        <main
          className={cn(
            "workspace",
            compare && pages.length > 0 && "split",
            presenting && "presenting",
            presentPhase === "live" && "is-live",
            instantCamera && "is-settling",
          )}
        >
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
                {presenting ? null : (
                  <p className="model-used">
                    Pasa el cursor sobre un recuadro para iluminar su ruta de flujo.
                  </p>
                )}
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
                        setPresentStep(0);
                        setPresentPlaying(false);
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
                key={active}
                diagram={diagram}
                selectedId={selectedId}
                presenting={presenting}
                presentStep={safePresentStep}
                overview={presentOverview}
                cameraMode={presentCamera}
                onSelect={setSelectedId}
                onPresentStep={(index) => {
                  setPresentPlaying(false);
                  setPresentStep(index);
                }}
                onMove={(positions) => mutateActive((current) => applyNodePositions(current, positions))}
                onConnectNodes={(source, target, sourceHandle, targetHandle) =>
                  mutateActive((current) =>
                    connectNodes(current, source, target, { sourceHandle, targetHandle }),
                  )
                }
                onDeleteNodes={(ids) => {
                  mutateActive((current) => deleteNodes(current, ids));
                  setSelectedId((current) => (current && ids.includes(current) ? null : current));
                }}
                onDeleteEdges={(ids) => mutateActive((current) => deleteEdges(current, ids))}
                onAddAt={(position) => {
                  mutateActive((current) => {
                    const result = addNode(current, { x: position.x, y: position.y });
                    setSelectedId(result.id);
                    return result.diagram;
                  });
                }}
              />
              {presenting ? (
                <PresentationBar
                  step={safePresentStep}
                  steps={steps}
                  playing={presentPlaying}
                  fullscreen={fullscreen}
                  visible={presentPhase === "live" || presentPhase === "leave-cover"}
                  onPrev={() => {
                    setPresentPlaying(false);
                    setPresentStep((value) => Math.max(0, value - 1));
                  }}
                  onNext={() => {
                    setPresentPlaying(false);
                    setPresentStep((value) => Math.min(steps.length - 1, value + 1));
                  }}
                  onTogglePlay={() => setPresentPlaying((value) => !value)}
                  onRestart={() => {
                    setPresentStep(0);
                    setPresentPlaying(true);
                  }}
                  onExit={exitPresentation}
                  onFullscreen={toggleFullscreen}
                />
              ) : null}
            </div>
          </section>

          <DiagramEditor
            diagram={diagram}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={changeActive}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onUndo={undo}
            onRedo={redo}
          />
        </main>
      ) : null}

      <div
        className={cn("present-veil", presentVeilOn && "is-visible")}
        aria-hidden="true"
      />
      </div>
    </div>
  );
}

function modelLabel(id: string) {
  if (id.includes("gemini-3.1-pro")) return "Gemini 3.1 Pro";
  if (id.includes("gemini-3.8-flash")) return "Gemini 3.8 Flash";
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
