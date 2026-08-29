import { orthogonalPath, pickSides, staggerT, type Rect, type Side } from "./geometry";
import type { Diagram, NodeKind } from "./schema";
import { absNodeBoxes, layoutDiagram, type LaidOut } from "./layout";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kindClass(kind: NodeKind) {
  return `node kind-${kind}`;
}

export function diagramToHtml(diagram: Diagram, layout?: LaidOut) {
  const laid = layout ?? layoutDiagram(diagram);
  const boxById = new Map(laid.nodes.map((n) => [n.id, n]));
  const abs = absNodeBoxes(laid);
  const absMap = new Map(abs.map((n) => [n.id, n]));

  const maxNodeRight = Math.max(...abs.map((box) => box.x + box.w), 640);
  const noteBoxes = (diagram.notes ?? []).map((note, index) => {
    const w = 200;
    const h = Math.min(140, 48 + Math.ceil(note.length / 28) * 16);
    const x = maxNodeRight + 36;
    const y = 48 + index * (h + 16);
    return { note, x, y, w, h };
  });

  const stageW = Math.max(
    laid.width,
    ...noteBoxes.map((n) => n.x + n.w + 24),
    960,
  );
  const stageH = Math.max(
    laid.height,
    ...noteBoxes.map((n) => n.y + n.h + 24),
    640,
  );

  const nodesHtml = diagram.nodes
    .map((node) => {
      const box = absMap.get(node.id) ?? boxById.get(node.id);
      if (!box) return "";
      const badge = node.badge
        ? `<span class="badge">${esc(node.badge)}</span>`
        : "";
      return `<button type="button" class="${kindClass(node.kind)}" data-id="${esc(node.id)}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px">
        ${badge}
        <strong>${esc(node.label)}</strong>
      </button>`;
    })
    .join("");

  const groupsHtml = laid.groups
    .map(
      (g) =>
        `<section class="lane" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><h3>${esc(g.label)}</h3></section>`,
    )
    .join("");

  const notesHtml = noteBoxes
    .map(
      (item) =>
        `<aside class="sticky" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;min-height:${item.h}px">${esc(item.note)}</aside>`,
    )
    .join("");

  const edgesHtml = (() => {
    const obstacles: Rect[] = abs;
    const buckets = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const edge of diagram.edges) {
      const from = absMap.get(edge.source);
      const to = absMap.get(edge.target);
      if (!from || !to) continue;
      const guessed = pickSides(from, to);
      const source = (edge.fromSide as Side | undefined) ?? guessed.source;
      const key = `${edge.source}:${source}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const placedLabels: Array<{ x: number; y: number }> = [];
    return diagram.edges
      .map((edge) => {
        const from = absMap.get(edge.source);
        const to = absMap.get(edge.target);
        if (!from || !to) return "";
        const guessed = pickSides(from, to);
        const source = (edge.fromSide as Side | undefined) ?? guessed.source;
        const target = (edge.toSide as Side | undefined) ?? guessed.target;
        const key = `${edge.source}:${source}`;
        const total = counts.get(key) ?? 1;
        const index = buckets.get(key) ?? 0;
        buckets.set(key, index + 1);
        const routed = orthogonalPath(from, to, obstacles, {
          source,
          target,
          startT: staggerT(index, total),
        });
        const mid = { ...routed.mid };
        for (const other of placedLabels) {
          if (Math.hypot(other.x - mid.x, other.y - mid.y) < 24) mid.y += 18;
        }
        placedLabels.push(mid);
        const cls = edge.kind === "dashed" ? "dash" : edge.kind ?? "default";
        const label = edge.label
          ? (() => {
              const width = Math.max(32, edge.label.length * 7.4 + 16);
              return `<g class="elabel">
          <rect x="${mid.x - width / 2}" y="${mid.y - 11}" width="${width}" height="20" rx="10"></rect>
          <text x="${mid.x}" y="${mid.y + 4}">${esc(edge.label)}</text>
        </g>`;
            })()
          : "";
        return `<path class="${cls}" d="${routed.d}" />${label}`;
      })
      .join("");
  })();

  const details = diagram.nodes
    .map(
      (n) =>
        `<article data-detail="${esc(n.id)}" hidden>
          <h2>${esc(n.label)}</h2>
          <p>${esc(n.description ?? "Caja del diagrama original.")}</p>
        </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(diagram.title)}</title>
  <style>
    :root {
      --paper: #f7f4ee;
      --ink: #1b1914;
      --muted: #5e584e;
      --line: #cfc6b6;
      --card: #fffefb;
      --yes: #0f6e5c;
      --no: #b44a1f;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; background: var(--paper); color: var(--ink); font-family: "Segoe UI", system-ui, sans-serif; }
    .top {
      position: absolute; z-index: 5; left: 16px; top: 12px; right: 16px;
      display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none;
    }
    .top h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .top p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
    #stagewrap { width: 100%; height: 100%; overflow: hidden; cursor: grab; background:
      radial-gradient(circle at 1px 1px, #e7e0d3 1px, transparent 0) 0 0 / 22px 22px; }
    #stage { position: relative; width: ${stageW}px; height: ${stageH}px; transform-origin: 0 0; }
    .lane {
      position: absolute; border: 1.5px dashed #cbbfaa; background: rgba(255,255,255,.35);
      border-radius: 16px;
    }
    .lane h3 {
      margin: 0; padding: 10px 16px 0; font-size: 11px; letter-spacing: 0.12em;
      text-transform: uppercase; color: #6e8b7f;
    }
    svg.edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    svg.edges path { fill: none; stroke: #3f3a34; stroke-width: 2; marker-end: url(#arrow); }
    svg.edges path.success { stroke: var(--yes); }
    svg.edges path.warning { stroke: var(--no); }
    svg.edges path.dash { stroke-dasharray: 7 5; }
    svg.edges .elabel rect { fill: #f7f4ee; stroke: #cfc6b6; }
    svg.edges .elabel text { fill: var(--ink); font-size: 12px; font-weight: 700; text-anchor: middle; }
    .node {
      position: absolute; border: 2px solid #4d5d73; background: var(--card);
      border-radius: 6px; padding: 8px 12px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 8px 18px rgba(40,30,10,.06);
    }
    .node:hover, .node.active { border-color: #0f6e5c; outline: 2px solid rgba(15,110,92,.18); }
    .node strong {
      font-size: 13px; font-weight: 650; line-height: 1.25;
      overflow-wrap: anywhere; text-wrap: pretty;
    }
    .badge {
      position: absolute; top: -8px; right: -8px; background: #0f6e5c; color: #fff;
      font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 6px;
    }
    .kind-start, .kind-end { border-radius: 999px; }
    .kind-start { background: #e8f5ef; border-color: #2f7d66; }
    .kind-end { background: #f8ece4; border-color: #b44a1f; }
    .kind-decision {
      background: #fff4cc; border-color: #c3992a; border-radius: 10px;
      transform: none;
    }
    .kind-system { background: #eef3f8; border-color: #4d6a88; }
    .kind-actor { background: #f3efe8; border-color: #7a6a55; }
    .kind-data { background: #eef2f6; border-color: #5b6d82; }
    .kind-io { background: #f3f6ee; border-color: #5d7354; }
    .kind-note, .sticky {
      background: #fff7bf; border: 1px solid #e0c86a; border-radius: 2px;
      box-shadow: 2px 3px 0 rgba(160,130,40,.12);
    }
    .kind-document { background: #f7f3ea; border-color: #8a7a5c; }
    .sticky {
      position: absolute; padding: 10px 12px; font-size: 12px; line-height: 1.4; color: #5a4e32;
    }
    #panel {
      position: absolute; right: 16px; bottom: 16px; width: min(320px, 92vw);
      background: #fffefb; border: 1px solid var(--line); border-radius: 14px;
      padding: 14px 16px; box-shadow: 0 12px 40px rgba(30,20,8,.12); display: none;
    }
    #panel h2 { margin: 0 0 6px; font-size: 16px; }
    #panel p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    @media print {
      #panel { display: none !important; }
      #stagewrap { overflow: visible; }
      #stage { transform: none !important; }
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>${esc(diagram.title)}</h1>
      <p>${esc(diagram.subtitle || "Diagrama reconstruido · rueda para zoom · arrastra el fondo")}</p>
    </div>
  </div>
  <div id="stagewrap">
    <div id="stage">
      ${groupsHtml}
      <svg class="edges" viewBox="0 0 ${stageW} ${stageH}">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3a34"></path>
          </marker>
        </defs>
        ${edgesHtml}
      </svg>
      ${nodesHtml}
      ${notesHtml}
    </div>
  </div>
  <div id="panel"></div>
  <div hidden id="details">${details}</div>
  <script>
    const stage = document.getElementById('stage');
    const wrap = document.getElementById('stagewrap');
    const panel = document.getElementById('panel');
    let scale = 1, x = 24, y = 48, drag = false, lx = 0, ly = 0;
    function apply(){ stage.style.transform = 'translate('+x+'px,'+y+'px) scale('+scale+')'; }
    function fit(){
      const wr = wrap.clientWidth / Math.max(stage.offsetWidth, 1);
      const hr = wrap.clientHeight / Math.max(stage.offsetHeight, 1);
      scale = Math.min(1.15, Math.max(0.12, Math.min(wr, hr) * 0.9));
      x = Math.max(12, (wrap.clientWidth - stage.offsetWidth * scale) / 2);
      y = Math.max(44, (wrap.clientHeight - stage.offsetHeight * scale) / 2);
      apply();
    }
    fit();
    window.addEventListener('resize', fit);
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const next = Math.min(2.4, Math.max(0.12, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      scale = next; apply();
    }, { passive: false });
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.node')) return;
      drag = true; lx = e.clientX; ly = e.clientY; wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      x += e.clientX - lx; y += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply();
    });
    wrap.addEventListener('pointerup', () => { drag = false; });
    document.querySelectorAll('.node').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.node').forEach((n) => n.classList.remove('active'));
        btn.classList.add('active');
        const id = btn.getAttribute('data-id');
        const article = document.querySelector('[data-detail="'+id+'"]');
        panel.innerHTML = article ? article.innerHTML : '';
        panel.style.display = 'block';
      });
    });
    wrap.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.node')) panel.style.display = 'none';
    });
  </script>
</body>
</html>`;
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
