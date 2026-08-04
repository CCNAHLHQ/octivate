import Link from "next/link";
import { OctivateLogo } from "@/components/brand/octivate-logo";

export { OctivateLogo, type OctivateLogoVariant } from "@/components/brand/octivate-logo";
export { OctivateLogoMark } from "@/components/brand/octivate-logo-mark";

/** Icon-only mark — backward-compatible alias. */
export function BrandMark({
  className = "",
  size = 30,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <OctivateLogo variant="mark" height={size} className={className} decorative />
  );
}

/** @deprecated Use OctivateLogo variant="mark" */
export function OctopusLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const height =
    typeof style?.height === "number"
      ? style.height
      : typeof style?.width === "number"
        ? style.width
        : 32;
  return (
    <OctivateLogo variant="mark" height={height} className={className} decorative />
  );
}

export function BrandWordmark({
  href = "/",
  sub = "by CENSII",
  className = "",
  height = 36,
}: {
  href?: string;
  sub?: string;
  className?: string;
  height?: number;
}) {
  return (
    <Link className={`octivate-brand-link ${className}`} href={href} aria-label="Octivate home">
      <OctivateLogo variant="lockup" height={height} sub={sub} />
    </Link>
  );
}
