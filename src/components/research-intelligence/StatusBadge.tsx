'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { TONE_CLASSES, type Tone } from '@/lib/research-intelligence-ui';

export default function StatusBadge({ label, tone, hint }: { label: string; tone: Tone; hint?: string }) {
  const { text: ui } = useUiTranslation();

  return <span title={hint ? ui(hint) : undefined} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold leading-4 ${TONE_CLASSES[tone]}`}>{ui(label)}</span>;
}
