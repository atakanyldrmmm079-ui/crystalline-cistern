import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useControls, folder } from "leva";
import "maplibre-gl/dist/maplibre-gl.css";
import "./MapLibreCrystalMap.css";
import PanoramaViewer from "./PanoramaViewer";

const MODES = {
  MAP: "map",
  DETAIL: "detail",
};

const BUILDING_BASE_COLOR = "#173536";
const BUILDING_HOVER_COLOR = "#9ffbf0";
const BUILDING_NETWORK_COLOR = "#9ffbf0";

const MAP_CENTER = [28.9744, 41.0082];

const OVERVIEW_VIEW = {
  center: [28.9748, 41.0102],
  zoom: 12.75,
  pitch: 66,
  bearing: -34,
};

const DETAIL_VIEW = {
  zoom: 13.75,
  pitch: 68,
  bearing: -34,
};

const ISTANBUL_BOUNDS = [
  [28.91, 40.96],
  [29.01, 41.045],
];

const MAP_DESIGN_DEFAULTS = {
  overviewLng: OVERVIEW_VIEW.center[0],
  overviewLat: OVERVIEW_VIEW.center[1],
  overviewZoom: OVERVIEW_VIEW.zoom,
  overviewPitch: OVERVIEW_VIEW.pitch,
  overviewBearing: OVERVIEW_VIEW.bearing,
  detailZoom: DETAIL_VIEW.zoom,
  detailPitch: DETAIL_VIEW.pitch,
  detailBearing: DETAIL_VIEW.bearing,

  terrainEnabled: false,
  terrainExaggeration: 0.72,
  buildingsEnabled: true,
  buildingsMinZoom: 12.35,
  buildingOpacity: 0.32,
  buildingBaseColor: BUILDING_BASE_COLOR,
  buildingHoverColor: BUILDING_HOVER_COLOR,
  buildingNetworkColor: BUILDING_NETWORK_COLOR,
  networkBuildingLimit: 120,

  hoverBuildingsEnabled: false,
  hoverThrottleMs: 180,
  hoverPixelRadius: 8,
  hoverMaxBuildings: 2,
  hoverGlowOpacity: 0.18,
  hoverCoreOpacity: 0.58,

  connectionSteps: 26,
  connectionBend: 0.14,
  connectionWobble: 0.006,
  branchOffsetA: 0.00009,
  branchOffsetB: -0.00011,
  connectionColor: "#71ffe3",
  connectionCoreColor: "#f3fff9",
  connectionShadowWidth: 4.2,
  connectionGlowWidth: 3.0,
  connectionCoreWidth: 2.2,
  connectionBranchWidth: 1.15,
  connectionGlowOpacity: 0.48,
  connectionCoreOpacity: 0.86,
  connectionBranchOpacity: 0.22,
  connectionPulseOpacity: 0.42,
  svgConnectionOverlay: false,

  nodeHaloFocused: 42,
  nodeHaloActive: 32,
  nodeHaloIdle: 23,
  nodeCoreFocused: 8,
  nodeCoreIdle: 5.6,
  nodeHaloOpacity: 0.28,
  nodeCoreOpacity: 0.88,

  logoMarkerEnabled: true,
  logoSize: 62,
  logoHoverSize: 70,
  logoActiveSize: 66,
  logoYOffset: -10,
  logoOpacity: 1,
  logoGlow: 10,
  logoLabelVisible: false,
  logoLabelOpacity: 0,

  hoverRingEnabled: true,
  hoverRingSize: 98,
  hoverRingOpacity: 0.55,
  hoverRingThickness: 1.1,
  hoverRingGlow: 16,
  hoverRingPulseEnabled: false,

  showHeroCopy: false,
  heroOpacity: 0.88,
  showBottomPanel: true,
  bottomPanelOpacity: 0.94,
  bottomPanelY: 0,
  fxOpacity: 0.58,
  vignetteOpacity: 0.70,
  waterVeilOpacity: 0,
  waterVeilHeightVh: 0,
  terrainMaskOpacity: 0,

  backgroundColor: "#071416",
  waterColor: "#0b3440",
  landColor: "#12292b",
  fillColor: "#183435",
  roadColor: "#4d8582",
  waterLineColor: "#23757d",
  lineColor: "#426a68",
};

function overviewFromDesign(design = MAP_DESIGN_DEFAULTS) {
  return {
    center: [design.overviewLng, design.overviewLat],
    zoom: design.overviewZoom,
    pitch: design.overviewPitch,
    bearing: design.overviewBearing,
  };
}

function detailFromDesign(design = MAP_DESIGN_DEFAULTS) {
  return {
    zoom: design.detailZoom,
    pitch: design.detailPitch,
    bearing: design.detailBearing,
  };
}

const MAP_CISTERNS = [
  {
    id: "basilica",
    number: "01",
    name: "Basilica Cistern",
    shortName: "Basilica",
    role: "Origin Crystal",
    color: "#74fff4",
    lngLat: [28.9779, 41.0084],
    distance: "000 m",
    panorama: "/panoramas/basilica.png",
    preview: "/previews/basilica.png",
    text:
      "The first crystal awakens where water once stood still. It becomes the origin core of the underground energy system.",
  },
  {
    id: "binbirdirek",
    number: "02",
    name: "Binbirdirek Cistern",
    shortName: "Binbirdirek",
    role: "Distribution Crystal",
    color: "#4aa8ff",
    lngLat: [28.9728, 41.0069],
    distance: "420 m",
    panorama: "/panoramas/binbirdirek.png",
    preview: "/previews/binbirdirek.png",
    text:
      "Binbirdirek transforms the first signal into routes. Its blue crystal distributes energy through underground paths.",
  },
  {
    id: "gulhane",
    number: "03",
    name: "Gülhane Cistern",
    shortName: "Gülhane",
    role: "Stabilization Crystal",
    color: "#68ff9a",
    lngLat: [28.9834, 41.0132],
    distance: "690 m",
    panorama: "/panoramas/gulhane.png",
    preview: "/previews/gulhane.png",
    text:
      "Gülhane stabilizes the living flow between mineral surfaces, water memory and crystalline pressure.",
  },
  {
    id: "serefiye",
    number: "04",
    name: "Şerefiye Cistern",
    shortName: "Şerefiye",
    role: "Storage Crystal",
    color: "#b277ff",
    lngLat: [28.9748, 41.0102],
    distance: "360 m",
    panorama: "/panoramas/serefiye.png",
    preview: "/previews/serefiye.png",
    text:
      "Şerefiye stores concentrated energy before it enters the wider urban network.",
  },
  {
    id: "fildami",
    number: "05",
    name: "Fildamı Cistern",
    shortName: "Fildamı",
    role: "Release Crystal",
    color: "#fff1c7",
    lngLat: [28.946, 40.997],
    distance: "2.8 km",
    panorama: "/panoramas/fildami.png",
    preview: "/previews/fildami.png",
    text:
      "Fildamı releases the underground energy back toward the city surface.",
  },
];

const CONNECTION_CHAIN = [
  ["fildami", "binbirdirek"],
  ["binbirdirek", "basilica"],
  ["basilica", "serefiye"],
  ["serefiye", "gulhane"],
];

const CONNECTION_SOURCE_ID = "crystal-connections";
const CONNECTION_SHADOW_LAYER_ID = "crystal-connections-shadow";
const CONNECTION_BRANCH_LAYER_ID = "crystal-connections-branches";
const CONNECTION_GLOW_LAYER_ID = "crystal-connections-glow";
const CONNECTION_CORE_LAYER_ID = "crystal-connections-core";
const CONNECTION_PULSE_LAYER_ID = "crystal-connections-pulse";

const HOVER_BUILDING_SOURCE_ID = "crystal-hover-buildings";
const HOVER_BUILDING_GLOW_LAYER_ID = "crystal-hover-buildings-glow";
const HOVER_BUILDING_CORE_LAYER_ID = "crystal-hover-buildings-core";
const HOVER_PIXEL_RADIUS = 8;
const HOVER_MAX_BUILDINGS = 3;

function getNode(id) {
  return MAP_CISTERNS.find((node) => node.id === id) || MAP_CISTERNS[0];
}

function getMapNodeById(id) {
  return MAP_CISTERNS.find((item) => item.id === id);
}

function getCisternLogoPath(node) {
  return `/icons/cisterns/${node.id}.png`;
}

function projectMapNodes(map) {
  if (!map) return [];
  return MAP_CISTERNS.map((node) => {
    const point = map.project(node.lngLat);
    return {
      ...node,
      x: point.x,
      y: point.y,
    };
  });
}

function getBuildingSourceName(map) {
  if (!map || !map.getStyle()) return null;

  const style = map.getStyle();

  if (style.sources?.openmaptiles) return "openmaptiles";
  if (style.sources?.maptiler_planet) return "maptiler_planet";

  return null;
}

function cubicBezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return [
    mt2 * mt * p0[0] +
      3 * mt2 * t * p1[0] +
      3 * mt * t2 * p2[0] +
      t2 * t * p3[0],
    mt2 * mt * p0[1] +
      3 * mt2 * t * p1[1] +
      3 * mt * t2 * p2[1] +
      t2 * t * p3[1],
  ];
}

