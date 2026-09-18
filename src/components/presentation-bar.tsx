"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { PresentationStep } from "@/lib/graph-flow";

export function PresentationBar({
  step,
  steps,
  playing,
  fullscreen,
  visible = true,
  onPrev,
  onNext,
  onTogglePlay,
  onRestart,
  onExit,
  onFullscreen,
}: {
  step: number;
  steps: PresentationStep[];
  playing: boolean;
  fullscreen: boolean;
  visible?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onExit: () => void;
  onFullscreen: () => void;
}) {
  const current = steps[step];
  const total = steps.length;
  const progress = total ? ((step + 1) / total) * 100 : 0;

  return (
    <div
      className={cn("present-bar", visible && "is-in")}
      role="region"
      aria-label="Modo presentación"
      aria-hidden={!visible}
      {...(!visible ? { inert: true } : {})}
    >
      <div className="present-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="present-main">
        <div className="present-copy">
          <p className="eyebrow">
            Paso {total ? step + 1 : 0} / {total}
            {current?.badge ? ` · ${current.badge}` : ""}
          </p>
          <h3>{current?.label ?? "Sin recuadros"}</h3>
          {current?.description ? <p>{current.description}</p> : null}
        </div>
        <div className="present-controls">
          <button type="button" className="icon-btn" onClick={onRestart} title="Reiniciar">
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onPrev}
            disabled={step <= 0}
            title="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className={cn("solid present-play", playing && "is-playing")}
            onClick={onTogglePlay}
            disabled={!total}
            title={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? "Pausa" : "Reproducir"}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onNext}
            disabled={step >= total - 1}
            title="Siguiente"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onFullscreen}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" className="icon-btn" onClick={onExit} title="Salir de la presentación">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
