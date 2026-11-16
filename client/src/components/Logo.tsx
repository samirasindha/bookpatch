import { LOGO_COMPACT, LOGO_FULL } from "./logoArt";
import { APP_NAME } from "../config";

/**
 * The bookpatch logo. "full" is the illustrated version (fence of book spines, grass,
 * strawberries, watering can); "compact" is the header version that stays crisp when small.
 * The artwork is static, generated from our own design file, so injecting it is safe.
 */
export function Logo({ variant = "compact", className = "" }: { variant?: "full" | "compact"; className?: string }) {
  return (
    <span className={`logo logo-${variant} ${className}`} role="img" aria-label={APP_NAME}>
      <span dangerouslySetInnerHTML={{ __html: variant === "full" ? LOGO_FULL : LOGO_COMPACT }} />
    </span>
  );
}
