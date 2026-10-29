/**
 * Map geometry for the heatmap, taken from the Figma frames (G21–G24).
 * Boundaries ship with the app; the API only says how hot each area is.
 * Coordinates are px inside each level’s “Geo” frame.
 */

export type Box = { x: number; y: number; w: number; h: number };
/** A boundary drawn from an SVG. `inset` is the stroke bleed Figma exports around the node box. */
export type Shape = Box & { id: string; name: string; src: string; inset: string; drill?: string };
export type Place = { name: string; x: number; y: number; kind: "caps" | "town" | "hood" | "water" | "sea"; dot?: boolean };
/** Where a hotspot sits and where its label goes. */
export type Pin = { id: string; x: number; y: number; size: number; label: [number, number]; drill?: string; agent?: false };
export type AgentPin = { id: string; x: number; y: number };

export type Level = {
  id: "country" | "ashanti" | "kumasi";
  left: number;
  width: number;
  /** Fixed background art (neighbours, flattened districts, lakes). `land` clips the heat field when there are no shapes. */
  base: Array<Box & { src: string; inset: string; land?: true }>;
  /** Areas coloured by the data. */
  shapes: Shape[];
  overlays: Array<Box & { src: string; inset: string }>;
  places: Place[];
  pins: Pin[];
  agents?: AgentPin[];
  layers: string[];
  legend: string[];
  hint?: Box & { text: string; drill: string };
};

const R = "/figma/map/";
const r = (id: string, name: string, x: number, y: number, w: number, h: number, inset: string, drill?: string): Shape => ({
  id,
  name,
  src: `${R}region-${id}.svg`,
  x,
  y,
  w,
  h,
  inset,
  drill,
});
const d = (id: string, name: string, x: number, y: number, w: number, h: number, inset: string): Shape => ({ id, name, src: `${R}kd-${id}.svg`, x, y, w, h, inset });

