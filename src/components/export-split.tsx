"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileCode2, Image } from "lucide-react";
import { cn } from "@/lib/cn";

export function ExportSplit({
  onHtml,
  onPng,
  onSvg,
}: {
  onHtml: () => void;
  onPng: () => void;
  onSvg: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="export-split" ref={rootRef}>
      <div className="export-split-btns">
        <button type="button" className="solid" onClick={onHtml}>
          <Download size={16} /> Exportar HTML
        </button>
        <button
          type="button"
          className={cn("solid export-caret", open && "open")}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Más formatos de export"
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <div className={cn("popup-menu export-menu", open && "open")} role="menu">
        <div className="popup-menu-inner">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPng();
            }}
          >
            <Image size={15} /> Descargar PNG
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSvg();
            }}
          >
            <FileCode2 size={15} /> Descargar SVG
          </button>
        </div>
      </div>
    </div>
  );
}
