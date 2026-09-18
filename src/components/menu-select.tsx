"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type MenuOption = { value: string; label: string };

export function MenuSelect({
  value = "",
  options,
  placeholder,
  onChange,
  resetOnSelect = false,
}: {
  value?: string;
  options: MenuOption[];
  placeholder: string;
  onChange: (value: string) => void;
  resetOnSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    up: false,
    maxHeight: 280,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);
  const label = resetOnSelect ? placeholder : (selected?.label ?? placeholder);
  const isPlaceholder = resetOnSelect || !selected;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const inner = menuRef.current?.querySelector(".popup-menu-inner") as HTMLElement | null;
      const cap = Math.min(280, window.innerHeight * 0.5);
      const estimated = Math.min(cap, Math.max(120, options.length * 40 + 16));
      const height = inner?.offsetHeight || estimated;
      const up = height > spaceBelow && spaceAbove > spaceBelow;
      const available = up ? spaceAbove : spaceBelow;
      setCoords({
        top: up ? 0 : rect.bottom + gap,
        bottom: up ? window.innerHeight - rect.top + gap : 0,
        left: rect.left,
        width: rect.width,
        up,
        maxHeight: Math.min(cap, Math.max(96, available)),
      });
    };
    update();
    const raf = window.requestAnimationFrame(update);
    const inspector = triggerRef.current?.closest(".inspector");
    inspector?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(raf);
      inspector?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      triggerRef.current?.blur();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("menu-select-trigger", open && "open")}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() =>
          setOpen((current) => {
            if (current) triggerRef.current?.blur();
            return !current;
          })
        }
      >
        <span className={cn("menu-select-label", isPlaceholder && "is-placeholder")}>{label}</span>
        <ChevronDown size={16} />
      </button>
      {mounted
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className={cn("popup-menu is-fixed", open && "open", coords.up && "is-up")}
              role="listbox"
              style={
                coords.up
                  ? {
                      top: "auto",
                      bottom: coords.bottom,
                      left: coords.left,
                      width: coords.width,
                    }
                  : {
                      top: coords.top,
                      bottom: "auto",
                      left: coords.left,
                      width: coords.width,
                    }
              }
            >
              <div className="popup-menu-inner" style={{ maxHeight: coords.maxHeight }}>
                {options.map((option) => (
                  <button
                    key={option.value || "empty"}
                    type="button"
                    role="option"
                    aria-selected={!resetOnSelect && option.value === value}
                    className={cn(!resetOnSelect && option.value === value && "is-current")}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.blur();
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
