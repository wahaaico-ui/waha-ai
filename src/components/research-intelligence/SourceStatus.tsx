import StatusBadge from './StatusBadge';
import { CANONICAL_LINK_LABEL, sourceOriginLabel } from '@/lib/research-intelligence-ui';

/** Where a saved source came from, from server-set data. No verification or confidence score. */
export default function SourceStatus({ origin, canonicalLinked }: { origin?: string; canonicalLinked?: boolean }) {
  const status = sourceOriginLabel(origin);
  return <div className="flex flex-wrap items-center gap-1.5">
    <StatusBadge label={status.label} tone={status.tone} hint={status.hint} />
    {canonicalLinked && <StatusBadge label={CANONICAL_LINK_LABEL} tone="neutral" hint="ربطته الواحة بسجل علمي واحد عبر معرّفاته (مثل DOI)، دون أن يعني ذلك مراجعة محتواه." />}
  </div>;
}
