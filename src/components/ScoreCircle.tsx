function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-400', ring: '#34d399' };
  if (score >= 60) return { text: 'text-amber-400', ring: '#fbbf24' };
  return { text: 'text-red-400', ring: '#f87171' };
}

export default function ScoreCircle({ score, size = 128 }: { score: number; size?: number }) {
  const { text, ring } = scoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const fontSize = size >= 96 ? 'text-4xl' : size >= 64 ? 'text-xl' : 'text-sm';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="50" cy="50" r="45" stroke="#1e293b" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r="45" stroke={ring} strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-black ${fontSize} ${text}`}>{score}%</span>
      </div>
    </div>
  );
}
