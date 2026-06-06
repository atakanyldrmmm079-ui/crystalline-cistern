import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
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
    steps = 84,
    bendFactor = 0.14,
    wobbleFactor = 0.016,
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

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
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

function buildConnectionsGeoJSON(activeNodeIds = [], focusId = "basilica") {
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

    const mainCoords = createOrganicCurve(fromNode.lngLat, toNode.lngLat, {
      sign: index % 2 === 0 ? 1 : -1,
      bendFactor: index % 2 === 0 ? 0.13 : 0.17,
      wobbleFactor: 0.014,
      steps: 88,
    });

    const branchA = offsetCurve(mainCoords, 0.00013);
    const branchB = offsetCurve(mainCoords, -0.00016);
    const key = `${fromId}-${toId}`;

    features.push({
      type: "Feature",
      properties: { key, active, focused: focused ? 1 : 0, variant: "main", order: index },
      geometry: { type: "LineString", coordinates: mainCoords },
    });

    features.push({
      type: "Feature",
      properties: { key: `${key}-branch-a`, active, focused: focused ? 1 : 0, variant: "branch", order: index },
      geometry: { type: "LineString", coordinates: branchA },
    });

    features.push({
      type: "Feature",
      properties: { key: `${key}-branch-b`, active, focused: focused ? 1 : 0, variant: "branch", order: index },
      geometry: { type: "LineString", coordinates: branchB },
    });
  });

  return { type: "FeatureCollection", features };
}


function makeScreenPath(points) {
  if (!points || points.length < 2) return "";
  return points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

function projectConnectionsForOverlay(map, activeNodeIds = [], focusId = "basilica") {
  if (!map) return [];

  const geojson = buildConnectionsGeoJSON(activeNodeIds, focusId);

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

function restyleMap(map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    try {
      const id = layer.id.toLowerCase();

      if (layer.type === "symbol") {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }

      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", "#071416");
      }

      if (layer.type === "fill") {
        if (id.includes("water") || id.includes("ocean") || id.includes("river") || id.includes("lake")) {
          map.setPaintProperty(layer.id, "fill-color", "#0b3440");
          map.setPaintProperty(layer.id, "fill-opacity", 1);
        } else if (id.includes("land") || id.includes("earth") || id.includes("park")) {
          map.setPaintProperty(layer.id, "fill-color", "#12292b");
          map.setPaintProperty(layer.id, "fill-opacity", 0.96);
        } else {
          map.setPaintProperty(layer.id, "fill-color", "#183435");
          map.setPaintProperty(layer.id, "fill-opacity", 0.84);
        }
      }

      if (layer.type === "line") {
        if (id.includes("road") || id.includes("street") || id.includes("path")) {
          map.setPaintProperty(layer.id, "line-color", "#4d8582");
          map.setPaintProperty(layer.id, "line-opacity", 0.28);
          map.setPaintProperty(layer.id, "line-width", 0.72);
        } else if (id.includes("water") || id.includes("river") || id.includes("boundary")) {
          map.setPaintProperty(layer.id, "line-color", "#23757d");
          map.setPaintProperty(layer.id, "line-opacity", 0.38);
        } else {
          map.setPaintProperty(layer.id, "line-color", "#426a68");
          map.setPaintProperty(layer.id, "line-opacity", 0.24);
        }
      }

      if (layer.type === "circle") {
        map.setPaintProperty(layer.id, "circle-opacity", 0);
      }
    } catch {
      // Some style layers may not support all properties.
    }
  });
}

function addMapTilerTerrain(map) {
  const key = import.meta.env.VITE_MAPTILER_KEY;
  if (!key) return;

  if (!map.getSource("maptiler-terrain")) {
    map.addSource("maptiler-terrain", {
      type: "raster-dem",
      tiles: [
        `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`,
      ],
      tileSize: 512,
      encoding: "mapbox",
      maxzoom: 14,
    });
  }

  map.setTerrain({
    source: "maptiler-terrain",
    exaggeration: 1.12,
  });
}

function addMapTilerBuildings(map) {
  const sourceName = getBuildingSourceName(map);
  if (!sourceName) return;
  if (map.getLayer("crystal-buildings-3d")) return;

  try {
    map.addLayer({
      id: "crystal-buildings-3d",
      source: sourceName,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": [
          "case",
          ["boolean", ["feature-state", "network"], false],
          BUILDING_NETWORK_COLOR,
          BUILDING_BASE_COLOR,
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
        "fill-extrusion-opacity": 0.56,
      },
    });
  } catch (error) {
    console.warn("3D building layer eklenemedi:", error);
  }
}

