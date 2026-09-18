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

function lucide(paths: string, size = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  presentation: lucide(
    `<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>`,
  ),
  play: lucide(`<polygon points="5 3 19 12 5 21 5 3"/>`, 15),
  pause: lucide(
    `<rect x="14" y="4" width="4" height="16"/><rect x="6" y="4" width="4" height="16"/>`,
    15,
  ),
  prev: lucide(`<path d="m15 18-6-6 6-6"/>`),
  next: lucide(`<path d="m9 18 6-6-6-6"/>`),
  restart: lucide(
    `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`,
    15,
  ),
  maximize: lucide(
    `<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>`,
    15,
  ),
  minimize: lucide(
    `<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="10" x2="3" y1="14" y2="21"/>`,
    15,
  ),
  close: lucide(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`, 15),
};

export function diagramToHtml(diagram: Diagram) {
  const scene = sceneFromDiagram(diagram);
  const steps = presentationSteps(diagram);
  const stageW = scene.width;
  const stageH = scene.height;
  const eyebrow = diagram.subtitle || diagram.type;

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
      const extra = edge.kind === "success" ? " is-animated" : "";
      return `<path class="${edge.kind}${extra}" data-id="${esc(edge.id)}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" d="${edge.d}" />`;
    })
    .join("");

  const labelsHtml = scene.edges
    .filter((edge) => edge.label)
    .map(
      (edge) =>
        `<div class="elabel" data-id="${esc(edge.id)}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" style="left:${edge.mid.x}px;top:${edge.mid.y}px">${esc(edge.label ?? "")}</div>`,
    )
    .join("");

  const graphJson = JSON.stringify({
    nodes: scene.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
    })),
    edges: scene.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    steps: steps.map((step) => ({
      nodeId: step.nodeId,
      incomingEdgeIds: step.incomingEdgeIds,
      label: step.label,
      description: step.description ?? "",
      badge: step.badge ?? "",
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    :root {
      --paper: #f3eee4;
      --ink: #171410;
      --muted: #6a6358;
      --line: #ddd4c4;
      --teal: #0f6e5c;
      --clay: #c45c26;
      --card: #fffdf8;
      --shadow: 0 18px 50px rgba(28, 20, 10, 0.08);
      --btn-shadow: 0 6px 8px -3px rgba(23, 20, 16, 0.28);
      --btn-shadow-hover: 0 8px 11px -3px rgba(23, 20, 16, 0.34);
      --font-sans: "Geist", "Segoe UI", system-ui, sans-serif;
      --font-serif: "Instrument Serif", Georgia, serif;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: #ffffff; color: var(--ink);
      font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
    }
    body { display: flex; flex-direction: column; overflow: hidden; }
    .top {
      display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
      padding: 16px 20px 10px; background: var(--card); position: relative; z-index: 8;
    }
    .eyebrow {
      margin: 0 0 8px; letter-spacing: 0.16em; text-transform: uppercase;
      font-size: 11px; color: var(--teal);
    }
    .top h1 {
      margin: 0; font-family: var(--font-serif); font-size: 28px; font-weight: 400;
      letter-spacing: -0.02em;
    }
    button.ghost, button.solid {
      display: inline-flex; align-items: center; gap: 8px;
      border-radius: 999px; padding: 9px 14px; font-size: 13px;
      cursor: pointer; font-family: inherit; color: inherit;
    }
    button.ghost {
      background: #ffffff; border: 1px solid #ffffff;
      box-shadow: var(--btn-shadow);
      transition: box-shadow 0.28s ease, background 0.28s ease;
    }
    button.ghost:hover { box-shadow: var(--btn-shadow-hover); background: rgba(255,253,248,0.7); }
    button.solid {
      background: var(--ink); color: var(--card); border: 1px solid transparent;
    }
    button.solid:hover { background: #2a241d; }
    button.solid:disabled { opacity: 0.35; cursor: default; }
    #shell { flex: 1; min-height: 0; position: relative; background: var(--card); }
    #stagewrap {
      width: 100%; height: 100%; overflow: hidden; cursor: grab;
      background-color: var(--card);
      background-image: radial-gradient(circle, rgba(196,196,196,0.45) 1.4px, transparent 1.5px);
      background-size: 22px 22px;
    }
    #stagewrap:active { cursor: grabbing; }
    body.presenting .top { display: none; }
    body.presenting #stagewrap {
      background-image: none; background-color: #ffffff;
    }
    #stage { position: relative; width: ${stageW}px; height: ${stageH}px; transform-origin: 0 0; }
    .lane {
      position: absolute; border: 1.5px dashed #cbbfaa;
      background: rgba(255, 253, 248, 0.4); border-radius: 16px;
    }
    .lane h3 {
      margin: 0; padding: 16px 22px 0; font-size: 11px; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--teal); font-weight: 500;
    }
    svg.edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    svg.edges path { fill: none; stroke: #8a8174; stroke-width: 1.7; marker-end: url(#arrow); }
    svg.edges path.success { stroke: var(--teal); marker-end: url(#arrow-teal); }
    svg.edges path.warning { stroke: var(--clay); marker-end: url(#arrow-clay); }
    svg.edges path.dash { stroke-dasharray: 7 6; }
    svg.edges path.is-animated,
    svg.edges path.is-on-path,
    svg.edges path.is-present-current {
      stroke-dasharray: 5;
      animation: dashdraw 0.5s linear infinite;
    }
    svg.edges path.is-on-path {
      stroke-width: 2.7; opacity: 1;
      filter: drop-shadow(0 0 4px rgba(15, 110, 92, 0.35));
    }
    svg.edges path.is-on-path.is-flow-up { stroke: var(--teal); marker-end: url(#arrow-teal); }
    svg.edges path.is-on-path.is-flow-down { stroke: var(--clay); marker-end: url(#arrow-clay); }
    svg.edges path.is-path-dim { opacity: 0.12; animation: none; filter: none; }
    svg.edges path.is-present-current {
      stroke: var(--teal); stroke-width: 2.8; opacity: 1; marker-end: url(#arrow-teal);
    }
    svg.edges path.is-present-seen { opacity: 0.92; animation: none; }
    svg.edges path.is-present-hidden { opacity: 0.08; animation: none; filter: none; }
    @keyframes dashdraw {
      from { stroke-dashoffset: 10; }
    }
    .elabel {
      position: absolute; transform: translate(-50%, -50%);
      padding: 3px 8px; font-size: 11px; line-height: 1.2; min-height: 18px;
      color: var(--muted); background: #f4efe6; border-radius: 4px;
      white-space: nowrap; pointer-events: none; z-index: 4; user-select: none;
    }
    .elabel.is-path-dim { opacity: 0.12; }
    .elabel.is-present-hidden { opacity: 0.08; }
    .node {
      position: absolute; border: 2px solid #4d5d73; background: var(--card);
      border-radius: 6px; padding: 8px 12px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      box-shadow: 0 8px 18px rgba(40, 30, 10, 0.06);
      font: inherit; color: inherit; appearance: none;
      transform-origin: center;
    }
    .node:focus, .node:focus-visible { outline: none; }
    .node.active {
      border-color: var(--teal);
      box-shadow: 0 0 0 3px rgba(15, 110, 92, 0.16);
    }
    .node.is-path-focus {
      border-color: var(--teal);
      box-shadow: 0 0 0 4px rgba(15, 110, 92, 0.28), 0 12px 32px rgba(15, 110, 92, 0.16);
      transform: scale(1.04); z-index: 2;
    }
    .node.is-path-up {
      border-color: var(--teal);
      box-shadow: 0 0 0 3px rgba(15, 110, 92, 0.18);
    }
    .node.is-path-down {
      border-color: var(--clay);
      box-shadow: 0 0 0 3px rgba(196, 92, 38, 0.16);
    }
    .node.is-dim { opacity: 0.22; filter: grayscale(0.28); }
    .node.is-present-current {
      border-color: var(--teal); z-index: 3;
      box-shadow: 0 0 0 4px rgba(15, 110, 92, 0.3), 0 14px 36px rgba(15, 110, 92, 0.18);
      animation: present-pulse 1.4s ease-in-out infinite;
    }
    .node.is-present-seen { opacity: 1; }
    .node.is-present-hidden { opacity: 0.12; }
    body.presenting.is-live .node { transition: opacity 0.45s ease; }
    body.presenting.is-live svg.edges path,
    body.presenting.is-live .elabel { transition: opacity 0.45s ease, stroke 0.45s ease; }
    body.presenting:not(.is-live) .node.is-present-current { animation: none; }
    body.is-settling .node,
    body.is-settling svg.edges path,
    body.is-settling .present-bar,
    body.is-settling .present-progress span,
    body.is-settling .node.is-present-current {
      transition: none !important; animation: none !important;
    }
    @keyframes present-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(15, 110, 92, 0.22), 0 10px 24px rgba(15, 110, 92, 0.1); }
      50% { box-shadow: 0 0 0 8px rgba(15, 110, 92, 0.1), 0 14px 32px rgba(15, 110, 92, 0.16); }
    }
    .node strong {
      font-size: 13px; font-weight: 650; line-height: 1.25;
      overflow-wrap: anywhere; text-wrap: pretty;
    }
    .badge {
      position: absolute; top: -8px; right: -8px; background: var(--teal); color: #fff;
      font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 6px;
    }
    .kind-start, .kind-end { border-radius: 999px; }
    .kind-start { background: #e8f5ef; border-color: #2f7d66; }
    .kind-end { background: #f8ece4; border-color: #b44a1f; }
    .kind-decision { background: #fff4cc; border-color: #c3992a; border-radius: 10px; }
    .kind-system { background: #eef3f8; border-color: #4d6a88; }
    .kind-actor { background: #f3efe8; border-color: #7a6a55; }
    .kind-data { background: #eef2f6; border-color: #5b6d82; }
    .kind-io { background: #f3f6ee; border-color: #5d7354; }
    .kind-note, .sticky {
      background: #fff7bf; border: 1px solid #e0c86a; border-radius: 2px;
    }
    .kind-document { background: #f7f3ea; border-color: #8a7a5c; }
    .sticky {
      position: absolute; padding: 10px 12px; font-size: 12px; line-height: 1.4; color: #5a4e32;
    }
    .present-bar {
      position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 12;
      border: 1px solid var(--line); background: rgba(255, 253, 248, 0.94);
      backdrop-filter: blur(12px); border-radius: 18px; box-shadow: var(--shadow);
      overflow: hidden; opacity: 0; transform: translateY(18px); pointer-events: none;
      transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .present-bar.is-in { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .present-progress { height: 3px; background: #efe7d8; }
    .present-progress span {
      display: block; height: 100%; width: 0; background: var(--teal); transition: width 0.35s ease;
    }
    .present-main {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 14px 14px;
    }
    .present-copy { min-width: 0; }
    .present-copy h3 {
      margin: 0; font-family: var(--font-serif); font-size: 20px; font-weight: 400;
    }
    .present-copy p:last-of-type { margin: 4px 0 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
    .present-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .present-play { min-width: 124px; justify-content: center; }
    .icon-btn {
      display: grid; place-items: center; width: 32px; height: 32px;
      border: 1px solid var(--line); background: var(--card); border-radius: 10px;
      cursor: pointer; color: var(--ink); padding: 0;
    }
    .icon-btn:disabled { opacity: 0.35; cursor: default; }
    .present-veil {
      position: fixed; inset: 0; z-index: 16; background: #ffffff;
      opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity 0.52s ease, visibility 0.52s ease;
    }
    .present-veil.is-visible { opacity: 1; visibility: visible; pointer-events: auto; }
    #panel {
      position: absolute; right: 16px; bottom: 16px; width: min(320px, 92vw); z-index: 7;
      background: var(--card); border: 1px solid var(--line); border-radius: 14px;
      padding: 14px 16px; box-shadow: var(--shadow); display: none;
    }
    body.presenting #panel { display: none !important; }
    #panel h2 { margin: 0 0 6px; font-family: var(--font-serif); font-size: 22px; font-weight: 400; }
    #panel p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    @media (prefers-reduced-motion: reduce) {
      .node.is-present-current { animation: none; }
      .present-progress span, .present-bar, .present-veil { transition: none; }
      svg.edges path.is-animated,
      svg.edges path.is-on-path,
      svg.edges path.is-present-current { animation: none; }
    }
    @media (max-width: 720px) {
      .present-main { flex-direction: column; align-items: stretch; }
      .present-controls { justify-content: flex-end; flex-wrap: wrap; }
    }
    @media print {
      .top button, .present-bar, .present-veil, #panel { display: none !important; }
      body.presenting .top { display: flex !important; }
      #stagewrap { overflow: visible; background-image: none; }
      #stage { transform: none !important; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${esc(diagram.title)}</h1>
    </div>
    <button type="button" class="ghost" id="present-toggle">${ICONS.presentation} Presentar</button>
  </header>
  <div id="shell">
    <div id="stagewrap">
      <div id="stage">
        ${groupsHtml}
        <svg class="edges" viewBox="0 0 ${stageW} ${stageH}">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a8174"></path>
            </marker>
            <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f6e5c"></path>
            </marker>
            <marker id="arrow-clay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c45c26"></path>
            </marker>
          </defs>
          ${edgesHtml}
        </svg>
        ${nodesHtml}
        ${labelsHtml}
        ${notesHtml}
      </div>
    </div>
    <div id="present" class="present-bar" role="region" aria-label="Modo presentación" aria-hidden="true" inert>
      <div class="present-progress" aria-hidden="true"><span id="present-progress"></span></div>
      <div class="present-main">
        <div class="present-copy">
          <p class="eyebrow" id="present-count">Paso ${steps.length ? 1 : 0} / ${steps.length}</p>
          <h3 id="present-title"></h3>
          <p id="present-detail"></p>
        </div>
        <div class="present-controls">
          <button type="button" class="icon-btn" id="present-restart" title="Reiniciar">${ICONS.restart}</button>
          <button type="button" class="icon-btn" id="present-prev" title="Anterior">${ICONS.prev}</button>
          <button type="button" class="solid present-play" id="present-play" title="Reproducir">
            <span id="present-play-icon">${ICONS.play}</span>
            <span id="present-play-label">Reproducir</span>
          </button>
          <button type="button" class="icon-btn" id="present-next" title="Siguiente">${ICONS.next}</button>
          <button type="button" class="icon-btn" id="present-full" title="Pantalla completa">${ICONS.maximize}</button>
          <button type="button" class="icon-btn" id="present-exit" title="Salir de la presentación">${ICONS.close}</button>
        </div>
      </div>
    </div>
    <div id="panel"></div>
  </div>
  <div class="present-veil" id="veil" aria-hidden="true"></div>
  <div hidden id="details">${details}</div>
  <script type="application/json" id="graph-data">${graphJson}</script>
  <script>
    const PLAY = ${JSON.stringify(ICONS.play)};
    const PAUSE = ${JSON.stringify(ICONS.pause)};
    const MAXI = ${JSON.stringify(ICONS.maximize)};
    const MINI = ${JSON.stringify(ICONS.minimize)};
    const PRESENT_MS = { cover: 520, hold: 420, reveal: 560, overview: 580, zoom: 980 };
    const stage = document.getElementById('stage');
    const wrap = document.getElementById('stagewrap');
    const shell = document.getElementById('shell');
    const panel = document.getElementById('panel');
    const veil = document.getElementById('veil');
    const presentBox = document.getElementById('present');
    const toggle = document.getElementById('present-toggle');
    const playBtn = document.getElementById('present-play');
    const playIcon = document.getElementById('present-play-icon');
    const playLabel = document.getElementById('present-play-label');
    const fullBtn = document.getElementById('present-full');
    const graph = JSON.parse(document.getElementById('graph-data').textContent || '{"nodes":[],"edges":[],"steps":[]}');
    let scale = 1, x = 24, y = 48, drag = false, lx = 0, ly = 0, camAnim = 0;
    let phase = 'off', phaseTimer = 0, step = 0, playing = false, playTimer = 0, leaveTimer = 0;
    const incomingIds = {}, outgoingIds = {}, edgeById = {};
    graph.edges.forEach((edge) => {
      (outgoingIds[edge.source] ||= []).push(edge.target);
      (incomingIds[edge.target] ||= []).push(edge.source);
      edgeById[edge.id] = edge;
    });
    const nodeEls = [...document.querySelectorAll('.node')];
    const pathEls = [...document.querySelectorAll('svg.edges path[data-id]')];
    const labelEls = [...document.querySelectorAll('.elabel')];
    function prefersReduced() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function wait(ms) { return prefersReduced() ? 0 : ms; }
    function isPresenting() {
      return phase === 'enter-hold' || phase === 'enter-reveal' || phase === 'enter-overview' || phase === 'enter-zoom' || phase === 'live' || phase === 'leave-cover';
    }
    function isOverview() {
      return phase === 'enter-hold' || phase === 'enter-reveal' || phase === 'enter-overview' || phase === 'enter-zoom';
    }
    function apply() { stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; }
    function animateCamera(nx, ny, ns, duration) {
      if (!duration || prefersReduced()) { x = nx; y = ny; scale = ns; apply(); return; }
      const sx = x, sy = y, ss = scale, t0 = performance.now();
      const id = ++camAnim;
      function frame(now) {
        if (id !== camAnim) return;
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        x = sx + (nx - sx) * e;
        y = sy + (ny - sy) * e;
        scale = ss + (ns - ss) * e;
        apply();
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    function fitIds(ids, padding, duration, minZ, maxZ) {
      const set = new Set(ids);
      const boxes = graph.nodes.filter((n) => set.has(n.id));
      if (!boxes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      boxes.forEach((b) => {
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const nextScale = Math.min(maxZ, Math.max(minZ, Math.min(
        wrap.clientWidth / (bw * (1 + padding * 2)),
        wrap.clientHeight / (bh * (1 + padding * 2))
      )));
      animateCamera(
        wrap.clientWidth / 2 - (minX + bw / 2) * nextScale,
        wrap.clientHeight / 2 - (minY + bh / 2) * nextScale,
        nextScale,
        duration
      );
    }
    function fitAll(duration) {
      const pad = isPresenting() ? 0.18 : 0.16;
      const maxZ = isPresenting() ? 1.15 : 1.2;
      fitIds(graph.nodes.map((n) => n.id), pad, duration, 0.08, maxZ);
    }
    function neighborIds(id) {
      const ids = new Set([id]);
      graph.edges.forEach((edge) => {
        if (edge.target === id) ids.add(edge.source);
        if (edge.source === id) ids.add(edge.target);
      });
      return [...ids];
    }
    function followCurrent(duration) {
      const current = graph.steps[step];
      if (!current) { fitAll(duration); return; }
      fitIds(neighborIds(current.nodeId), 0.46, duration, 0.28, 1.12);
    }
    function walk(start, map) {
      const seen = new Set();
      const stack = [start];
      while (stack.length) {
        const id = stack.pop();
        (map[id] || []).forEach((neighbor) => {
          if (seen.has(neighbor)) return;
          seen.add(neighbor);
          stack.push(neighbor);
        });
      }
      return seen;
    }
    function pathFrom(nodeId) {
      const upstream = walk(nodeId, incomingIds);
      const downstream = walk(nodeId, outgoingIds);
      const nodes = new Set([nodeId, ...upstream, ...downstream]);
      const edges = new Set();
      graph.edges.forEach((edge) => {
        if (!nodes.has(edge.source) || !nodes.has(edge.target)) return;
        const climbs = upstream.has(edge.source) && (upstream.has(edge.target) || edge.target === nodeId);
        const drops = downstream.has(edge.target) && (downstream.has(edge.source) || edge.source === nodeId);
        if (climbs || drops || edge.source === nodeId || edge.target === nodeId) edges.add(edge.id);
      });
      return { focus: nodeId, upstream: upstream, downstream: downstream, nodes: nodes, edges: edges };
    }
    function clearMarks() {
      nodeEls.forEach((n) => n.classList.remove('is-path-focus','is-path-up','is-path-down','is-dim','is-present-current','is-present-seen','is-present-hidden','active'));
      pathEls.forEach((p) => p.classList.remove('is-on-path','is-flow-up','is-flow-down','is-path-dim','is-present-current','is-present-seen','is-present-hidden'));
      labelEls.forEach((el) => el.classList.remove('is-on-path','is-path-dim','is-present-hidden','is-present-seen','is-present-current'));
    }
    function showPath(id) {
      const path = pathFrom(id);
      nodeEls.forEach((n) => {
        const nid = n.getAttribute('data-id');
        if (nid === path.focus) n.classList.add('is-path-focus');
        else if (path.upstream.has(nid)) n.classList.add('is-path-up');
        else if (path.downstream.has(nid)) n.classList.add('is-path-down');
        else n.classList.add('is-dim');
      });
      pathEls.forEach((p) => {
        const eid = p.getAttribute('data-id');
        const edge = edgeById[eid];
        if (path.edges.has(eid) && edge) {
          const fromFocus = edge.source === path.focus;
          const toFocus = edge.target === path.focus;
          const up = path.upstream.has(edge.source) || toFocus;
          p.classList.add('is-on-path', fromFocus || !up ? 'is-flow-down' : 'is-flow-up');
        } else p.classList.add('is-path-dim');
      });
      labelEls.forEach((el) => {
        if (path.edges.has(el.getAttribute('data-id'))) el.classList.add('is-on-path');
        else el.classList.add('is-path-dim');
      });
    }
    function refreshPlay() {
      playIcon.innerHTML = playing ? PAUSE : PLAY;
      playLabel.textContent = playing ? 'Pausa' : 'Reproducir';
      playBtn.classList.toggle('is-playing', playing);
      playBtn.title = playing ? 'Pausar' : 'Reproducir';
    }
    function stopPlay() {
      playing = false;
      window.clearInterval(playTimer);
      refreshPlay();
    }
    function syncPlayTimer() {
      window.clearInterval(playTimer);
      if (phase !== 'live' || !playing || !graph.steps.length) return;
      playTimer = window.setInterval(() => {
        if (step >= graph.steps.length - 1) { stopPlay(); return; }
        goTo(step + 1, false);
      }, 2200);
    }
    function updatePresentButtons() {
      const total = graph.steps.length;
      document.getElementById('present-prev').disabled = step <= 0;
      document.getElementById('present-next').disabled = step >= total - 1;
      playBtn.disabled = !total;
      document.getElementById('present-restart').disabled = !total;
    }
    function renderPresent() {
      if (isOverview() || phase === 'enter-cover' || phase === 'off' || phase === 'leave-hold' || phase === 'leave-reveal') {
        if (isOverview()) clearMarks();
        return;
      }
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
      labelEls.forEach((el) => {
        const id = el.getAttribute('data-id');
        if (current && current.incomingEdgeIds.includes(id)) el.classList.add('is-present-current');
        else if (seenEdges.has(id)) el.classList.add('is-present-seen');
        else el.classList.add('is-present-hidden');
      });
      const total = graph.steps.length;
      document.getElementById('present-count').textContent = 'Paso ' + (total ? step + 1 : 0) + ' / ' + total + (current && current.badge ? ' · ' + current.badge : '');
      document.getElementById('present-title').textContent = current ? current.label : 'Sin recuadros';
      const detail = document.getElementById('present-detail');
      detail.textContent = current && current.description ? current.description : '';
      detail.hidden = !(current && current.description);
      document.getElementById('present-progress').style.width = total ? (((step + 1) / total) * 100) + '%' : '0%';
      updatePresentButtons();
    }
    function goTo(index, stop) {
      if (stop !== false) stopPlay();
      step = Math.max(0, Math.min(graph.steps.length - 1, index));
      renderPresent();
      if (phase === 'live' || phase === 'leave-cover') followCurrent(520);
    }
    function applyPhaseChrome() {
      const on = isPresenting();
      document.body.classList.toggle('presenting', on);
      document.body.classList.toggle('is-live', phase === 'live');
      document.body.classList.toggle('is-settling', phase !== 'off' && phase !== 'live' && phase !== 'enter-zoom');
      veil.classList.toggle('is-visible', phase === 'enter-cover' || phase === 'enter-hold' || phase === 'leave-cover' || phase === 'leave-hold');
      const barOn = phase === 'live' || phase === 'leave-cover';
      presentBox.classList.toggle('is-in', barOn);
      presentBox.setAttribute('aria-hidden', barOn ? 'false' : 'true');
      if (barOn) presentBox.removeAttribute('inert');
      else presentBox.setAttribute('inert', '');
      toggle.replaceChildren();
      toggle.insertAdjacentHTML('afterbegin', ${JSON.stringify(ICONS.presentation)});
      toggle.append(on || phase === 'enter-cover' ? 'Salir' : 'Presentar');
    }
    function schedulePhase(next, ms) {
      window.clearTimeout(phaseTimer);
      phaseTimer = window.setTimeout(function () { setPhase(next); }, ms);
    }
    function setPhase(next) {
      phase = next;
      window.clearTimeout(phaseTimer);
      applyPhaseChrome();
      if (next === 'off') {
        stopPlay();
        step = 0;
        clearMarks();
        fitAll(0);
        return;
      }
      if (next === 'enter-cover') { schedulePhase('enter-hold', wait(PRESENT_MS.cover)); return; }
      if (next === 'enter-hold') { clearMarks(); fitAll(0); schedulePhase('enter-reveal', wait(PRESENT_MS.hold)); return; }
      if (next === 'enter-reveal') { schedulePhase('enter-overview', wait(PRESENT_MS.reveal)); return; }
      if (next === 'enter-overview') { fitAll(0); schedulePhase('enter-zoom', wait(PRESENT_MS.overview)); return; }
      if (next === 'enter-zoom') {
        const first = graph.steps[0];
        if (first) fitIds([first.nodeId], 0.5, wait(900), 0.28, 1.12);
        else fitAll(wait(900));
        schedulePhase('live', wait(PRESENT_MS.zoom));
        return;
      }
      if (next === 'live') { renderPresent(); followCurrent(520); syncPlayTimer(); return; }
      if (next === 'leave-cover') { stopPlay(); schedulePhase('leave-hold', wait(PRESENT_MS.cover)); return; }
      if (next === 'leave-hold') { step = 0; clearMarks(); schedulePhase('leave-reveal', wait(PRESENT_MS.hold)); return; }
      if (next === 'leave-reveal') schedulePhase('off', wait(PRESENT_MS.reveal));
    }
    function startPresentation() {
      panel.style.display = 'none';
      playing = true;
      refreshPlay();
      step = 0;
      if (prefersReduced()) { setPhase('live'); return; }
      setPhase('enter-cover');
    }
    function exitPresentation() {
      if (document.fullscreenElement) document.exitFullscreen();
      if (phase === 'off' || String(phase).indexOf('leave') === 0) return;
      if (prefersReduced() || phase === 'enter-cover') { setPhase('leave-reveal'); return; }
      setPhase('leave-cover');
    }
    fitAll(0);
    window.addEventListener('resize', function () {
      if (phase === 'live' || phase === 'leave-cover') followCurrent(0);
      else fitAll(0);
    });
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const next = Math.min(1.8, Math.max(0.08, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
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
    toggle.addEventListener('click', () => {
      if (phase === 'off') startPresentation();
      else if (String(phase).indexOf('leave') !== 0) exitPresentation();
    });
    document.getElementById('present-prev').addEventListener('click', () => goTo(step - 1));
    document.getElementById('present-next').addEventListener('click', () => goTo(step + 1));
    document.getElementById('present-restart').addEventListener('click', () => {
      playing = true; refreshPlay(); goTo(0, false); syncPlayTimer();
    });
    playBtn.addEventListener('click', () => {
      if (playing) { stopPlay(); return; }
      playing = true; refreshPlay(); syncPlayTimer();
    });
    document.getElementById('present-exit').addEventListener('click', exitPresentation);
    fullBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) shell.requestFullscreen();
      else document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      const on = Boolean(document.fullscreenElement);
      fullBtn.innerHTML = on ? MINI : MAXI;
      fullBtn.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
    });
    window.addEventListener('keydown', (event) => {
      if ((event.target.closest && event.target.closest('input, textarea, select'))) return;
      if (event.key === 'Escape' && phase !== 'off') {
        event.preventDefault();
        if (String(phase).indexOf('leave') !== 0) exitPresentation();
        return;
      }
      if (phase !== 'live') return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); goTo(step + 1); }
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goTo(step - 1); }
      else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (playing) stopPlay(); else { playing = true; refreshPlay(); syncPlayTimer(); }
      } else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
      else if (event.key === 'End') { event.preventDefault(); goTo(graph.steps.length - 1); }
    });
    nodeEls.forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        if (isPresenting()) return;
        window.clearTimeout(leaveTimer);
        showPath(btn.getAttribute('data-id'));
      });
      btn.addEventListener('mouseleave', () => {
        if (isPresenting()) return;
        window.clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(() => { if (!isPresenting()) clearMarks(); }, 80);
      });
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (isPresenting()) {
          if (isOverview() || phase !== 'live') return;
          const index = graph.steps.findIndex((item) => item.nodeId === id);
          if (index >= 0) goTo(index);
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
    updatePresentButtons();
    refreshPlay();
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