function createOrganicCurve(start, end, options = {}) {
  const {
    sign = 1,
    steps = MAP_DESIGN_DEFAULTS.connectionSteps,
    bendFactor = MAP_DESIGN_DEFAULTS.connectionBend,
    wobbleFactor = MAP_DESIGN_DEFAULTS.connectionWobble,
  } = options;

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;

  const nx = -dy / len;
  const ny = dx / len;
  const bend = len * bendFactor;
  const wobble = len * wobbleFactor;

  const c1 = [
    start[0] + dx * 0.26 + nx * bend * 0.58 * sign,
    start[1] + dy * 0.24 + ny * bend * 0.58 * sign,
  ];

  const c2 = [
    start[0] + dx * 0.73 + nx * bend * 1.02 * sign,
    start[1] + dy * 0.78 + ny * bend * 1.02 * sign,
  ];

  const coords = [];
  const safeSteps = Math.max(12, Math.floor(steps));

  for (let i = 0; i <= safeSteps; i += 1) {
    const t = i / safeSteps;
    const p = cubicBezierPoint(t, start, c1, c2, end);
    const falloff = Math.sin(t * Math.PI);
    const wob = Math.sin(t * Math.PI * 3.25) * wobble * falloff * sign;

    coords.push([p[0] + nx * wob, p[1] + ny * wob]);
  }

  return coords;
}

function offsetCurve(coords, offsetAmount = 0.00015) {
  return coords.map((point, i, arr) => {
    const prev = arr[Math.max(0, i - 1)];
    const next = arr[Math.min(arr.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    return [point[0] + nx * offsetAmount, point[1] + ny * offsetAmount];
  });
}

function buildConnectionsGeoJSON(activeNodeIds = [], focusId = "basilica", design = MAP_DESIGN_DEFAULTS) {
  const features = [];
  const fullNetwork = activeNodeIds.length >= MAP_CISTERNS.length;

  CONNECTION_CHAIN.forEach(([fromId, toId], index) => {
    const fromNode = getMapNodeById(fromId);
    const toNode = getMapNodeById(toId);
    if (!fromNode || !toNode) return;

    const bothActive = activeNodeIds.includes(fromId) && activeNodeIds.includes(toId);
    const focused = fromId === focusId || toId === focusId;
    const active = fullNetwork || bothActive ? 1 : 0;

    // Do not draw dormant connections. Lines appear only after both nodes are activated.
    if (!active) return;

    const sign = index % 2 === 0 ? 1 : -1;
    const mainCoords = createOrganicCurve(fromNode.lngLat, toNode.lngLat, {
      sign,
      bendFactor: design.connectionBend * (index % 2 === 0 ? 0.92 : 1.08),
      wobbleFactor: design.connectionWobble,
      steps: design.connectionSteps,
    });

    const branchA = offsetCurve(mainCoords, design.branchOffsetA);
    const branchB = offsetCurve(mainCoords, design.branchOffsetB);
    const key = `${fromId}-${toId}`;

    features.push({
      type: "Feature",
      properties: { key, active, focused: focused ? 1 : 0, variant: "main", order: index },
      geometry: { type: "LineString", coordinates: mainCoords },
    });

    if (Math.abs(design.branchOffsetA) > 0.000001) {
      features.push({
        type: "Feature",
        properties: { key: `${key}-branch-a`, active, focused: focused ? 1 : 0, variant: "branch", order: index },
        geometry: { type: "LineString", coordinates: branchA },
      });
    }

    if (Math.abs(design.branchOffsetB) > 0.000001) {
      features.push({
        type: "Feature",
        properties: { key: `${key}-branch-b`, active, focused: focused ? 1 : 0, variant: "branch", order: index },
        geometry: { type: "LineString", coordinates: branchB },
      });
    }
  });

  return { type: "FeatureCollection", features };
}

function makeScreenPath(points) {
  if (!points || points.length < 2) return "";
  return points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

function projectConnectionsForOverlay(map, activeNodeIds = [], focusId = "basilica", design = MAP_DESIGN_DEFAULTS) {
  if (!map || !design.svgConnectionOverlay) return [];

  const geojson = buildConnectionsGeoJSON(activeNodeIds, focusId, design);

  return geojson.features
    .filter((feature) => Number(feature.properties?.active) === 1)
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates || [];
      const points = coordinates.map((coord) => map.project(coord));

      return {
        key: feature.properties.key,
        variant: feature.properties.variant,
        active: Number(feature.properties.active) === 1,
        focused: Number(feature.properties.focused) === 1,
        order: feature.properties.order,
        d: makeScreenPath(points),
      };
    })
    .filter((item) => item.d);
}

function makeNodeGeoJson(activeIds = [], focusId = "basilica") {
  return {
    type: "FeatureCollection",
    features: MAP_CISTERNS.map((node) => ({
      type: "Feature",
      properties: {
        id: node.id,
        number: node.number,
        name: node.name,
        shortName: node.shortName,
        color: node.color,
        active: activeIds.includes(node.id),
        focused: focusId === node.id,
      },
      geometry: {
        type: "Point",
        coordinates: node.lngLat,
      },
    })),
  };
}

function restyleMap(map, design = MAP_DESIGN_DEFAULTS) {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    try {
      const id = layer.id.toLowerCase();

      if (layer.type === "symbol") {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }

      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", design.backgroundColor);
      }

      if (layer.type === "fill") {
        if (id.includes("water") || id.includes("ocean") || id.includes("river") || id.includes("lake")) {
          map.setPaintProperty(layer.id, "fill-color", design.waterColor);
          map.setPaintProperty(layer.id, "fill-opacity", 1);
        } else if (id.includes("land") || id.includes("earth") || id.includes("park")) {
          map.setPaintProperty(layer.id, "fill-color", design.landColor);
          map.setPaintProperty(layer.id, "fill-opacity", 0.96);
        } else {
          map.setPaintProperty(layer.id, "fill-color", design.fillColor);
          map.setPaintProperty(layer.id, "fill-opacity", 0.84);
        }
      }

      if (layer.type === "line") {
        if (id.includes("road") || id.includes("street") || id.includes("path")) {
          map.setPaintProperty(layer.id, "line-color", design.roadColor);
          map.setPaintProperty(layer.id, "line-opacity", 0.24);
          map.setPaintProperty(layer.id, "line-width", 0.62);
        } else if (id.includes("water") || id.includes("river") || id.includes("boundary")) {
          map.setPaintProperty(layer.id, "line-color", design.waterLineColor);
          map.setPaintProperty(layer.id, "line-opacity", 0.34);
        } else if (!layer.id.startsWith("crystal-")) {
          map.setPaintProperty(layer.id, "line-color", design.lineColor);
          map.setPaintProperty(layer.id, "line-opacity", 0.2);
        }
      }

      if (layer.type === "circle" && !layer.id.startsWith("crystal-node")) {
        map.setPaintProperty(layer.id, "circle-opacity", 0);
      }
    } catch {
      // Some style layers may not support all properties.
    }
  });
}

function addMapTilerTerrain(map, design = MAP_DESIGN_DEFAULTS) {
  const key = import.meta.env.VITE_MAPTILER_KEY;
  if (!key) return;

  if (!design.terrainEnabled) {
    try {
      map.setTerrain(null);
    } catch {
      // Ignore terrain removal errors.
    }
    return;
  }

  if (!map.getSource("maptiler-terrain")) {
    map.addSource("maptiler-terrain", {
      type: "raster-dem",
      tiles: [
        `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`,
      ],
      tileSize: 512,
      encoding: "mapbox",
      maxzoom: 13,
    });
  }

  map.setTerrain({
    source: "maptiler-terrain",
    exaggeration: design.terrainExaggeration,
  });
}

