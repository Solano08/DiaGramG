"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

export const SPLASH_MS = 1600;
const SPLASH_COVER_MS = 610;

export type SplashMode = "enter" | "leave" | "leave-down";

export function SplashScreen({
  mode = "enter",
  onCovered,
}: {
  mode?: SplashMode;
  onCovered?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const leaving = mode === "leave" || mode === "leave-down";

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hide = window.setTimeout(() => setVisible(false), reduce ? 300 : SPLASH_MS);
    const cover =
      leaving && onCovered
        ? window.setTimeout(() => onCovered(), reduce ? 0 : SPLASH_COVER_MS)
        : 0;
    return () => {
      window.clearTimeout(hide);
      if (cover) window.clearTimeout(cover);
    };
  }, [leaving, onCovered]);

  if (!visible) return null;

  return (
    <>
      {leaving ? <div className="splash-block" aria-hidden="true" /> : null}
      <div
        className={cn(
          "splash",
          mode === "leave" && "splash-leave",
          mode === "leave-down" && "splash-leave-down",
        )}
        role="status"
        aria-live="polite"
        aria-label="Cargando DiaGramG"
      >
        <Image
          src="/Logo.jpeg"
          alt="DiaGramG"
          width={120}
          height={120}
          priority
          className="splash-logo"
        />
      </div>
    </>
  );
}
