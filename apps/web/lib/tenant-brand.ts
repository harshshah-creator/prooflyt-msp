/**
 * Helpers for applying a tenant's publicBrand to the public-facing
 * notice and rights pages. The Tenant model already carries
 * publicBrand.{logoText, primaryColor, accentColor, publicDomain};
 * this file just wraps it in safe rendering primitives.
 *
 * Why server-rendered, not client CSS-in-JS: the public pages have to
 * be cacheable as static-ish HTML and indexable by regulators / DPB
 * inspectors. Inline styles per request keep the HTML deterministic and
 * the colour palette baked into the document.
 */

import type { CSSProperties } from "react";
import type { PublicBrand } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Validation + fallbacks                                              */
/* ------------------------------------------------------------------ */

/**
 *  Match #abc / #aabbcc and reject anything else (including url(),
 *  expression(), or other CSS injections from a user-controlled brand
 *  field).
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const FALLBACK_BRAND: PublicBrand = {
  logoText: "DPDP",
  primaryColor: "#1a1a17",
  accentColor: "#8a9a42",
  publicDomain: "",
};

export function safeBrand(brand: PublicBrand | null | undefined): PublicBrand {
  if (!brand) return FALLBACK_BRAND;
  return {
    logoText: sanitiseLogoText(brand.logoText),
    primaryColor: HEX_COLOR.test(brand.primaryColor) ? brand.primaryColor : FALLBACK_BRAND.primaryColor,
    accentColor: HEX_COLOR.test(brand.accentColor) ? brand.accentColor : FALLBACK_BRAND.accentColor,
    publicDomain: typeof brand.publicDomain === "string" ? brand.publicDomain.trim().slice(0, 200) : "",
  };
}

function sanitiseLogoText(raw: string | undefined): string {
  if (!raw) return FALLBACK_BRAND.logoText;
  // 4-character monogram max; strip anything that isn't a letter/digit/space.
  return raw.replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 4) || FALLBACK_BRAND.logoText;
}

/* ------------------------------------------------------------------ */
/*  Inline-style derivation                                             */
/* ------------------------------------------------------------------ */

/**
 *  Build the CSS variable overrides applied at the .public-stage level.
 *  Globals.css respects --brand-* variables when present and falls back
 *  to its default palette otherwise.
 */
export function brandStageStyle(brand: PublicBrand): CSSProperties {
  return {
    // CSS custom properties typed as inline-style values via cast — React
    // accepts this in modern types but not older ones, so we widen.
    ["--brand-primary" as string]: brand.primaryColor,
    ["--brand-accent" as string]: brand.accentColor,
    ["--brand-primary-soft" as string]: hexWithAlpha(brand.primaryColor, 0.08),
    ["--brand-accent-soft" as string]: hexWithAlpha(brand.accentColor, 0.10),
  } as CSSProperties;
}

/**
 *  Compose `#aabbcc` + alpha into an rgba() string. Defensive: if the
 *  input fails the regex we already swapped to the fallback in safeBrand,
 *  but we still gate here to never emit `rgba(NaN, NaN, NaN, 0.1)`.
 */
function hexWithAlpha(hex: string, alpha: number): string {
  if (!HEX_COLOR.test(hex)) return `rgba(0, 0, 0, ${alpha})`;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
