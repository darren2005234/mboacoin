import { LOGO_SVG_INNER } from "@/lib/logo-svg.mjs";

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
      dangerouslySetInnerHTML={{ __html: LOGO_SVG_INNER }}
    />
  );
}