interface LogoProps {
  variant?: 'full' | 'monogram';
  className?: string;
  /** Use the white wordmark for dark backgrounds. Ignored for the monogram, which is always white-on-primary. */
  inverted?: boolean;
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
        <rect width="64" height="64" rx="14" fill="#3093CE" />
        <text
          x="32"
          y="45"
          fontFamily="Inter, Arial, sans-serif"
          fontWeight="800"
          fontSize="34"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          W
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 400 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="WAHA AI"
    >
      <text
        x="0"
        y="75"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="800"
        fontSize="70"
        letterSpacing="-1"
        fill={inverted ? '#FFFFFF' : '#232B31'}
      >
        WAHA
      </text>
      <text x="215" y="75" fontFamily="Inter, Arial, sans-serif" fontWeight="500" fontSize="42" fill="#3093CE">
        AI
      </text>
    </svg>
  );
}
