/**
 * Markup interne du logo MboaCoin (sans balise <svg> englobante), partagé entre
 * components/mboacoin/logo.tsx (rendu React) et scripts/generate-pwa-icons.mjs
 * (rasterisation en PNG pour les icônes PWA) pour éviter toute désynchronisation.
 */
export const LOGO_SVG_INNER = `
  <rect width="100" height="100" rx="26" fill="#0b5e4f" />
  <path d="M50 22 L74 42 H26 L50 22 Z" fill="#12a183" />
  <rect x="34" y="42" width="32" height="30" rx="3" fill="#ffffff" />
  <rect x="45" y="54" width="10" height="18" rx="2" fill="#0b5e4f" />
  <circle cx="68" cy="66" r="15" fill="#b7791f" stroke="#ffffff" stroke-width="3" />
  <path d="M61 66 L66 71 L75 61" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
`;
