/**
 * Official Product Hunt featured badge embed.
 * https://www.producthunt.com/products/upheld
 */
export function ProductHuntBadge({
  className = "",
  theme = "light",
}: {
  className?: string;
  theme?: "light" | "dark";
}) {
  const src =
    theme === "dark"
      ? "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1213932&theme=dark&t=1785770146170"
      : "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1213932&theme=light&t=1785770146170";

  return (
    <a
      href="https://www.producthunt.com/products/upheld?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-upheld"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition hover:opacity-90 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Upheld - Pre-submission readiness score for home health | Product Hunt"
        width={250}
        height={54}
        src={src}
      />
    </a>
  );
}