function addMapTilerBuildings(map, design = MAP_DESIGN_DEFAULTS) {
  const sourceName = getBuildingSourceName(map);
  if (!sourceName) return;

  if (!design.buildingsEnabled) {
    if (map.getLayer("crystal-buildings-3d")) {
      try { map.removeLayer("crystal-buildings-3d"); } catch {}
    }
    return;
  }

  if (map.getLayer("crystal-buildings-3d")) {
    applyBuildingLayerDesign(map, design);
    return;
  }

  try {
    map.addLayer({
      id: "crystal-buildings-3d",
      source: sourceName,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: design.buildingsMinZoom,
      paint: {
        "fill-extrusion-color": [
          "case",
          ["boolean", ["feature-state", "network"], false],
          design.buildingNetworkColor,
          design.buildingBaseColor,
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          0,
          15,
          ["coalesce", ["get", "render_height"], ["get", "height"], 18],
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": design.buildingOpacity,
      },
    });
  } catch (error) {
    console.warn("3D building layer eklenemedi:", error);
  }
}

function applyBuildingLayerDesign(map, design = MAP_DESIGN_DEFAULTS) {
  if (!map.getLayer("crystal-buildings-3d")) return;

  try {
    map.setLayerZoomRange("crystal-buildings-3d", design.buildingsMinZoom, 24);
    map.setPaintProperty("crystal-buildings-3d", "fill-extrusion-color", [
      "case",
      ["boolean", ["feature-state", "network"], false],
      design.buildingNetworkColor,
      design.buildingBaseColor,
    ]);
    map.setPaintProperty("crystal-buildings-3d", "fill-extrusion-opacity", design.buildingOpacity);
  } catch {
    // Ignore unsupported layer updates.
  }
}

function connectionWidth(base) {
  return ["interpolate", ["linear"], ["zoom"], 10, base * 0.62, 12, base, 14, base * 1.38, 16, base * 1.65];
}

function ensureConnectionLayers(map, activeNodeIds = [], focusId = "basilica", design = MAP_DESIGN_DEFAULTS) {
  const geojson = buildConnectionsGeoJSON(activeNodeIds, focusId, design);

  if (!map.getSource(CONNECTION_SOURCE_ID)) {
    map.addSource(CONNECTION_SOURCE_ID, {
      type: "geojson",
      data: geojson,
      lineMetrics: true,
    });
  } else {
    map.getSource(CONNECTION_SOURCE_ID).setData(geojson);
  }

  if (!map.getLayer(CONNECTION_SHADOW_LAYER_ID)) {
    map.addLayer({
      id: CONNECTION_SHADOW_LAYER_ID,
      type: "line",
      source: CONNECTION_SOURCE_ID,
      filter: ["==", ["get", "variant"], "main"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#010607",
        "line-width": connectionWidth(design.connectionShadowWidth),
        "line-opacity": ["case", ["==", ["get", "active"], 1], 0.7, 0.12],
        "line-blur": 2.4,
      },
    });
  }

  if (!map.getLayer(CONNECTION_BRANCH_LAYER_ID)) {
    map.addLayer({
      id: CONNECTION_BRANCH_LAYER_ID,
      type: "line",
      source: CONNECTION_SOURCE_ID,
      filter: ["==", ["get", "variant"], "branch"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": design.connectionColor,
        "line-width": connectionWidth(design.connectionBranchWidth),
        "line-opacity": ["case", ["==", ["get", "active"], 1], design.connectionBranchOpacity, 0.04],
        "line-blur": 0.42,
      },
    });
  }

  if (!map.getLayer(CONNECTION_GLOW_LAYER_ID)) {
    map.addLayer({
      id: CONNECTION_GLOW_LAYER_ID,
      type: "line",
      source: CONNECTION_SOURCE_ID,
      filter: ["==", ["get", "variant"], "main"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": design.connectionColor,
        "line-width": connectionWidth(design.connectionGlowWidth),
        "line-opacity": ["case", ["==", ["get", "active"], 1], design.connectionGlowOpacity, 0.08],
        "line-blur": 1.7,
      },
    });
  }

  if (!map.getLayer(CONNECTION_CORE_LAYER_ID)) {
    map.addLayer({
      id: CONNECTION_CORE_LAYER_ID,
      type: "line",
      source: CONNECTION_SOURCE_ID,
      filter: ["==", ["get", "variant"], "main"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": design.connectionCoreColor,
        "line-width": connectionWidth(design.connectionCoreWidth),
        "line-opacity": ["case", ["==", ["get", "active"], 1], design.connectionCoreOpacity, 0.12],
      },
    });
  }

  if (!map.getLayer(CONNECTION_PULSE_LAYER_ID)) {
    map.addLayer({
      id: CONNECTION_PULSE_LAYER_ID,
      type: "line",
      source: CONNECTION_SOURCE_ID,
      filter: ["all", ["==", ["get", "variant"], "main"], ["==", ["get", "active"], 1]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": connectionWidth(0.8),
        "line-opacity": design.connectionPulseOpacity,
        "line-dasharray": [0.35, 1.25],
      },
    });
  }

  applyConnectionLayerDesign(map, design);

  [
    CONNECTION_SHADOW_LAYER_ID,
    CONNECTION_BRANCH_LAYER_ID,
    CONNECTION_GLOW_LAYER_ID,
    CONNECTION_CORE_LAYER_ID,
    CONNECTION_PULSE_LAYER_ID,
  ].forEach((id) => {
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      // Ignore move errors.
    }
  });
}

function applyConnectionLayerDesign(map, design = MAP_DESIGN_DEFAULTS) {
  try {
    if (map.getLayer(CONNECTION_SHADOW_LAYER_ID)) {
      map.setPaintProperty(CONNECTION_SHADOW_LAYER_ID, "line-width", connectionWidth(design.connectionShadowWidth));
    }
    if (map.getLayer(CONNECTION_BRANCH_LAYER_ID)) {
      map.setPaintProperty(CONNECTION_BRANCH_LAYER_ID, "line-color", design.connectionColor);
      map.setPaintProperty(CONNECTION_BRANCH_LAYER_ID, "line-width", connectionWidth(design.connectionBranchWidth));
      map.setPaintProperty(CONNECTION_BRANCH_LAYER_ID, "line-opacity", ["case", ["==", ["get", "active"], 1], design.connectionBranchOpacity, 0.04]);
    }
    if (map.getLayer(CONNECTION_GLOW_LAYER_ID)) {
      map.setPaintProperty(CONNECTION_GLOW_LAYER_ID, "line-color", design.connectionColor);
      map.setPaintProperty(CONNECTION_GLOW_LAYER_ID, "line-width", connectionWidth(design.connectionGlowWidth));
      map.setPaintProperty(CONNECTION_GLOW_LAYER_ID, "line-opacity", ["case", ["==", ["get", "active"], 1], design.connectionGlowOpacity, 0.08]);
    }
    if (map.getLayer(CONNECTION_CORE_LAYER_ID)) {
      map.setPaintProperty(CONNECTION_CORE_LAYER_ID, "line-color", design.connectionCoreColor);
      map.setPaintProperty(CONNECTION_CORE_LAYER_ID, "line-width", connectionWidth(design.connectionCoreWidth));
      map.setPaintProperty(CONNECTION_CORE_LAYER_ID, "line-opacity", ["case", ["==", ["get", "active"], 1], design.connectionCoreOpacity, 0.12]);
    }
    if (map.getLayer(CONNECTION_PULSE_LAYER_ID)) {
      map.setPaintProperty(CONNECTION_PULSE_LAYER_ID, "line-opacity", design.connectionPulseOpacity);
    }
  } catch {
    // Ignore style update errors while the map is loading.
  }
}

function applyNodeLayerDesign(map, design = MAP_DESIGN_DEFAULTS) {
  try {
    if (map.getLayer("crystal-node-halo")) {
      map.setPaintProperty("crystal-node-halo", "circle-radius", ["case", ["boolean", ["get", "focused"], false], design.nodeHaloFocused, ["boolean", ["get", "active"], false], design.nodeHaloActive, design.nodeHaloIdle]);
      map.setPaintProperty("crystal-node-halo", "circle-opacity", 0);
    }
    if (map.getLayer("crystal-node-core")) {
      map.setPaintProperty("crystal-node-core", "circle-radius", ["case", ["boolean", ["get", "focused"], false], design.nodeCoreFocused, design.nodeCoreIdle]);
      map.setPaintProperty("crystal-node-core", "circle-opacity", 0);
      map.setPaintProperty("crystal-node-core", "circle-stroke-opacity", design.logoMarkerEnabled ? 0 : 0.86);
    }
  } catch {
    // Ignore style update errors.
  }
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function ensureHoverBuildingLayers(map, design = MAP_DESIGN_DEFAULTS) {
  if (!map.getSource(HOVER_BUILDING_SOURCE_ID)) {
    map.addSource(HOVER_BUILDING_SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(HOVER_BUILDING_GLOW_LAYER_ID)) {
    map.addLayer({
      id: HOVER_BUILDING_GLOW_LAYER_ID,
      type: "fill-extrusion",
      source: HOVER_BUILDING_SOURCE_ID,
      paint: {
        "fill-extrusion-color": design.buildingHoverColor,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 18],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": design.hoverGlowOpacity,
      },
    });
  }

  if (!map.getLayer(HOVER_BUILDING_CORE_LAYER_ID)) {
    map.addLayer({
      id: HOVER_BUILDING_CORE_LAYER_ID,
      type: "fill-extrusion",
      source: HOVER_BUILDING_SOURCE_ID,
      paint: {
        "fill-extrusion-color": design.buildingHoverColor,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 18],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": design.hoverCoreOpacity,
      },
    });
  }

  applyHoverBuildingLayerDesign(map, design);

  try {
    if (map.getLayer(HOVER_BUILDING_GLOW_LAYER_ID)) map.moveLayer(HOVER_BUILDING_GLOW_LAYER_ID);
    if (map.getLayer(HOVER_BUILDING_CORE_LAYER_ID)) map.moveLayer(HOVER_BUILDING_CORE_LAYER_ID);
  } catch {
    // Ignore move errors.
  }
}

function applyHoverBuildingLayerDesign(map, design = MAP_DESIGN_DEFAULTS) {
  try {
    if (map.getLayer(HOVER_BUILDING_GLOW_LAYER_ID)) {
      map.setPaintProperty(HOVER_BUILDING_GLOW_LAYER_ID, "fill-extrusion-color", design.buildingHoverColor);
      map.setPaintProperty(HOVER_BUILDING_GLOW_LAYER_ID, "fill-extrusion-opacity", design.hoverGlowOpacity);
    }
    if (map.getLayer(HOVER_BUILDING_CORE_LAYER_ID)) {
      map.setPaintProperty(HOVER_BUILDING_CORE_LAYER_ID, "fill-extrusion-color", design.buildingHoverColor);
      map.setPaintProperty(HOVER_BUILDING_CORE_LAYER_ID, "fill-extrusion-opacity", design.hoverCoreOpacity);
    }
  } catch {
    // Ignore style update errors.
  }
}

