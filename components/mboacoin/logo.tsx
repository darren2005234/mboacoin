export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="MboaCoin"
    >
      {/* Fond arrondi teal */}
      <rect width="100" height="100" rx="26" fill="#0b5e4f" />

      {/* Toit de la maison */}
      <path
        d="M50 22 L74 42 H26 L50 22 Z"
        fill="#12a183"
      />

      {/* Corps de la maison */}
      <rect x="34" y="42" width="32" height="30" rx="3" fill="#ffffff" />

      {/* Porte */}
      <rect x="45" y="54" width="10" height="18" rx="2" fill="#0b5e4f" />

      {/* Sceau de confiance (cercle doré avec coche) */}
      <circle cx="68" cy="66" r="15" fill="#b7791f" stroke="#ffffff" strokeWidth="3" />
      <path
        d="M61 66 L66 71 L75 61"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}