export const LEVELS: Record<Level["id"], Level> = {
  country: {
    id: "country",
    left: 15,
    width: 900,
    base: [
      { src: `${R}country-cote-divoire.svg`, x: -80, y: 89, w: 396, h: 535, inset: "0 -0.13%" },
      { src: `${R}country-mali.svg`, x: -80, y: -80, w: 250, h: 218, inset: "-0.23% -0.2%" },
      { src: `${R}country-benin.svg`, x: 591, y: -52, w: 258, h: 520, inset: "0 -0.19%" },
      { src: `${R}country-burkina-faso.svg`, x: 64, y: -80, w: 663, h: 280, inset: "-0.18% 0" },
      { src: `${R}country-togo.svg`, x: 513, y: 54, w: 163, h: 423, inset: "-0.12% -0.31%" },
    ],
    shapes: [
      r("north-east", "North East", 386, 92, 172, 62, "-1.01% -0.36%"),
      r("northern", "Northern", 411, 121, 160, 179, "-0.35% -0.39%"),
      r("upper-east", "Upper East", 393, 51, 133, 75, "-0.83% -0.47%"),
      r("upper-west", "Upper West", 281, 62, 124, 119, "-0.53% -0.5%"),
      r("oti", "Oti", 492, 254, 94, 140, "-0.45% -0.66%"),
      r("bono-east", "Bono East", 346, 253, 198, 135, "-0.46% -0.32%"),
      r("ashanti", "Ashanti", 321, 349, 185, 148, "-0.42% -0.34%", "ashanti"),
      r("bono", "Bono", 265, 252, 101, 163, "-0.38% -0.62%"),
      r("ahafo", "Ahafo", 285, 368, 86, 89, "-0.7% -0.73%"),
      r("eastern", "Eastern", 422, 385, 124, 126, "-0.5%"),
      r("volta", "Volta", 534, 376, 93, 131, "-0.48% -0.67%"),
      r("central", "Central", 340, 462, 154, 107, "-0.58% -0.41%"),
      r("western-north", "Western North", 251, 402, 99, 140, "-0.45% -0.63%"),
      r("greater-accra", "Greater Accra", 483, 478, 102, 53, "-1.18% -0.61%"),
      r("western", "Western", 265, 475, 143, 119, "-0.53% -0.44%"),
      r("savannah", "Savannah", 292, 140, 220, 178, "-0.35% -0.28%"),
    ],
    overlays: [{ src: `${R}lake-volta.svg`, x: 384, y: 226, w: 170, h: 231, inset: "0" }],
    places: [
      { name: "Burkina Faso", x: 420, y: 26, kind: "caps" },
      { name: "Côte d’Ivoire", x: 70, y: 330, kind: "caps" },
      { name: "Togo", x: 598, y: 250, kind: "caps" },
      { name: "Benin", x: 780, y: 300, kind: "caps" },
      { name: "Gulf of Guinea", x: 640, y: 598, kind: "sea" },
    ],
    pins: [
      { id: "adum-kumasi", x: 370.4, y: 407.8, size: 40, label: [125.4, 410.8], drill: "kumasi" },
      { id: "accra-central", x: 491.7, y: 504.8, size: 36, label: [523.7, 579.8] },
      { id: "tema", x: 514.2, y: 499.5, size: 28, label: [598.2, 530.5] },
      { id: "takoradi", x: 366.5, y: 562.7, size: 26, label: [256.5, 602.7] },
      { id: "kasoa", x: 479.2, y: 513.3, size: 24, label: [358.2, 522.3] },
      { id: "tamale", x: 444.1, y: 189.2, size: 22, label: [489.1, 183.2] },
      { id: "ho", x: 556, y: 425.4, size: 20, label: [600, 418.4] },
    ],
    layers: ["Regions", "Hotspots"],
    legend: ["0", "1-5", "6-15", "16-30", "31+"],
  },
  ashanti: {
    id: "ashanti",
    left: 0,
    width: 930,
    base: [
      { src: `${R}ashanti-greater-accra.svg`, x: 778, y: 545, w: 198, h: 127, inset: "-0.39% -0.25%" },
      { src: `${R}ashanti-western-north.svg`, x: -47, y: 249, w: 302, h: 423, inset: "-0.12% -0.17%" },
      { src: `${R}ashanti-central.svg`, x: 210, y: 467, w: 571, h: 205, inset: "-0.24% 0" },
      { src: `${R}ashanti-bono.svg`, x: -47, y: -32, w: 311, h: 311, inset: "-0.16%" },
      { src: `${R}ashanti-ahafo.svg`, x: -16, y: 96, w: 354, h: 350, inset: "-0.14%" },
      { src: `${R}ashanti-bono-east.svg`, x: 233, y: -32, w: 743, h: 202, inset: "-0.25% 0" },
      { src: `${R}ashanti-western.svg`, x: 75, y: 515, w: 278, h: 157, inset: "-0.32% -0.18%" },
      { src: `${R}ashanti-oti.svg`, x: 914, y: -32, w: 62, h: 94, inset: "-0.53% -0.81%" },
      { src: `${R}ashanti-eastern.svg`, x: 533, y: 157, w: 443, h: 510, inset: "0 -0.11%" },
      // TODO(api): district boundaries are flattened in the design; colour them by data once they’re split.
      { src: `${R}ashanti-districts.svg`, x: 128, y: 19, w: 745, h: 596, inset: "-0.84% -0.94% -1.51% -0.94%", land: true },
    ],
    shapes: [],
    overlays: [{ src: `${R}lake-bosomtwe.svg`, x: 464, y: 383, w: 26, h: 24, inset: "0" }],
    places: [
      { name: "Bono East", x: 690, y: 20, kind: "caps" },
      { name: "Ahafo", x: 40, y: 230, kind: "caps" },
      { name: "Bono", x: 70, y: 70, kind: "caps" },
      { name: "Western North", x: 20, y: 480, kind: "caps" },
      { name: "Central", x: 250, y: 612, kind: "caps" },
      { name: "Eastern", x: 740, y: 430, kind: "caps" },
      { name: "Konongo", x: 541, y: 355, kind: "town", dot: true },
      { name: "Mampong", x: 479, y: 205, kind: "town", dot: true },
      { name: "Bekwai", x: 419, y: 411, kind: "town", dot: true },
      { name: "Offinso", x: 393, y: 258, kind: "town", dot: true },
      { name: "Agogo", x: 586, y: 293, kind: "town", dot: true },
      { name: "Ejura", x: 494, y: 96, kind: "town", dot: true },
      { name: "Effiduase", x: 480, y: 278, kind: "town", dot: true },
      { name: "Tepa", x: 221, y: 224, kind: "town", dot: true },
      { name: "Nkawie", x: 337, y: 334, kind: "town", dot: true },
      { name: "Kumawu", x: 520, y: 257, kind: "town", dot: true },
      { name: "Juaso", x: 569, y: 361, kind: "town", dot: true },
      { name: "Mankranso", x: 324, y: 290, kind: "town", dot: true },
      { name: "New Edubiase", x: 486, y: 543, kind: "town", dot: true },
      { name: "L. Bosomtwe", x: 494, y: 390, kind: "water" },
    ],
    pins: [
      { id: "kumasi", x: 380, y: 308, size: 52, label: [193, 273], drill: "kumasi" },
      { id: "obuasi", x: 382, y: 488, size: 20, label: [264, 495] },
      { id: "ejisu", x: 447, y: 314, size: 18, label: [495, 306] },
    ],
    layers: ["Districts", "Towns"],
    legend: ["0", "1", "2-3", "4-9", "10+"],
    hint: { x: 196, y: 364, w: 0, h: 0, text: "Click Kumasi to zoom in", drill: "kumasi" },
  },
  kumasi: {
    id: "kumasi",
    left: 0,
    width: 930,
    base: [],
    shapes: [
      d("afigya-kwabre-south", "Afigya Kwabre South", 239, -32, 301, 130, "-0.77% -0.33%"),
      d("atwima-kwanwoma", "Atwima Kwanwoma", -47, 427, 608, 245, "-0.41% -0.16%"),
      d("kwabre-east", "Kwabre East", 487, -32, 490, 229, "-0.44% -0.2%"),
      d("atwima-nwabiagya-south", "Atwima Nwabiagya South", -47, -32, 340, 584, "-0.17% -0.29%"),
      d("bosomtwe", "Bosomtwe", 549, 509, 428, 163, "-0.61% -0.23%"),
      d("asokore-mampong", "Asokore Mampong", 480, 162, 338, 177, "-0.57% -0.3% -0.56% -0.3%"),
      d("kwadaso", "Kwadaso", 113, 206, 438, 449, "-0.22% -0.23%"),
      d("ejisu", "Ejisu", 723, -4, 254, 617, "-0.16% -0.39%"),
      d("atwima-nwabiagya-north", "Atwima Nwabiagya North", 52, -32, 244, 70, "-1.43% -0.41%"),
      d("kumasi-metro", "Kumasi Metro", 361, 243, 202, 197, "-0.51% -0.5%"),
      d("oforikrom", "Oforikrom", 526, 265, 400, 263, "-0.38% -0.25%"),
      d("asokwa", "Asokwa", 500, 379, 228, 276, "-0.36% -0.44%"),
      d("old-tafo", "Old Tafo", 375, 33, 323, 233, "-0.43% -0.31%"),
      d("suame", "Suame", 100, 32, 338, 257, "-0.39% -0.3%"),
    ],
    overlays: [],
    places: [
      { name: "Suame", x: 230, y: 170, kind: "caps" },
      { name: "Old Tafo", x: 560, y: 120, kind: "caps" },
      { name: "Kwadaso", x: 190, y: 330, kind: "caps" },
      { name: "Oforikrom", x: 760, y: 440, kind: "caps" },
      { name: "Asokwa", x: 612, y: 560, kind: "caps" },
      { name: "Asokore Mampong", x: 600, y: 215, kind: "caps" },
      { name: "Ejisu", x: 870, y: 250, kind: "caps" },
      { name: "Kwabre East", x: 740, y: 40, kind: "caps" },
      { name: "Atwima Kwanwoma", x: 150, y: 600, kind: "caps" },
      { name: "Bosomtwe", x: 800, y: 588, kind: "caps" },
      { name: "Atwima Nwabiagya S.", x: 20, y: 200, kind: "caps" },
      { name: "Bantama", x: 389.5, y: 294.5, kind: "hood", dot: true },
      { name: "Ahodwo", x: 426.5, y: 405.5, kind: "hood", dot: true },
      { name: "Kwadaso", x: 358.5, y: 312.5, kind: "hood", dot: true },
      { name: "Santasi", x: 342.5, y: 425.5, kind: "hood", dot: true },
      { name: "Manhyia", x: 487.5, y: 271.5, kind: "hood", dot: true },
      { name: "Aboabo", x: 534.5, y: 253.5, kind: "hood", dot: true },
      { name: "KNUST", x: 656.5, y: 399.5, kind: "hood", dot: true },
      { name: "Asokore Mampong", x: 602.5, y: 249.5, kind: "hood", dot: true },
      { name: "Atonsu", x: 522.5, y: 477.5, kind: "hood", dot: true },
      { name: "Abuakwa", x: 90.5, y: 297.5, kind: "hood", dot: true },
      { name: "Kaase", x: 411.5, y: 497.5, kind: "hood", dot: true },
    ],
    pins: [
      { id: "adum", x: 431, y: 330, size: 32, label: [237, 373] },
      { id: "kejetia", x: 442, y: 302, size: 20, label: [275, 263] },
      { id: "suame", x: 397, y: 212, size: 20, label: [250, 219] },
      { id: "tafo", x: 482, y: 166, size: 16, label: [530, 155] },
      { id: "asafo", x: 477, y: 352, size: 16, label: [543, 319] },
      { id: "asokwa", x: 525, y: 396, size: 16, label: [577, 403] },
      { id: "ayigya", x: 658, y: 361, size: 14, label: [695, 343] },
    ],
    agents: [
      { id: "AG-2231", x: 414, y: 364 },
      { id: "AG-2402", x: 464, y: 324 },
      { id: "AG-1987", x: 464, y: 288 },
      { id: "AG-2410", x: 502, y: 374 },
      { id: "AG-1774", x: 418, y: 188 },
    ],
    layers: ["Districts", "Hotspots", "Agents"],
    legend: ["0", "1", "2-3", "4-9", "10+"],
  },
};

/**
 * Fill per bucket (0 → coolest). Density is the sequential blue ramp (seq-1…5);
 * red is kept for the one hotspot to act on, drawn as a ring on its pin.
 */
export const BUCKETS = ["var(--color-seq-1)", "var(--color-seq-2)", "var(--color-seq-3)", "var(--color-seq-4)", "var(--color-seq-5)"];
