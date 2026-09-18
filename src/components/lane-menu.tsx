"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DiagramGroup } from "@/lib/schema";

export function LaneMenu({
  label,
  groups,
  value = "",
  noneLabel,
  onSelect,
  onCreate,
  onRename,
  onRenameEnd,
  onDelete,
}: {
  label: string;
  groups: DiagramGroup[];
  value?: string;
  noneLabel?: string;
  onSelect?: (groupId: string) => void;
  onCreate: () => string;
  onRename: (groupId: string, name: string, draft?: boolean) => void;
  onRenameEnd: () => void;
  onDelete: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
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
  const selected = groups.find((group) => group.id === value);
  const triggerText = selected?.label || noneLabel || (groups.length ? `${groups.length} carriles` : "Sin carriles");
  const isPlaceholder = !selected;
  const extraRows = noneLabel ? 2 : 1;

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
      const cap = Math.min(320, window.innerHeight * 0.55);
      const estimated = Math.min(cap, Math.max(120, (groups.length + extraRows) * 44 + 16));
      const height = inner?.offsetHeight || estimated;
      const up = height > spaceBelow && spaceAbove > spaceBelow;
      const available = up ? spaceAbove : spaceBelow;
      setCoords({
        top: up ? 0 : rect.bottom + gap,
        bottom: up ? window.innerHeight - rect.top + gap : 0,
        left: rect.left,
        width: Math.max(rect.width, 240),
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
  }, [extraRows, groups.length, open]);

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

  useEffect(() => {
    if (!open || !focusId) return;
    const input = menuRef.current?.querySelector(`input[data-lane="${focusId}"]`) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    input.select();
    setFocusId(null);
  }, [focusId, groups, open]);

  const createLane = () => {
    const id = onCreate();
    setOpen(true);
    setFocusId(id);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.blur();
  };

  return (
    <div className="field" ref={rootRef}>
      <div className="field-head">
        <span>{label}</span>
        <button type="button" className="field-add" title="Añadir carril" onClick={createLane}>
          <Plus size={16} />
        </button>
      </div>
      <div className="menu-select">
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
          <span className={cn("menu-select-label", isPlaceholder && "is-placeholder")}>{triggerText}</span>
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
                <div className="popup-menu-inner lane-menu-inner" style={{ maxHeight: coords.maxHeight }}>
                  {noneLabel ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected={!value}
                      className={cn("lane-menu-none", !value && "is-current")}
                      onClick={() => {
                        onSelect?.("");
                        close();
                      }}
                    >
                      {noneLabel}
                    </button>
                  ) : null}
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={cn("lane-menu-row", group.id === value && "is-current")}
                    >
                      <input
                        data-lane={group.id}
                        value={group.label}
                        aria-label={`Nombre de ${group.label || "carril"}`}
                        onFocus={() => onSelect?.(group.id)}
                        onChange={(event) => onRename(group.id, event.target.value, true)}
                        onBlur={() => {
                          const next = group.label.trim() || "Carril";
                          if (next !== group.label) onRename(group.id, next);
                          else onRenameEnd();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                            close();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="lane-menu-delete"
                        title="Quitar carril"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDelete(group.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="lane-menu-create" onClick={createLane}>
                    <Plus size={14} /> Nuevo carril
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