function applyMapDesign(map, design = MAP_DESIGN_DEFAULTS) {
  if (!map || !map.getStyle()) return;
  restyleMap(map, design);
  addMapTilerTerrain(map, design);
  addMapTilerBuildings(map, design);
  ensureHoverBuildingLayers(map, design);
  applyBuildingLayerDesign(map, design);
  applyConnectionLayerDesign(map, design);
  applyHoverBuildingLayerDesign(map, design);
  applyNodeLayerDesign(map, design);
}

export default function MapLibreCrystalMap({
  visible = false,
  designMode = false,
  selected = "basilica",
  setSelected,
  activatedNodes = [],
  setActivatedNodes,
}) {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const overlayRafRef = useRef(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const stageRef = useRef(null);
  const hoveredBuildingIdsRef = useRef([]);
  const networkBuildingIdsRef = useRef([]);
  const buildingRafRef = useRef(null);
  const currentRef = useRef(getNode(selected));
  const activatedNodesRef = useRef(activatedNodes);
  const fullNetworkRef = useRef(false);
  const visibleRef = useRef(visible);
  const lastHoverMoveRef = useRef(0);
  const lastNetworkBuildingUpdateRef = useRef(0);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const mapDesign = useControls("MAP / PERFORMANCE + DESIGN", {
    "Performance": folder({
      terrainEnabled: { value: MAP_DESIGN_DEFAULTS.terrainEnabled },
      terrainExaggeration: { value: MAP_DESIGN_DEFAULTS.terrainExaggeration, min: 0, max: 2, step: 0.01 },
      buildingsEnabled: { value: MAP_DESIGN_DEFAULTS.buildingsEnabled },
      buildingsMinZoom: { value: MAP_DESIGN_DEFAULTS.buildingsMinZoom, min: 10, max: 16, step: 0.05 },
      buildingOpacity: { value: MAP_DESIGN_DEFAULTS.buildingOpacity, min: 0, max: 1, step: 0.01 },
      networkBuildingLimit: { value: MAP_DESIGN_DEFAULTS.networkBuildingLimit, min: 0, max: 1200, step: 10 },
      svgConnectionOverlay: { value: MAP_DESIGN_DEFAULTS.svgConnectionOverlay },
    }),
    "Hover Buildings": folder({
      hoverBuildingsEnabled: { value: MAP_DESIGN_DEFAULTS.hoverBuildingsEnabled },
      hoverThrottleMs: { value: MAP_DESIGN_DEFAULTS.hoverThrottleMs, min: 20, max: 260, step: 5 },
      hoverPixelRadius: { value: MAP_DESIGN_DEFAULTS.hoverPixelRadius, min: 1, max: 28, step: 1 },
      hoverMaxBuildings: { value: MAP_DESIGN_DEFAULTS.hoverMaxBuildings, min: 0, max: 12, step: 1 },
      hoverGlowOpacity: { value: MAP_DESIGN_DEFAULTS.hoverGlowOpacity, min: 0, max: 1, step: 0.01 },
      hoverCoreOpacity: { value: MAP_DESIGN_DEFAULTS.hoverCoreOpacity, min: 0, max: 1, step: 0.01 },
    }),
    "Camera": folder({
      overviewLng: { value: MAP_DESIGN_DEFAULTS.overviewLng, min: 28.91, max: 29.02, step: 0.0001 },
      overviewLat: { value: MAP_DESIGN_DEFAULTS.overviewLat, min: 40.96, max: 41.05, step: 0.0001 },
      overviewZoom: { value: MAP_DESIGN_DEFAULTS.overviewZoom, min: 11.5, max: 15.3, step: 0.01 },
      overviewPitch: { value: MAP_DESIGN_DEFAULTS.overviewPitch, min: 0, max: 80, step: 1 },
      overviewBearing: { value: MAP_DESIGN_DEFAULTS.overviewBearing, min: -180, max: 180, step: 1 },
      detailZoom: { value: MAP_DESIGN_DEFAULTS.detailZoom, min: 12, max: 16, step: 0.01 },
      detailPitch: { value: MAP_DESIGN_DEFAULTS.detailPitch, min: 0, max: 80, step: 1 },
      detailBearing: { value: MAP_DESIGN_DEFAULTS.detailBearing, min: -180, max: 180, step: 1 },
    }),
    "Connections": folder({
      connectionSteps: { value: MAP_DESIGN_DEFAULTS.connectionSteps, min: 16, max: 120, step: 2 },
      connectionBend: { value: MAP_DESIGN_DEFAULTS.connectionBend, min: -0.5, max: 0.5, step: 0.005 },
      connectionWobble: { value: MAP_DESIGN_DEFAULTS.connectionWobble, min: 0, max: 0.06, step: 0.001 },
      branchOffsetA: { value: MAP_DESIGN_DEFAULTS.branchOffsetA, min: -0.0006, max: 0.0006, step: 0.00001 },
      branchOffsetB: { value: MAP_DESIGN_DEFAULTS.branchOffsetB, min: -0.0006, max: 0.0006, step: 0.00001 },
      connectionShadowWidth: { value: MAP_DESIGN_DEFAULTS.connectionShadowWidth, min: 0, max: 28, step: 0.1 },
      connectionGlowWidth: { value: MAP_DESIGN_DEFAULTS.connectionGlowWidth, min: 0, max: 20, step: 0.1 },
      connectionCoreWidth: { value: MAP_DESIGN_DEFAULTS.connectionCoreWidth, min: 0, max: 10, step: 0.05 },
      connectionBranchWidth: { value: MAP_DESIGN_DEFAULTS.connectionBranchWidth, min: 0, max: 8, step: 0.05 },
      connectionGlowOpacity: { value: MAP_DESIGN_DEFAULTS.connectionGlowOpacity, min: 0, max: 1, step: 0.01 },
      connectionCoreOpacity: { value: MAP_DESIGN_DEFAULTS.connectionCoreOpacity, min: 0, max: 1, step: 0.01 },
      connectionBranchOpacity: { value: MAP_DESIGN_DEFAULTS.connectionBranchOpacity, min: 0, max: 1, step: 0.01 },
      connectionPulseOpacity: { value: MAP_DESIGN_DEFAULTS.connectionPulseOpacity, min: 0, max: 1, step: 0.01 },
    }),
    "Nodes + UI": folder({
      nodeHaloFocused: { value: MAP_DESIGN_DEFAULTS.nodeHaloFocused, min: 8, max: 80, step: 1 },
      nodeHaloActive: { value: MAP_DESIGN_DEFAULTS.nodeHaloActive, min: 8, max: 70, step: 1 },
      nodeHaloIdle: { value: MAP_DESIGN_DEFAULTS.nodeHaloIdle, min: 4, max: 60, step: 1 },
      nodeCoreFocused: { value: MAP_DESIGN_DEFAULTS.nodeCoreFocused, min: 2, max: 24, step: 0.5 },
      nodeCoreIdle: { value: MAP_DESIGN_DEFAULTS.nodeCoreIdle, min: 1, max: 18, step: 0.5 },
      nodeHaloOpacity: { value: MAP_DESIGN_DEFAULTS.nodeHaloOpacity, min: 0, max: 1, step: 0.01 },
      nodeCoreOpacity: { value: MAP_DESIGN_DEFAULTS.nodeCoreOpacity, min: 0, max: 1, step: 0.01 },
      showHeroCopy: { value: MAP_DESIGN_DEFAULTS.showHeroCopy },
      heroOpacity: { value: MAP_DESIGN_DEFAULTS.heroOpacity, min: 0, max: 1, step: 0.01 },
      showBottomPanel: { value: MAP_DESIGN_DEFAULTS.showBottomPanel },
      bottomPanelOpacity: { value: MAP_DESIGN_DEFAULTS.bottomPanelOpacity, min: 0, max: 1, step: 0.01 },
      bottomPanelY: { value: MAP_DESIGN_DEFAULTS.bottomPanelY, min: -80, max: 120, step: 1 },
      fxOpacity: { value: MAP_DESIGN_DEFAULTS.fxOpacity, min: 0, max: 1, step: 0.01 },
      vignetteOpacity: { value: MAP_DESIGN_DEFAULTS.vignetteOpacity, min: 0, max: 1, step: 0.01 },
    }),
    "Logo Markers": folder({
      logoMarkerEnabled: { value: MAP_DESIGN_DEFAULTS.logoMarkerEnabled },
      logoSize: { value: MAP_DESIGN_DEFAULTS.logoSize, min: 16, max: 110, step: 1 },
      logoHoverSize: { value: MAP_DESIGN_DEFAULTS.logoHoverSize, min: 18, max: 140, step: 1 },
      logoActiveSize: { value: MAP_DESIGN_DEFAULTS.logoActiveSize, min: 18, max: 130, step: 1 },
      logoYOffset: { value: MAP_DESIGN_DEFAULTS.logoYOffset, min: -90, max: 40, step: 1 },
      logoOpacity: { value: MAP_DESIGN_DEFAULTS.logoOpacity, min: 0, max: 1, step: 0.01 },
      logoGlow: { value: MAP_DESIGN_DEFAULTS.logoGlow, min: 0, max: 80, step: 1 },
      logoLabelVisible: { value: MAP_DESIGN_DEFAULTS.logoLabelVisible },
      logoLabelOpacity: { value: MAP_DESIGN_DEFAULTS.logoLabelOpacity, min: 0, max: 1, step: 0.01 },
    }),
    "Hover Ring": folder({
      hoverRingEnabled: { value: MAP_DESIGN_DEFAULTS.hoverRingEnabled },
      hoverRingSize: { value: MAP_DESIGN_DEFAULTS.hoverRingSize, min: 40, max: 280, step: 1 },
      hoverRingOpacity: { value: MAP_DESIGN_DEFAULTS.hoverRingOpacity, min: 0, max: 1, step: 0.01 },
      hoverRingThickness: { value: MAP_DESIGN_DEFAULTS.hoverRingThickness, min: 0.4, max: 6, step: 0.1 },
      hoverRingGlow: { value: MAP_DESIGN_DEFAULTS.hoverRingGlow, min: 0, max: 90, step: 1 },
      hoverRingPulseEnabled: { value: MAP_DESIGN_DEFAULTS.hoverRingPulseEnabled },
    }),
    "Colors": folder({
      backgroundColor: MAP_DESIGN_DEFAULTS.backgroundColor,
      waterColor: MAP_DESIGN_DEFAULTS.waterColor,
      landColor: MAP_DESIGN_DEFAULTS.landColor,
      fillColor: MAP_DESIGN_DEFAULTS.fillColor,
      roadColor: MAP_DESIGN_DEFAULTS.roadColor,
      waterLineColor: MAP_DESIGN_DEFAULTS.waterLineColor,
      lineColor: MAP_DESIGN_DEFAULTS.lineColor,
      buildingBaseColor: MAP_DESIGN_DEFAULTS.buildingBaseColor,
      buildingHoverColor: MAP_DESIGN_DEFAULTS.buildingHoverColor,
      buildingNetworkColor: MAP_DESIGN_DEFAULTS.buildingNetworkColor,
      connectionColor: MAP_DESIGN_DEFAULTS.connectionColor,
      connectionCoreColor: MAP_DESIGN_DEFAULTS.connectionCoreColor,
    }),
  });

  const mapDesignRef = useRef(mapDesign);

  const [mode, setMode] = useState(MODES.MAP);
  const [current, setCurrent] = useState(getNode(selected));
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const [panoramaNode, setPanoramaNode] = useState(null);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [screenConnections, setScreenConnections] = useState([]);
  const [nodeScreenPositions, setNodeScreenPositions] = useState([]);

  const fullNetwork = activatedNodes.length >= MAP_CISTERNS.length;
  const focusId = hovered || current.id;
  const hoverNode = hovered ? getNode(hovered) : null;

  const mapStyle = useMemo(() => {
    const key = import.meta.env.VITE_MAPTILER_KEY;

    if (!key) {
      console.warn("VITE_MAPTILER_KEY eksik. .env dosyasını kontrol et.");
      return "https://demotiles.maplibre.org/style.json";
    }

    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
  }, []);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    mapDesignRef.current = mapDesign;
  }, [mapDesign]);

  useEffect(() => {
    visibleRef.current = visible;
    const map = mapRef.current;
    if (map) {
      map.repaint = visible;
    }
  }, [visible]);

  useEffect(() => {
    activatedNodesRef.current = activatedNodes;
    fullNetworkRef.current = activatedNodes.length >= MAP_CISTERNS.length;
  }, [activatedNodes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (zoomEnabled) {
      map.scrollZoom.enable();
    } else {
      map.scrollZoom.disable();
    }
  }, [zoomEnabled]);

  function updateConnectionSource(nextFocusId = focusId, nextActiveIds = activatedNodesRef.current) {
    const map = mapRef.current;
    if (!map || !map.getSource(CONNECTION_SOURCE_ID)) return;

    const design = mapDesignRef.current;
    map.getSource(CONNECTION_SOURCE_ID).setData(buildConnectionsGeoJSON(nextActiveIds, nextFocusId, design));
    updateScreenConnectionOverlay(nextFocusId, nextActiveIds);
  }

  function updateScreenConnectionOverlay(nextFocusId = focusId, nextActiveIds = activatedNodesRef.current) {
    const map = mapRef.current;
    const design = mapDesignRef.current;
    if (!map) return;

    if (!design.svgConnectionOverlay) {
      setScreenConnections((prev) => (prev.length ? [] : prev));
      return;
    }

    setScreenConnections(projectConnectionsForOverlay(map, nextActiveIds, nextFocusId, design));
  }

  function updateNodeSource(nextFocusId = focusId, nextActiveIds = activatedNodesRef.current) {
    const map = mapRef.current;
    if (!map || !map.getSource("crystal-nodes")) return;

    map.getSource("crystal-nodes").setData(makeNodeGeoJson(nextActiveIds, nextFocusId));
  }

  function clearHoveredBuildings() {
    const map = mapRef.current;
    if (!map || !map.getSource(HOVER_BUILDING_SOURCE_ID)) return;

    try {
      map.getSource(HOVER_BUILDING_SOURCE_ID).setData(emptyFeatureCollection());
    } catch {
      // Ignore source update errors.
    }

    hoveredBuildingIdsRef.current = [];
  }

  function updateHoveredBuildings(point) {
    const map = mapRef.current;
    const design = mapDesignRef.current;

    if (
      !visibleRef.current ||
      !design.hoverBuildingsEnabled ||
      !map ||
      !map.getLayer("crystal-buildings-3d") ||
      !map.getSource(HOVER_BUILDING_SOURCE_ID) ||
      fullNetworkRef.current
    ) {
      return;
    }

    const features = map.queryRenderedFeatures(
      [
        [point.x - design.hoverPixelRadius, point.y - design.hoverPixelRadius],
        [point.x + design.hoverPixelRadius, point.y + design.hoverPixelRadius],
      ],
      { layers: ["crystal-buildings-3d"] }
    );

    const seen = new Set();
    const hoverFeatures = [];

    for (const feature of features) {
      if (!feature?.geometry) continue;
      if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;

      const key = feature.id ?? `${JSON.stringify(feature.geometry.coordinates?.[0]?.[0] || [])}-${hoverFeatures.length}`;
      if (seen.has(key)) continue;
      seen.add(key);

      hoverFeatures.push({
        type: "Feature",
        properties: { ...feature.properties },
        geometry: feature.geometry,
      });

      if (hoverFeatures.length >= design.hoverMaxBuildings) break;
    }

    map.getSource(HOVER_BUILDING_SOURCE_ID).setData({
      type: "FeatureCollection",
      features: hoverFeatures,
    });
  }

  function setNetworkBuildingsActive(isActive) {
    const map = mapRef.current;
    if (!map || !map.getLayer("crystal-buildings-3d")) return;

    const sourceName = getBuildingSourceName(map);
    if (!sourceName) return;

    networkBuildingIdsRef.current.forEach((id) => {
      try {
        map.setFeatureState({ source: sourceName, sourceLayer: "building", id }, { network: false });
      } catch {
        // Ignore unsupported features.
      }
    });
    networkBuildingIdsRef.current = [];

    if (!isActive) return;

    const now = performance.now();
    if (now - lastNetworkBuildingUpdateRef.current < 1200 && networkBuildingIdsRef.current.length) {
      return;
    }
    lastNetworkBuildingUpdateRef.current = now;

    const features = map.queryRenderedFeatures({ layers: ["crystal-buildings-3d"] });
    const ids = [
      ...new Set(features.map((feature) => feature.id).filter((id) => id !== undefined && id !== null)),
    ].slice(0, mapDesignRef.current.networkBuildingLimit);

    ids.forEach((id) => {
      try {
        map.setFeatureState({ source: sourceName, sourceLayer: "building", id }, { network: true });
      } catch {
        // Ignore unsupported features.
      }
    });

    networkBuildingIdsRef.current = ids;
  }

  function activateNode(node) {
    const activeNow = activatedNodesRef.current;
    const nextActive = activeNow.includes(node.id) ? activeNow : [...activeNow, node.id];

    setCurrent(node);
    setSelected?.(node.id);
    setActivatedNodes?.(nextActive);
    activatedNodesRef.current = nextActive;

    updateConnectionSource(node.id, nextActive);
    updateNodeSource(node.id, nextActive);

    return nextActive;
  }

  function selectNode(node, shouldZoom = true) {
    const nextActive = activateNode(node);

    setMode(MODES.DETAIL);
    setHovered(null);

    updateConnectionSource(node.id, nextActive);
    updateNodeSource(node.id, nextActive);

    if (shouldZoom) {
      mapRef.current?.easeTo({
        center: node.lngLat,
        zoom: detailFromDesign(mapDesignRef.current).zoom,
        pitch: detailFromDesign(mapDesignRef.current).pitch,
        bearing: detailFromDesign(mapDesignRef.current).bearing,
        duration: 850,
        easing: (t) => t * t * (3 - 2 * t),
        essential: true,
      });
    }
  }

  function openPanorama(node) {
    activateNode(node);
    setHovered(null);
    setMode(MODES.DETAIL);
    setPanoramaNode(node);
  }

  function closePanorama() {
    setPanoramaNode(null);
  }

  function startNodePress(node) {
    longPressTriggeredRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openPanorama(node);
    }, 650);
  }

  function endNodePress(node) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!longPressTriggeredRef.current) {
      selectNode(node);
    }
  }

  function backToMap() {
    setMode(MODES.MAP);

    mapRef.current?.easeTo({
      center: overviewFromDesign(mapDesignRef.current).center,
      zoom: overviewFromDesign(mapDesignRef.current).zoom,
      pitch: overviewFromDesign(mapDesignRef.current).pitch,
      bearing: overviewFromDesign(mapDesignRef.current).bearing,
      speed: 0.8,
      curve: 1.25,
      essential: true,
    });
  }

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: overviewFromDesign(mapDesignRef.current).center,
      zoom: overviewFromDesign(mapDesignRef.current).zoom,
      pitch: overviewFromDesign(mapDesignRef.current).pitch,
      bearing: overviewFromDesign(mapDesignRef.current).bearing,
      maxBounds: ISTANBUL_BOUNDS,
      minZoom: 12.1,
      maxZoom: 14.8,
      renderWorldCopies: false,
      refreshExpiredTiles: false,
      attributionControl: false,
      dragRotate: true,
      fadeDuration: 0,
      antialias: false,
      maxTileCacheSize: mobile ? 64 : 128,
    });

    mapRef.current = map;

    // Default: page scroll remains active. Use the control panel to enable map wheel zoom.
    map.scrollZoom.disable();
    map.scrollZoom.setWheelZoomRate(1 / 450);

    map.on("load", () => {
      map.resize();
      applyMapDesign(map, mapDesignRef.current);

      ensureConnectionLayers(map, activatedNodesRef.current, currentRef.current.id, mapDesignRef.current);
      updateScreenConnectionOverlay(currentRef.current.id, activatedNodesRef.current);

      const syncMapOverlays = () => {
        if (overlayRafRef.current) return;

        overlayRafRef.current = requestAnimationFrame(() => {
          overlayRafRef.current = null;

          if (mapDesignRef.current.svgConnectionOverlay) {
            updateScreenConnectionOverlay(currentRef.current.id, activatedNodesRef.current);
          }

          setNodeScreenPositions(projectMapNodes(map));
        });
      };

      map.on("move", syncMapOverlays);
      map.on("zoom", syncMapOverlays);
      map.on("rotate", syncMapOverlays);
      map.on("pitch", syncMapOverlays);
      map.on("resize", syncMapOverlays);
      setNodeScreenPositions(projectMapNodes(map));

      map.addSource("crystal-nodes", {
        type: "geojson",
        data: makeNodeGeoJson(activatedNodesRef.current, currentRef.current.id),
      });

      map.addLayer({
        id: "crystal-node-halo",
        type: "circle",
        source: "crystal-nodes",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "focused"], false], mapDesignRef.current.nodeHaloFocused, ["boolean", ["get", "active"], false], mapDesignRef.current.nodeHaloActive, mapDesignRef.current.nodeHaloIdle],
          "circle-color": ["get", "color"],
          "circle-opacity": mapDesignRef.current.logoMarkerEnabled ? 0 : ["case", ["boolean", ["get", "focused"], false], mapDesignRef.current.nodeHaloOpacity, ["boolean", ["get", "active"], false], mapDesignRef.current.nodeHaloOpacity * 0.72, mapDesignRef.current.nodeHaloOpacity * 0.42],
          "circle-blur": 0.82,
        },
      });

      map.addLayer({
        id: "crystal-node-core",
        type: "circle",
        source: "crystal-nodes",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "focused"], false], mapDesignRef.current.nodeCoreFocused, mapDesignRef.current.nodeCoreIdle],
          "circle-color": ["get", "color"],
          "circle-opacity": mapDesignRef.current.logoMarkerEnabled ? 0 : ["case", ["boolean", ["get", "focused"], false], mapDesignRef.current.nodeCoreOpacity, mapDesignRef.current.nodeCoreOpacity * 0.82],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["get", "focused"], false], 2.2, 1.2],
          "circle-stroke-opacity": mapDesignRef.current.logoMarkerEnabled ? 0 : 0.86,
        },
      });

      map.addLayer({
        id: "crystal-node-labels",
        type: "symbol",
        source: "crystal-nodes",
        layout: {
          "text-field": ["get", "number"],
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -1.15],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#001011",
          "text-halo-width": 1.4,
          "text-opacity": 0,
        },
      });

      applyNodeLayerDesign(map, mapDesignRef.current);

      map.on("mousedown", "crystal-node-core", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;
        startNodePress(getNode(id));
      });

      map.on("mouseup", "crystal-node-core", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;
        endNodePress(getNode(id));
      });

      map.on("touchstart", "crystal-node-core", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;
        startNodePress(getNode(id));
      });

      map.on("touchend", "crystal-node-core", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;
        endNodePress(getNode(id));
      });

      map.on("mouseenter", "crystal-node-core", (event) => {
        map.getCanvas().style.cursor = "pointer";
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;

        const node = getNode(id);
        setHovered(id);
        setCurrent(node);
        updateConnectionSource(id);
        updateNodeSource(id);
      });

      map.on("mouseleave", "crystal-node-core", () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        map.getCanvas().style.cursor = "";
        const currentNode = currentRef.current;
        setHovered(null);
        updateConnectionSource(currentNode.id);
        updateNodeSource(currentNode.id);
      });

      setReady(true);
    });

    map.on("mousemove", (event) => {
      const design = mapDesignRef.current;
      if (!visibleRef.current || fullNetworkRef.current || !design.hoverBuildingsEnabled) return;

      const now = performance.now();
      if (now - lastHoverMoveRef.current < design.hoverThrottleMs) return;
      lastHoverMoveRef.current = now;

      const point = { x: event.point.x, y: event.point.y };

      if (buildingRafRef.current) cancelAnimationFrame(buildingRafRef.current);
      if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);

      buildingRafRef.current = requestAnimationFrame(() => {
        updateHoveredBuildings(point);
      });
    });

    map.on("mouseleave", () => {
      clearHoveredBuildings();
    });

    map.on("moveend", () => {
      if (fullNetworkRef.current) {
        setNetworkBuildingsActive(true);
      }
    });

    return () => {
      if (buildingRafRef.current) cancelAnimationFrame(buildingRafRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      clearHoveredBuildings();
      setNetworkBuildingsActive(false);

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    updateConnectionSource(focusId, activatedNodes);
    updateNodeSource(focusId, activatedNodes);

    if (fullNetwork) {
      clearHoveredBuildings();
      setNetworkBuildingsActive(true);
    } else {
      setNetworkBuildingsActive(false);
    }
  }, [activatedNodes, focusId, fullNetwork, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    applyMapDesign(map, mapDesign);
    updateConnectionSource(focusId, activatedNodesRef.current);
    updateNodeSource(focusId, activatedNodesRef.current);
    updateScreenConnectionOverlay(focusId, activatedNodesRef.current);
    updateNodeScreenPositions();
  }, [mapDesign, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;

    setTimeout(() => {
      map.resize();
      map.flyTo({
        center: overviewFromDesign(mapDesignRef.current).center,
        zoom: overviewFromDesign(mapDesignRef.current).zoom,
        pitch: overviewFromDesign(mapDesignRef.current).pitch,
        bearing: overviewFromDesign(mapDesignRef.current).bearing,
        speed: 0.75,
        curve: 1.25,
        essential: true,
      });
      updateNodeScreenPositions();
    }, 120);
  }, [visible]);

  function updateNodeScreenPositions() {
    const map = mapRef.current;
    if (!map) return;
    setNodeScreenPositions(projectMapNodes(map));
  }

  function handleMarkerEnter(node) {
    setHovered(node.id);
    setCurrent(node);
    updateConnectionSource(node.id);
    updateNodeSource(node.id);
  }

  function handleMarkerLeave() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const currentNode = currentRef.current;
    setHovered(null);
    updateConnectionSource(currentNode.id);
    updateNodeSource(currentNode.id);
  }

  function handleMouseMove(event) {
    if (!stageRef.current) return;

    const rect = stageRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;

    stageRef.current.style.setProperty("--mx", `${px}%`);
    stageRef.current.style.setProperty("--my", `${py}%`);
  }

  return (
    <section
      ref={stageRef}
      className={`mapLibreCrystalStage ${visible ? "show" : ""} mode-${mode} ${
        ready ? "ready" : ""
      } ${fullNetwork ? "network-complete" : ""} ${mapDesign.svgConnectionOverlay ? "svg-connections-on" : "svg-connections-off"}`}
      onMouseMove={handleMouseMove}
      style={{
        "--ml-fx-opacity": mapDesign.fxOpacity,
        "--ml-vignette-opacity": mapDesign.vignetteOpacity,
      }}
    >
      <div ref={mapContainer} className="mlMapCanvas" />

      <style>{`
        /* v5: water/terrain band overlays removed completely. */


        /* FINAL MAP BAND KILL SWITCH: imported CSS may still define these as absolute overlays. */
        .mapLibreCrystalStage .mlCityGlow,
        .mapLibreCrystalStage .mlMapLight,
        .mapLibreCrystalStage .mlCrystalField,
        .mapLibreCrystalStage .mlScanGrid,
        .mapLibreCrystalStage .mlHeavyVignette,
        .mapLibreCrystalStage .mlTerrainMask,
        .mapLibreCrystalStage .mlWaterVeil {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        .mlLogoMarkerLayer {
          position: absolute;
          inset: 0;
          z-index: 40;
          pointer-events: none;
          background: transparent;
          filter: none;
        }

        .mlLogoMarker {
          position: absolute;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 0 !important;
          max-height: none !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          outline: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          pointer-events: auto;
          transform: translate(-50%, -50%);
          cursor: pointer;
          color: #eafffb;
          overflow: visible !important;
          transition: transform 180ms ease, filter 180ms ease, opacity 180ms ease;
        }

        .mlLogoMarkerInner {
          position: relative;
          display: grid;
          place-items: center;
          width: var(--logo-size);
          height: var(--logo-size);
          border-radius: 999px;
          isolation: isolate;
          overflow: visible;
          background: transparent !important;
          box-shadow: none !important;
        }

        .mlHoverPin,
        .mlHoverRing {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          animation: none !important;
        }

        .mlLogoMarkerInner::before {
          content: "";
          position: absolute;
          inset: -12px;
          border-radius: 999px;
          background:
            radial-gradient(
              circle at 50% 50%,
              color-mix(in srgb, var(--node-color) 36%, white) 0%,
              color-mix(in srgb, var(--node-color) 22%, transparent) 34%,
              transparent 72%
            );
          filter: blur(12px);
          opacity: 0.72;
          z-index: 0;
          pointer-events: none;
          transform: scale(0.92);
          transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease;
        }

        .mlLogoMarkerInner::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          background:
            linear-gradient(
              135deg,
              transparent 0%,
              rgba(255,255,255,0.28) 34%,
              transparent 48%,
              rgba(255,255,255,0.08) 62%,
              transparent 100%
            );
          mix-blend-mode: screen;
          opacity: 0.34;
          z-index: 3;
          pointer-events: none;
          transform: rotate(-18deg);
          transition: opacity 220ms ease, transform 220ms ease;
        }

        .mlLogoMarkerIcon {
          position: relative;
          width: var(--logo-size);
          height: var(--logo-size);
          object-fit: contain;
          display: block;
          opacity: var(--logo-opacity);
          z-index: 2;
          filter:
            drop-shadow(0 0 8px color-mix(in srgb, var(--node-color) 78%, transparent))
            drop-shadow(0 0 var(--logo-glow) color-mix(in srgb, var(--node-color) 68%, transparent))
            drop-shadow(0 8px 18px rgba(0,0,0,0.58));
          transition: width 180ms ease, height 180ms ease, transform 180ms ease, filter 180ms ease, opacity 180ms ease;
        }

        .mlLogoMarkerFallback {
          position: relative;
          width: var(--logo-size);
          height: var(--logo-size);
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--node-color) 70%, white);
          background:
            radial-gradient(circle at 50% 42%, rgba(255,255,255,0.9), var(--node-color) 28%, rgba(4,18,20,0.88) 72%);
          box-shadow:
            0 0 var(--logo-glow) color-mix(in srgb, var(--node-color) 78%, transparent),
            inset 0 0 16px rgba(255,255,255,0.20);
          color: rgba(0, 14, 16, 0.82);
          font-size: 10px;
          font-weight: 800;
          display: grid;
          place-items: center;
          z-index: 2;
        }

        .mlLogoMarkerLabel {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          color: rgba(240,255,252,var(--label-opacity));
          font-size: 8px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-shadow:
            0 0 16px rgba(0,0,0,0.9),
            0 0 14px color-mix(in srgb, var(--node-color) 60%, transparent);
          opacity: 0;
          transition: opacity 160ms ease, transform 160ms ease;
          pointer-events: none;
        }

        .mlLogoMarker.is-hovered .mlLogoMarkerLabel,
        .mlLogoMarker.is-active .mlLogoMarkerLabel {
          opacity: 1;
          transform: translateX(-50%) translateY(1px);
        }

        .mlLogoMarker:hover .mlLogoMarkerInner::before,
        .mlLogoMarker.is-hovered .mlLogoMarkerInner::before {
          opacity: 1;
          transform: scale(1.14);
          filter: blur(15px);
        }

        .mlLogoMarker:hover .mlLogoMarkerInner::after,
        .mlLogoMarker.is-hovered .mlLogoMarkerInner::after {
          opacity: 0.62;
          transform: rotate(12deg) scale(1.12);
        }

        .mlLogoMarker:hover .mlLogoMarkerIcon,
        .mlLogoMarker.is-hovered .mlLogoMarkerIcon {
          width: var(--logo-hover-size);
          height: var(--logo-hover-size);
          transform: scale(1.06);
          filter:
            drop-shadow(0 0 12px color-mix(in srgb, var(--node-color) 90%, white))
            drop-shadow(0 0 calc(var(--logo-glow) * 1.35) color-mix(in srgb, var(--node-color) 82%, transparent))
            drop-shadow(0 0 22px rgba(255,255,255,0.24))
            drop-shadow(0 10px 22px rgba(0,0,0,0.62));
        }

        .mlLogoMarker.is-active .mlLogoMarkerInner::before {
          opacity: 1;
          transform: scale(1.22);
          filter: blur(18px);
        }

        .mlLogoMarker.is-active .mlLogoMarkerIcon {
          width: var(--logo-active-size);
          height: var(--logo-active-size);
          transform: scale(1.08);
          filter:
            drop-shadow(0 0 14px color-mix(in srgb, var(--node-color) 100%, white))
            drop-shadow(0 0 calc(var(--logo-glow) * 1.55) color-mix(in srgb, var(--node-color) 88%, transparent))
            drop-shadow(0 0 28px rgba(255,255,255,0.28))
            drop-shadow(0 12px 26px rgba(0,0,0,0.65));
        }
      

        /* V17 PLAIN ICONS: no glow, no aura, no hover ring, no shimmer. */
        .mlHoverPin,
        .mlHoverRing {
          display: none !important;
          opacity: 0 !important;
          animation: none !important;
        }

        .mlLogoMarker {
          width: auto !important;
          height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
        }

        .mlLogoMarkerInner {
          width: var(--logo-size) !important;
          height: var(--logo-size) !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          filter: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .mlLogoMarkerInner::before,
        .mlLogoMarkerInner::after {
          display: none !important;
          content: none !important;
          opacity: 0 !important;
          animation: none !important;
        }

        .mlLogoMarkerIcon {
          width: var(--logo-size) !important;
          height: var(--logo-size) !important;
          object-fit: contain !important;
          opacity: var(--logo-opacity) !important;
          filter: none !important;
          box-shadow: none !important;
          transform: none !important;
          transition: width 140ms ease, height 140ms ease, opacity 140ms ease !important;
        }

        .mlLogoMarker:hover .mlLogoMarkerIcon,
        .mlLogoMarker.is-hovered .mlLogoMarkerIcon {
          width: var(--logo-hover-size) !important;
          height: var(--logo-hover-size) !important;
          filter: none !important;
          box-shadow: none !important;
          transform: none !important;
        }

        .mlLogoMarker.is-active .mlLogoMarkerIcon {
          width: var(--logo-active-size) !important;
          height: var(--logo-active-size) !important;
          filter: none !important;
          box-shadow: none !important;
          transform: none !important;
        }

        .mlLogoMarkerFallback {
          box-shadow: none !important;
          filter: none !important;
        }


        /* V52: larger crystal icons + stable hover circle + larger hit area */
        .mlLogoMarker {
          min-width: calc(var(--logo-hover-size) + 38px) !important;
          min-height: calc(var(--logo-hover-size) + 38px) !important;
          display: grid !important;
          place-items: center !important;
          touch-action: manipulation !important;
        }

        .mlLogoMarkerInner {
          width: var(--logo-size) !important;
          height: var(--logo-size) !important;
        }

        .mlLogoMarkerRing {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          width: var(--ring-size) !important;
          height: var(--ring-size) !important;
          border-radius: 999px !important;
          transform: translate(-50%, -50%) scale(0.88) !important;
          border: var(--ring-thickness) solid color-mix(in srgb, var(--node-color) 62%, white) !important;
          background:
            radial-gradient(circle, color-mix(in srgb, var(--node-color) 14%, transparent), transparent 64%),
            rgba(2, 10, 11, 0.04) !important;
          box-shadow:
            0 0 var(--ring-glow) color-mix(in srgb, var(--node-color) 38%, transparent),
            inset 0 0 26px rgba(255,255,255,0.035) !important;
          opacity: 0 !important;
          z-index: 1 !important;
          pointer-events: none !important;
          transition: opacity 160ms ease, transform 160ms ease !important;
          animation: none !important;
        }

        .mlLogoMarker:hover .mlLogoMarkerRing,
        .mlLogoMarker.is-hovered .mlLogoMarkerRing,
        .mlLogoMarker.is-active .mlLogoMarkerRing {
          opacity: var(--ring-opacity) !important;
          transform: translate(-50%, -50%) scale(1) !important;
        }

        .mlLogoMarkerIcon {
          width: var(--logo-size) !important;
          height: var(--logo-size) !important;
          transform: scale(1) !important;
        }

        .mlLogoMarker:hover .mlLogoMarkerIcon,
        .mlLogoMarker.is-hovered .mlLogoMarkerIcon {
          width: var(--logo-hover-size) !important;
          height: var(--logo-hover-size) !important;
          transform: scale(1.04) !important;
        }

        .mlLogoMarker.is-active .mlLogoMarkerIcon {
          width: var(--logo-active-size) !important;
          height: var(--logo-active-size) !important;
          transform: scale(1.04) !important;
        }

      `}</style>

      {mapDesign.logoMarkerEnabled && (
        <div className="mlLogoMarkerLayer" aria-hidden={false}>
          {nodeScreenPositions.map((node) => {
            const isHovered = hovered === node.id;
            const isActive = false;
            return (
              <button
                key={node.id}
                type="button"
                className={`mlLogoMarker ${isHovered ? "is-hovered" : ""} ${isActive ? "is-active" : ""} ${mapDesign.hoverRingPulseEnabled ? "is-pulse" : ""}`}
                style={{
                  left: node.x,
                  top: node.y + mapDesign.logoYOffset,
                  "--node-color": node.color,
                  "--logo-size": `${mapDesign.logoSize}px`,
                  "--logo-hover-size": `${mapDesign.logoHoverSize}px`,
                  "--logo-active-size": `${mapDesign.logoActiveSize}px`,
                  "--logo-opacity": mapDesign.logoOpacity,
                  "--logo-glow": `${mapDesign.logoGlow}px`,
                  "--ring-size": `${mapDesign.hoverRingSize}px`,
                  "--ring-opacity": mapDesign.hoverRingEnabled ? mapDesign.hoverRingOpacity : 0,
                  "--ring-thickness": `${mapDesign.hoverRingThickness}px`,
                  "--ring-glow": `${mapDesign.hoverRingGlow}px`,
                  "--label-opacity": mapDesign.logoLabelOpacity,
                }}
                onMouseEnter={() => handleMarkerEnter(node)}
                onMouseLeave={handleMarkerLeave}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onMouseUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectNode(node);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPanorama(node);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  startNodePress(node);
                }}
                onTouchEnd={(event) => {
                  event.preventDefault();
                  endNodePress(node);
                }}
              >
                <span className="mlLogoMarkerInner">
                  <span className="mlLogoMarkerRing" />
                  <img
                    className="mlLogoMarkerIcon"
                    src={getCisternLogoPath(node)}
                    alt=""
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget.nextElementSibling;
                      if (fallback) fallback.style.display = "grid";
                    }}
                  />
                  <span className="mlLogoMarkerFallback" style={{ display: "none" }}>{node.number}</span>
                  {mapDesign.logoLabelVisible && (
                    <span className="mlLogoMarkerLabel">{node.shortName}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}


      {mapDesign.svgConnectionOverlay && (
      <svg className="mlConnectionSvg" aria-hidden="true">
        <defs>
          <filter id="mlConnectionGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.45 0 0 0 0 1 0 0 0 0 0.9 0 0 0 0.92 0"
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {screenConnections.map((connection) => (
          <g
            key={connection.key}
            className={`mlConnectionGroup ${connection.variant} ${connection.active ? "active" : ""} ${connection.focused ? "focused" : ""}`}
          >
            <path className="mlConnectionShadow" d={connection.d} />
            {connection.variant === "branch" && <path className="mlConnectionBranch" d={connection.d} />}
            {connection.variant === "main" && (
              <>
                <path className="mlConnectionGlowPath" d={connection.d} />
                <path className="mlConnectionCorePath" d={connection.d} />
                <path className="mlConnectionPulsePath" d={connection.d} />
              </>
            )}
          </g>
        ))}
      </svg>
      )}

      {/* Map FX overlays removed: no horizontal bands, only map + PNG markers + UI. */}

      <header className="mlHeader">
        <div className="mlBrand">
          <span>CRYSTALLINE WATER MEMORY</span>
          <b>ISTANBUL / 2100</b>
        </div>

        <div className="mlModePill">
          <span>{mode === MODES.DETAIL ? "DETAIL MODE" : "MAP MODE"}</span>
          <b>
            {activatedNodes.length}/{MAP_CISTERNS.length}
          </b>
        </div>
      </header>

      <div className="mlMapControlPanel">
        <button
          type="button"
          className={zoomEnabled ? "active" : ""}
          onClick={() => setZoomEnabled((value) => !value)}
        >
          {zoomEnabled ? "EXIT MAP ZOOM" : "ENABLE MAP ZOOM"}
        </button>

        <span>{zoomEnabled ? "Scroll controls map zoom" : "Scroll controls page"}</span>
      </div>

      {mapDesign.showHeroCopy && (
      <section className="mlHeroCopy" style={{ opacity: mapDesign.heroOpacity }}>
        <span>05 / CITY REACTIVATION</span>
        <h2>
          ISTANBUL
          <br />
          CRYSTAL MAP
        </h2>
        <p>
          Activate the five cistern crystals and reveal the underground energy network beneath the city.
        </p>
      </section>
      )}

      {mapDesign.showBottomPanel && (
      <nav className="mlNodeIndex" style={{ opacity: mapDesign.bottomPanelOpacity, transform: `translateY(${mapDesign.bottomPanelY}px)` }}>
        {MAP_CISTERNS.map((node) => (
          <button
            key={node.id}
            className={`${activatedNodes.includes(node.id) ? "on" : ""} ${
              focusId === node.id ? "current" : ""
            }`}
            style={{ "--dot-color": node.color }}
            onMouseEnter={() => {
              setHovered(node.id);
              setCurrent(node);
              updateConnectionSource(node.id);
              updateNodeSource(node.id);
            }}
            onMouseLeave={() => {
              setHovered(null);
              updateConnectionSource(currentRef.current.id);
              updateNodeSource(currentRef.current.id);
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }}
            onMouseDown={() => startNodePress(node)}
            onMouseUp={() => endNodePress(node)}
            onTouchStart={() => startNodePress(node)}
            onTouchEnd={() => endNodePress(node)}
          >
            <span>{node.number}</span>
            <b>{node.shortName}</b>
          </button>
        ))}
      </nav>
      )}

      {!mapDesign.logoMarkerEnabled && hoverNode && mode === MODES.MAP && (
        <div className="mlHoverPin" style={{ "--hover-color": hoverNode.color }}>
          <div className="mlHoverRing" style={{ animation: mapDesign.hoverRingPulseEnabled ? undefined : "none" }}>
            <div>
              <span>{hoverNode.shortName}</span>
              <b>{hoverNode.role}</b>
            </div>
          </div>
        </div>
      )}

      <aside className={`mlDetailPanel ${mode === MODES.DETAIL ? "open" : ""}`}>
        <button className="mlBackButton" onClick={backToMap}>
          BACK TO MAP
        </button>

        <div className="mlDetailMeta">
          <span>NODE {current.number}</span>
          <b style={{ color: current.color }}>{current.role}</b>
        </div>

        <h3>{current.name}</h3>

        <div className="mlMediaWindow previewMode" style={{ "--accent": current.color }}>
          <img
            className="mlPreviewImage"
            src={current.preview}
            alt={`${current.name} preview`}
            draggable={false}
          />
          <div className="mlPreviewShade" />
          <button className="mlOpenPanoramaButton" onClick={() => openPanorama(current)}>
            OPEN 360
          </button>
        </div>

        <p>{current.text}</p>

        <div className="mlDetailStats">
          <div>
            <span>DISTANCE</span>
            <b>{current.distance}</b>
          </div>
          <div>
            <span>STATUS</span>
            <b>{activatedNodes.includes(current.id) ? "ACTIVE" : "STANDBY"}</b>
          </div>
        </div>
      </aside>

      <footer className="mlFooter" style={{ opacity: mapDesign.bottomPanelOpacity, transform: `translateY(${mapDesign.bottomPanelY}px)` }}>
        <div className="mlFooterZoom">
          <ul>
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index} className={index < activatedNodes.length ? "on" : ""} />
            ))}
          </ul>

          <span>{mode === MODES.DETAIL ? current.distance : "NETWORK MAP"}</span>
        </div>

        <button className="mlListButton" onClick={backToMap}>
          MAP CENTER
        </button>
      </footer>

      <div className={`mlFinalMessage ${fullNetwork ? "show" : ""}`}>
        <span>CRYSTALLINE NETWORK ONLINE</span>
        <p>The city no longer drinks water. It remembers it as energy.</p>
      </div>

      {panoramaNode && (
        <div className="mlPanoPortal">
          <div className="mlPanoWarp" />
          <div className="mlPanoFrame">
            <PanoramaViewer
              src={panoramaNode.panorama}
              initialFov={98}
              minFov={55}
              maxFov={110}
            />

            <div className="mlPanoTopbar">
              <div>
                <span>360 CISTERN MEMORY</span>
                <b>{panoramaNode.name}</b>
              </div>
              <button onClick={closePanorama}>CLOSE</button>
            </div>

            <div className="mlPanoHint">
              <span>DRAG TO LOOK AROUND</span>
              <b>SCROLL TO ZOOM</b>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
