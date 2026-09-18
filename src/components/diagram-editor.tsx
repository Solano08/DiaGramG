"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import type { Diagram, NodeKind } from "@/lib/schema";
import { KIND_LABELS, NODE_KINDS } from "@/lib/schema";
import { cn } from "@/lib/cn";
import { MenuSelect } from "./menu-select";
import {
  addNode,
  connectNodes,
  deleteEdges,
  deleteNodes,
  duplicateNode,
  patchEdge,
  patchNode,
} from "@/lib/edit-diagram";

export function DiagramEditor({
  diagram,
  selectedId,
  onSelect,
  onChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  diagram: Diagram;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: Diagram, options?: { history?: boolean }) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const selected = diagram.nodes.find((node) => node.id === selectedId) ?? null;
  const heldNode = useRef(selected);
  if (selected) heldNode.current = selected;
  const node = selected ?? heldNode.current;
  const view = selected ? "node" : "diagram";
  const shownRef = useRef(view);
  const [shown, setShown] = useState(view);
  const [leaving, setLeaving] = useState(false);
  const activeId = shown === "node" ? node?.id : selectedId;
  const incoming = diagram.edges.filter((edge) => edge.target === activeId);
  const outgoing = diagram.edges.filter((edge) => edge.source === activeId);

  useEffect(() => {
    if (view === shownRef.current) {
      setLeaving(false);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shownRef.current = view;
      setShown(view);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      shownRef.current = view;
      setShown(view);
      setLeaving(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [view]);

  const editing = shown === "node" ? node : null;

  return (
    <aside className="inspector">
      <div className="editor-head">
        <p className="eyebrow">Editor</p>
        <div className="editor-history">
          <button type="button" className="icon-btn" onClick={onUndo} disabled={!canUndo} title="Deshacer">
            <Undo2 size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={onRedo} disabled={!canRedo} title="Rehacer">
            <Redo2 size={15} />
          </button>
        </div>
      </div>

      <div className={cn("editor-body", leaving && "is-leaving")}>
        <div key={shown} className="editor-body-inner">
          {editing ? (
            <>
              <label className="field">
                <span>Etiqueta</span>
                <textarea
                  rows={3}
                  value={editing.label}
                  onChange={(event) =>
                    onChange(patchNode(diagram, editing.id, { label: event.target.value }), {
                      history: false,
                    })
                  }
                  onBlur={() => onChange(diagram)}
                />
              </label>
              <label className="field">
                <span>Tipo de caja</span>
                <MenuSelect
                  value={editing.kind}
                  placeholder="Elegir tipo…"
                  options={NODE_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
                  onChange={(next) =>
                    onChange(patchNode(diagram, editing.id, { kind: next as NodeKind }))
                  }
                />
              </label>
              <label className="field">
                <span>Detalle</span>
                <textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    onChange(
                      patchNode(diagram, editing.id, { description: event.target.value || undefined }),
                      { history: false },
                    )
                  }
                  onBlur={() => onChange(diagram)}
                />
              </label>
              <label className="field">
                <span>Insignia</span>
                <input
                  value={editing.badge ?? ""}
                  onChange={(event) =>
                    onChange(
                      patchNode(diagram, editing.id, { badge: event.target.value || undefined }),
                      { history: false },
                    )
                  }
                  onBlur={() => onChange(diagram)}
                  placeholder="Sí, No, opcional…"
                />
              </label>
              {diagram.groups.length ? (
                <label className="field">
                  <span>Carril</span>
                  <MenuSelect
                    value={editing.groupId ?? ""}
                    placeholder="Sin carril"
                    options={[
                      { value: "", label: "Sin carril" },
                      ...diagram.groups.map((group) => ({ value: group.id, label: group.label })),
                    ]}
                    onChange={(next) =>
                      onChange(
                        patchNode(diagram, editing.id, {
                          groupId: next || undefined,
                        }),
                      )
                    }
                  />
                </label>
              ) : null}

              <div className="editor-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const result = duplicateNode(diagram, editing.id);
                    if (!result) return;
                    onChange(result.diagram);
                    onSelect(result.id);
                  }}
                >
                  <Copy size={14} /> Duplicar
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => {
                    onChange(deleteNodes(diagram, [editing.id]));
                    onSelect(null);
                  }}
                >
                  <Trash2 size={14} /> Borrar
                </button>
              </div>

              <p className="eyebrow tight">Conexiones</p>
              <div className="links">
                {incoming.map((edge) => {
                  const from = diagram.nodes.find((item) => item.id === edge.source);
                  return (
                    <div key={edge.id} className="edge-row">
                      <button type="button" onClick={() => onSelect(edge.source)}>
                        ← {from?.label ?? edge.source}
                      </button>
                      <input
                        value={edge.label ?? ""}
                        placeholder="etiqueta"
                        onChange={(event) =>
                          onChange(patchEdge(diagram, edge.id, { label: event.target.value || undefined }), {
                            history: false,
                          })
                        }
                        onBlur={() => onChange(diagram)}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        title="Quitar flecha"
                        onClick={() => onChange(deleteEdges(diagram, [edge.id]))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
                {outgoing.map((edge) => {
                  const to = diagram.nodes.find((item) => item.id === edge.target);
                  return (
                    <div key={edge.id} className="edge-row">
                      <button type="button" onClick={() => onSelect(edge.target)}>
                        {edge.label ? `${edge.label} → ` : "→ "}
                        {to?.label ?? edge.target}
                      </button>
                      <input
                        value={edge.label ?? ""}
                        placeholder="etiqueta"
                        onChange={(event) =>
                          onChange(patchEdge(diagram, edge.id, { label: event.target.value || undefined }), {
                            history: false,
                          })
                        }
                        onBlur={() => onChange(diagram)}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        title="Quitar flecha"
                        onClick={() => onChange(deleteEdges(diagram, [edge.id]))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <label className="field">
                <span>Nueva flecha hacia</span>
                <MenuSelect
                  placeholder="Elegir recuadro…"
                  resetOnSelect
                  options={diagram.nodes
                    .filter((item) => item.id !== editing.id)
                    .map((item) => ({ value: item.id, label: item.label }))}
                  onChange={(target) => onChange(connectNodes(diagram, editing.id, target))}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Título</span>
                <input
                  value={diagram.title}
                  onChange={(event) => onChange({ ...diagram, title: event.target.value }, { history: false })}
                  onBlur={() => onChange(diagram)}
                />
              </label>
              <label className="field">
                <span>Subtítulo</span>
                <input
                  value={diagram.subtitle ?? ""}
                  onChange={(event) =>
                    onChange({ ...diagram, subtitle: event.target.value || undefined }, { history: false })
                  }
                  onBlur={() => onChange(diagram)}
                />
              </label>
              <p>
                Haz clic en un recuadro para editarlo. Al pasar el cursor se ilumina toda su ruta
                de flujo. Arrastra para mover, conecta desde los puntos del borde y haz doble clic
                en el lienzo para añadir uno nuevo.
              </p>
              <button
                type="button"
                className="solid wide"
                onClick={() => {
                  const result = addNode(diagram);
                  onChange(result.diagram);
                  onSelect(result.id);
                }}
              >
                <Plus size={15} /> Añadir recuadro
              </button>
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
        </div>
      </div>

      {diagram.notes?.length ? (
        <ol className="notes">
          {diagram.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      ) : null}
    </aside>
  );
}
