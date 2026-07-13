/**
 * Trailer theme — mirrors the landing page / app design tokens
 * (cream paper, ink, green accent, warm amber, IBM Plex + Amiri + Caveat).
 */

import { loadFont as loadSerif } from "@remotion/google-fonts/IBMPlexSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

const serif  = loadSerif();
const sans   = loadSans();
const mono   = loadMono();
const amiri  = loadAmiri();
const caveat = loadCaveat();

export const FONTS = {
  serif:  serif.fontFamily,
  sans:   sans.fontFamily,
  mono:   mono.fontFamily,
  arabic: amiri.fontFamily,
  hand:   caveat.fontFamily,
};

export const C = {
  bg:        "#FBFAF6", // cream paper
  bgElev:    "#FEFEFC",
  panel:     "#F4F3EE",
  ink:       "#221F1A",
  ink2:      "#54504A",
  ink3:      "#8A857D",
  ink4:      "#B5B0A7",
  line:      "rgba(34,31,26,0.10)",
  line2:     "rgba(34,31,26,0.18)",
  accent:    "#3E8E6E", // green
  accentInk: "#2E6B53",
  accentSoft:"rgba(62,142,110,0.12)",
  warm:      "#C98A2D", // amber
  violet:    "#6D5FB8",
  red:       "#C24438",
  blueWash:  "rgba(112,146,224,0.40)",
  dark:      "#191D26", // deep-dark section
  paper:     "#FCF9F0", // mushaf paper
};
