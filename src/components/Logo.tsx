interface LogoProps {
  variant?: 'full' | 'monogram';
  className?: string;
  /** Use the white wordmark for dark backgrounds. Ignored for the monogram, which is always white-on-primary. */
  inverted?: boolean;
}

function BrandGlyph() {
  return (
    <>
      <rect width="64" height="64" rx="16" fill="#1E5EFF" />
      <path d="M12 21L21 44L32 30L43 44L52 21" fill="none" stroke="#FFFFFF" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 30V16" fill="none" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M32 10.5L33.8 14.2L37.5 16L33.8 17.8L32 21.5L30.2 17.8L26.5 16L30.2 14.2L32 10.5Z" fill="#FFFFFF" />
      <path d="M19 50C26 55 38 55 45 50" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" opacity=".72" />
    </>
  );
}

export default function Logo({ variant = 'full', className, inverted = false }: LogoProps) {
  if (variant === 'monogram') {
    return (
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="WAHA AI"
      >
        <BrandGlyph />
      </svg>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className ?? ''}`} dir="ltr" role="img" aria-label="WAHA AI">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto shrink-0" aria-hidden="true">
        <BrandGlyph />
      </svg>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap leading-none">
        <span className={`text-[1.05em] font-extrabold tracking-[-0.04em] ${inverted ? 'text-white' : 'text-[#111827]'}`}>WAHA</span>
        <span className="text-[.68em] font-bold tracking-[-0.02em] text-[#1e5eff]">AI</span>
      </span>
    </span>
  );
}
