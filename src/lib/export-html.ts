import { sceneFromDiagram } from "./diagram-scene";
import { presentationSteps } from "./graph-flow";
import type { Diagram, NodeKind } from "./schema";

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

export function diagramToHtml(diagram: Diagram) {
  const scene = sceneFromDiagram(diagram);
  const stageW = scene.width;
  const stageH = scene.height;

  const nodesHtml = scene.nodes
    .map((node) => {
      const badge = node.badge
        ? `<span class="badge">${esc(node.badge)}</span>`
        : "";
      return `<button type="button" class="${kindClass(node.kind)}" data-id="${esc(node.id)}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px">
        ${badge}
        <strong>${esc(node.label)}</strong>
      </button>`;
    })
    .join("");

  const groupsHtml = scene.groups
    .map(
      (g) =>
        `<section class="lane" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><h3>${esc(g.label)}</h3></section>`,
    )
    .join("");

  const notesHtml = scene.notes
    .map(
      (item) =>
        `<aside class="sticky" style="left:${item.x}px;top:${item.y}px;width:${item.w}px;min-height:${item.h}px">${esc(item.note)}</aside>`,
    )
    .join("");

  const edgesHtml = scene.edges
    .map((edge) => {
      const label = edge.label
        ? (() => {
            const width = Math.max(32, edge.label.length * 7.4 + 16);
            return `<g class="elabel">
          <rect x="${edge.mid.x - width / 2}" y="${edge.mid.y - 11}" width="${width}" height="20" rx="10"></rect>
          <text x="${edge.mid.x}" y="${edge.mid.y + 4}">${esc(edge.label)}</text>
        </g>`;
          })()
        : "";
      return `<path class="${edge.kind}" data-id="${esc(edge.id)}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" d="${edge.d}" />${label}`;
    })
    .join("");

  const graphJson = JSON.stringify({
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    steps: presentationSteps(diagram).map((step) => ({
      nodeId: step.nodeId,
      incomingEdgeIds: step.incomingEdgeIds,
      label: step.label,
      description: step.description ?? "",
    })),
  }).replaceAll("</", "<\\/");

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
    .top button {
      border: 1px solid var(--line); background: #fffefb; border-radius: 999px;
      padding: 7px 12px; cursor: pointer; font: inherit; pointer-events: auto;
    }
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
    .node.active { border-color: #0f6e5c; outline: 2px solid rgba(15,110,92,.18); }
    .node.is-path-focus { border-color: #0f6e5c; outline: 4px solid rgba(15,110,92,.28); transform: scale(1.03); z-index: 3; }
    .node.is-path-up { border-color: #0f6e5c; outline: 3px solid rgba(15,110,92,.18); }
    .node.is-path-down { border-color: #b44a1f; outline: 3px solid rgba(180,74,31,.16); }
    .node.is-dim { opacity: .22; filter: grayscale(.3); }
    .node.is-present-current { border-color: #0f6e5c; outline: 4px solid rgba(15,110,92,.3); z-index: 3; }
    .node.is-present-hidden { opacity: .12; }
    svg.edges path.is-on-path { stroke-width: 3; }
    svg.edges path.is-path-dim, svg.edges path.is-present-hidden { opacity: .12; }
    svg.edges path.is-present-current { stroke: var(--yes); stroke-width: 3; }
    .top { pointer-events: none; }
    .top button { pointer-events: auto; }
    #present {
      position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 6;
      display: none; align-items: center; justify-content: space-between; gap: 12px;
      background: #fffefb; border: 1px solid var(--line); border-radius: 16px;
      padding: 12px 14px; box-shadow: 0 12px 40px rgba(30,20,8,.12);
    }
    #present.show { display: flex; }
    #present h2 { margin: 0; font-size: 16px; }
    #present p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
    #present .row { display: flex; gap: 6px; }
    #present button {
      border: 1px solid var(--line); background: #fff; border-radius: 999px;
      padding: 7px 12px; cursor: pointer; font: inherit;
    }
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
    body.presenting #panel { display: none !important; }
    #panel {
      position: absolute; right: 16px; bottom: 16px; width: min(320px, 92vw);
      background: #fffefb; border: 1px solid var(--line); border-radius: 14px;
      padding: 14px 16px; box-shadow: 0 12px 40px rgba(30,20,8,.12); display: none;
    }
    #panel h2 { margin: 0 0 6px; font-size: 16px; }
    #panel p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    @media print {
      #panel, #present, .top button { display: none !important; }
      #stagewrap { overflow: visible; }
      #stage { transform: none !important; }
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>${esc(diagram.title)}</h1>
      <p>${esc(diagram.subtitle || "Pasa el cursor para ver la ruta · Presentar para explicar paso a paso")}</p>
    </div>
    <button type="button" id="present-toggle">Presentar</button>
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
  <div id="present">
    <div>
      <p id="present-count">Paso 1 / 1</p>
      <h2 id="present-title"></h2>
      <p id="present-detail"></p>
    </div>
    <div class="row">
      <button type="button" id="present-prev">Anterior</button>
      <button type="button" id="present-play">Reproducir</button>
      <button type="button" id="present-next">Siguiente</button>
    </div>
  </div>
  <div id="panel"></div>
  <div hidden id="details">${details}</div>
  <script type="application/json" id="graph-data">${graphJson}</script>
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
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const next = Math.min(2.4, Math.max(0.12, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      const k = next / scale;
      x = mx - (mx - x) * k;
      y = my - (my - y) * k;
      scale = next;
      apply();
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
    const graph = JSON.parse(document.getElementById('graph-data').textContent || '{"edges":[],"steps":[]}');
    const incoming = {}, outgoing = {};
    graph.edges.forEach((edge) => {
      (outgoing[edge.source] ||= []).push(edge);
      (incoming[edge.target] ||= []).push(edge);
    });
    function walk(start, map) {
      const seen = new Set();
      const stack = [start];
      while (stack.length) {
        const id = stack.pop();
        (map[id] || []).forEach((edge) => {
          const next = edge.source === id ? edge.target : edge.source;
          if (seen.has(next)) return;
          seen.add(next);
          stack.push(next);
        });
      }
      return seen;
    }
    const nodeEls = [...document.querySelectorAll('.node')];
    const pathEls = [...document.querySelectorAll('svg.edges path[data-id]')];
    function clearMarks() {
      nodeEls.forEach((n) => n.classList.remove('is-path-focus','is-path-up','is-path-down','is-dim','is-present-current','is-present-seen','is-present-hidden','active'));
      pathEls.forEach((p) => p.classList.remove('is-on-path','is-path-dim','is-present-current','is-present-seen','is-present-hidden'));
    }
    function showPath(id) {
      const up = walk(id, incoming);
      const down = walk(id, outgoing);
      const nodes = new Set([id, ...up, ...down]);
      nodeEls.forEach((n) => {
        const nid = n.getAttribute('data-id');
        if (nid === id) n.classList.add('is-path-focus');
        else if (up.has(nid)) n.classList.add('is-path-up');
        else if (down.has(nid)) n.classList.add('is-path-down');
        else n.classList.add('is-dim');
      });
      pathEls.forEach((p) => {
        const s = p.getAttribute('data-source');
        const t = p.getAttribute('data-target');
        if (nodes.has(s) && nodes.has(t) && (s === id || t === id || up.has(s) || down.has(t))) p.classList.add('is-on-path');
        else p.classList.add('is-path-dim');
      });
    }
    let presenting = false, step = 0, playing = false, playTimer = 0;
    const presentBox = document.getElementById('present');
    const toggle = document.getElementById('present-toggle');
    function renderPresent() {
      const current = graph.steps[step];
      const seen = new Set();
      const seenEdges = new Set();
      graph.steps.slice(0, step + 1).forEach((item) => {
        seen.add(item.nodeId);
        item.incomingEdgeIds.forEach((id) => seenEdges.add(id));
      });
      clearMarks();
      nodeEls.forEach((n) => {
        const nid = n.getAttribute('data-id');
        if (current && nid === current.nodeId) n.classList.add('is-present-current');
        else if (seen.has(nid)) n.classList.add('is-present-seen');
        else n.classList.add('is-present-hidden');
      });
      pathEls.forEach((p) => {
        const id = p.getAttribute('data-id');
        if (current && current.incomingEdgeIds.includes(id)) p.classList.add('is-present-current');
        else if (seenEdges.has(id)) p.classList.add('is-present-seen');
        else p.classList.add('is-present-hidden');
      });
      document.getElementById('present-count').textContent = 'Paso ' + (graph.steps.length ? step + 1 : 0) + ' / ' + graph.steps.length;
      document.getElementById('present-title').textContent = current ? current.label : '';
      document.getElementById('present-detail').textContent = current ? current.description : '';
    }
    function stopPlay() { playing = false; window.clearInterval(playTimer); document.getElementById('present-play').textContent = 'Reproducir'; }
    function setPresent(on) {
      presenting = on;
      document.body.classList.toggle('presenting', on);
      presentBox.classList.toggle('show', on);
      toggle.textContent = on ? 'Salir' : 'Presentar';
      panel.style.display = 'none';
      stopPlay();
      if (on) { step = 0; renderPresent(); }
      else clearMarks();
    }
    toggle.addEventListener('click', () => setPresent(!presenting));
    document.getElementById('present-prev').addEventListener('click', () => { stopPlay(); step = Math.max(0, step - 1); renderPresent(); });
    document.getElementById('present-next').addEventListener('click', () => { stopPlay(); step = Math.min(graph.steps.length - 1, step + 1); renderPresent(); });
    document.getElementById('present-play').addEventListener('click', () => {
      if (playing) { stopPlay(); return; }
      playing = true;
      document.getElementById('present-play').textContent = 'Pausa';
      playTimer = window.setInterval(() => {
        if (step >= graph.steps.length - 1) { stopPlay(); return; }
        step += 1; renderPresent();
      }, 2200);
    });
    nodeEls.forEach((btn) => {
      btn.addEventListener('mouseenter', () => { if (!presenting) showPath(btn.getAttribute('data-id')); });
      btn.addEventListener('mouseleave', () => { if (!presenting) clearMarks(); });
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (presenting) {
          const index = graph.steps.findIndex((item) => item.nodeId === id);
          if (index >= 0) { stopPlay(); step = index; renderPresent(); }
          return;
        }
        document.querySelectorAll('.node').forEach((n) => n.classList.remove('active'));
        btn.classList.add('active');
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