function ensureConnectionLayers(map, activeNodeIds = [], focusId = "basilica") {
  const geojson = buildConnectionsGeoJSON(activeNodeIds, focusId);

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
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 9, 12, 12, 14, 18, 16, 22],
        "line-opacity": ["case", ["==", ["get", "active"], 1], 0.95, 0.44],
        "line-blur": 3.2,
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
        "line-color": "#67f1cb",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.0, 12, 1.5, 14, 2.2, 16, 2.8],
        "line-opacity": ["case", ["==", ["get", "active"], 1], 0.42, 0.1],
        "line-blur": 0.55,
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
        "line-color": "#71ffe3",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.2, 12, 6.2, 14, 9, 16, 11],
        "line-opacity": ["case", ["==", ["get", "active"], 1], 0.68, 0.2],
        "line-blur": 2.1,
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
        "line-color": "#f3fff9",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.1, 12, 2.9, 14, 3.7, 16, 4.4],
        "line-opacity": ["case", ["==", ["get", "active"], 1], 1, 0.3],
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 12, 1.2, 14, 1.7, 16, 2.0],
        "line-opacity": 0.85,
        "line-dasharray": [0.35, 1.25],
      },
    });
  }

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


function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function ensureHoverBuildingLayers(map) {
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
        "fill-extrusion-color": BUILDING_HOVER_COLOR,
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          18,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 0.28,
      },
    });
  }

  if (!map.getLayer(HOVER_BUILDING_CORE_LAYER_ID)) {
    map.addLayer({
      id: HOVER_BUILDING_CORE_LAYER_ID,
      type: "fill-extrusion",
      source: HOVER_BUILDING_SOURCE_ID,
      paint: {
        "fill-extrusion-color": BUILDING_HOVER_COLOR,
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          18,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 0.82,
      },
    });
  }

  try {
    if (map.getLayer(HOVER_BUILDING_GLOW_LAYER_ID)) map.moveLayer(HOVER_BUILDING_GLOW_LAYER_ID);
    if (map.getLayer(HOVER_BUILDING_CORE_LAYER_ID)) map.moveLayer(HOVER_BUILDING_CORE_LAYER_ID);
  } catch {
    // Ignore move errors.
  }
}

