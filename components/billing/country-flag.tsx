"use client";

/** Real flag PNGs via FlagCDN (ISO alpha-2). */
export function CountryFlag({
  code,
  title,
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) {
  const c = code.trim().toLowerCase();
  if (!c || c.length !== 2 || c === "ot") {
    return <span className={className} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      width={20}
      height={15}
      alt=""
      title={title}
      loading="lazy"
      decoding="async"
    />
  );
}
