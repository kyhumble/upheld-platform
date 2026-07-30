import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official Upheld brand marks from public/brand (Logo Kit).
 * - light: horizontal color on light backgrounds
 * - dark: horizontal color/white on navy headers
 * - mark: symbol only
 */
export function Logo({
  size = 32,
  subtitle,
  invertWordmark = false,
  variant = "auto",
  className,
  priority = false,
}: {
  size?: number;
  subtitle?: string;
  /** Prefer white/dark-bg mark (navy app chrome) */
  invertWordmark?: boolean;
  /** auto = light vs dark from invertWordmark; mark = icon only */
  variant?: "auto" | "horizontal" | "mark";
  className?: string;
  priority?: boolean;
}) {
  const darkBg = invertWordmark;
  const showMarkOnly = variant === "mark";

  // Horizontal lockup is ~3:1 aspect; mark is square
  const height = size;
  const width = showMarkOnly ? size : Math.round(size * 3.0);

  const src = showMarkOnly
    ? darkBg
      ? "/brand/svg/upheld-symbol-mono-white.svg"
      : "/brand/svg/upheld-symbol-color-light.svg"
    : darkBg
      ? "/brand/svg/upheld-horizontal-mono-white.svg"
      : "/brand/svg/upheld-horizontal-color-light.svg";

  const alt = "Upheld";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-auto max-w-full object-contain object-left"
        style={{ height, width: "auto", maxHeight: height }}
      />
      {subtitle && !showMarkOnly ? (
        <div
          className={cn(
            "hidden min-w-0 truncate border-l pl-2.5 text-[10px] leading-tight sm:block",
            darkBg ? "border-white/20 text-white/55" : "border-border text-muted",
          )}
        >
          {subtitle}
        </div>
      ) : null}
      {subtitle && showMarkOnly ? (
        <div className="min-w-0 leading-tight">
          <div
            className={cn(
              "text-[15px] font-semibold tracking-tight",
              darkBg ? "text-white" : "text-navy",
            )}
          >
            Upheld
          </div>
          <div
            className={cn(
              "truncate text-[10px]",
              darkBg ? "text-white/55" : "text-muted",
            )}
          >
            {subtitle}
          </div>
        </div>
      ) : null}
    </div>
  );
}