export default function MapLibreCrystalMap({
  visible = false,
  selected = "basilica",
  setSelected,
  activatedNodes = [],
  setActivatedNodes,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const stageRef = useRef(null);
  const hoveredBuildingIdsRef = useRef([]);
  const networkBuildingIdsRef = useRef([]);
  const buildingRafRef = useRef(null);
  const currentRef = useRef(getNode(selected));
  const activatedNodesRef = useRef(activatedNodes);
  const fullNetworkRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const [mode, setMode] = useState(MODES.MAP);
  const [current, setCurrent] = useState(getNode(selected));
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const [panoramaNode, setPanoramaNode] = useState(null);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [screenConnections, setScreenConnections] = useState([]);

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

    map.getSource(CONNECTION_SOURCE_ID).setData(buildConnectionsGeoJSON(nextActiveIds, nextFocusId));
    updateScreenConnectionOverlay(nextFocusId, nextActiveIds);
  }

  function updateScreenConnectionOverlay(nextFocusId = focusId, nextActiveIds = activatedNodesRef.current) {
    const map = mapRef.current;
    if (!map) return;

    setScreenConnections(projectConnectionsForOverlay(map, nextActiveIds, nextFocusId));
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
    if (
      !map ||
      !map.getLayer("crystal-buildings-3d") ||
      !map.getSource(HOVER_BUILDING_SOURCE_ID) ||
      fullNetworkRef.current
    ) {
      return;
    }

    const features = map.queryRenderedFeatures(
      [
        [point.x - HOVER_PIXEL_RADIUS, point.y - HOVER_PIXEL_RADIUS],
        [point.x + HOVER_PIXEL_RADIUS, point.y + HOVER_PIXEL_RADIUS],
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

      if (hoverFeatures.length >= HOVER_MAX_BUILDINGS) break;
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

    const features = map.queryRenderedFeatures({ layers: ["crystal-buildings-3d"] });
    const ids = [
      ...new Set(features.map((feature) => feature.id).filter((id) => id !== undefined && id !== null)),
    ].slice(0, 900);

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
      mapRef.current?.flyTo({
        center: node.lngLat,
        zoom: DETAIL_VIEW.zoom,
        pitch: DETAIL_VIEW.pitch,
        bearing: DETAIL_VIEW.bearing,
        speed: 0.82,
        curve: 1.25,
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

    mapRef.current?.flyTo({
      center: OVERVIEW_VIEW.center,
      zoom: OVERVIEW_VIEW.zoom,
      pitch: OVERVIEW_VIEW.pitch,
      bearing: OVERVIEW_VIEW.bearing,
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
      center: OVERVIEW_VIEW.center,
      zoom: OVERVIEW_VIEW.zoom,
      pitch: OVERVIEW_VIEW.pitch,
      bearing: OVERVIEW_VIEW.bearing,
      maxBounds: ISTANBUL_BOUNDS,
      minZoom: 12.1,
      maxZoom: 14.8,
      renderWorldCopies: false,
      refreshExpiredTiles: false,
      attributionControl: false,
      dragRotate: true,
      antialias: true,
    });

    mapRef.current = map;

    // Default: page scroll remains active. Use the control panel to enable map wheel zoom.
    map.scrollZoom.disable();
    map.scrollZoom.setWheelZoomRate(1 / 450);

    map.on("load", () => {
      map.resize();
      restyleMap(map);
      addMapTilerTerrain(map);
      addMapTilerBuildings(map);
      ensureHoverBuildingLayers(map);

      ensureConnectionLayers(map, activatedNodesRef.current, currentRef.current.id);
      updateScreenConnectionOverlay(currentRef.current.id, activatedNodesRef.current);

      const syncOverlayConnections = () => {
        updateScreenConnectionOverlay(currentRef.current.id, activatedNodesRef.current);
      };

      map.on("move", syncOverlayConnections);
      map.on("zoom", syncOverlayConnections);
      map.on("rotate", syncOverlayConnections);
      map.on("pitch", syncOverlayConnections);
      map.on("resize", syncOverlayConnections);

      map.addSource("crystal-nodes", {
        type: "geojson",
        data: makeNodeGeoJson(activatedNodesRef.current, currentRef.current.id),
      });

      map.addLayer({
        id: "crystal-node-halo",
        type: "circle",
        source: "crystal-nodes",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "focused"], false], 52, ["boolean", ["get", "active"], false], 40, 30],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["boolean", ["get", "focused"], false], 0.58, ["boolean", ["get", "active"], false], 0.4, 0.26],
          "circle-blur": 0.82,
        },
      });

      map.addLayer({
        id: "crystal-node-core",
        type: "circle",
        source: "crystal-nodes",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "focused"], false], 9, 6],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["boolean", ["get", "focused"], false], 1, 0.82],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["get", "focused"], false], 2.2, 1.2],
          "circle-stroke-opacity": 0.86,
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
          "text-opacity": 0.95,
        },
      });

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
      if (fullNetworkRef.current) return;
      const point = { x: event.point.x, y: event.point.y };

      if (buildingRafRef.current) cancelAnimationFrame(buildingRafRef.current);

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
    if (!map || !visible) return;

    setTimeout(() => {
      map.resize();
      map.flyTo({
        center: OVERVIEW_VIEW.center,
        zoom: OVERVIEW_VIEW.zoom,
        pitch: OVERVIEW_VIEW.pitch,
        bearing: OVERVIEW_VIEW.bearing,
        speed: 0.75,
        curve: 1.25,
        essential: true,
      });
    }, 120);
  }, [visible]);

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
      } ${fullNetwork ? "network-complete" : ""}`}
      onMouseMove={handleMouseMove}
    >
      <div ref={mapContainer} className="mlMapCanvas" />

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

      <div className="mlCityGlow" />
      <div className="mlMapLight" />
      <div className="mlTerrainMask" />
      <div className="mlWaterVeil" />
      <div className="mlCrystalField" />
      <div className="mlScanGrid" />
      <div className="mlHeavyVignette" />

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

      <section className="mlHeroCopy">
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

      <nav className="mlNodeIndex">
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

      {hoverNode && mode === MODES.MAP && (
        <div className="mlHoverPin" style={{ "--hover-color": hoverNode.color }}>
          <div className="mlHoverRing">
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

      <footer className="mlFooter">
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
