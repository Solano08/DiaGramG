"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SPLASH_MS = 1600;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="splash"
      role="status"
      aria-live="polite"
      aria-label="Cargando DiaGramG"
    >
      <Image
        src="/logo.png"
        alt="DiaGramG"
        width={120}
        height={120}
        priority
        className="splash-logo"
      />
    </div>
  );
}
