import { sampleFlow } from './sample-size-flow';
import type { SampleLanguage, SamplePlan } from './sample-size-planning';

/** Controlled text drawn locally; no DOM cloning, remote images or external API. */
export async function sampleSizePng(plan: SamplePlan, language: SampleLanguage, fontFamily: string): Promise<Blob> {
  await document.fonts.ready;
  const data = sampleFlow(plan, language), ar = language === 'ar';
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1600, 1100);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.direction = ar ? 'rtl' : 'ltr';
  function lines(text: string, x: number, y: number, width: number, size: number, color = '#334155', bold = false) {
    ctx!.font = `${bold ? '700' : '400'} ${size}px ${fontFamily}`;
    ctx!.fillStyle = color;
    let row = '', offset = 0;
    for (const word of text.split(/\s+/)) {
      const next = row ? `${row} ${word}` : word;
      if (row && ctx!.measureText(next).width > width) { ctx!.fillText(row, x, y + offset); offset += size * 1.7; row = word; }
      else row = next;
    }
    if (row) ctx!.fillText(row, x, y + offset);
    return y + offset + size * 1.7;
  }
  lines('WAHA · ' + (ar ? 'خطة حجم العينة' : 'Sample size plan'), 800, 42, 1460, 30, '#1647c9', true);
  lines(data.title, 800, 105, 1460, 38, '#10213c', true);
  lines(data.settings, 800, 190, 1460, 27);
  const xs = ar ? [1110, 590, 70] : [70, 590, 1110];
  data.nodes.forEach((node, i) => {
    const x = xs[i];
    ctx!.fillStyle = i === 1 ? '#eef4ff' : '#f8fafc'; ctx!.strokeStyle = i === 1 ? '#1e5eff' : '#cbd5e1'; ctx!.lineWidth = 3;
    ctx!.beginPath(); ctx!.roundRect(x, 300, 420, 360, 22); ctx!.fill(); ctx!.stroke();
    lines(node.label, x+210, 330, 380, 27, '#10213c', true);
    lines(node.value, x+210, 408, 390, node.value.length > 12 ? 32 : 48, '#1647c9', true);
    lines(node.detail, x+210, 502, 370, 23);
  });
  [550, 1070].forEach(x => {
    const direction = ar ? -1 : 1;
    ctx!.strokeStyle = '#1e5eff'; ctx!.lineWidth = 5;
    ctx!.beginPath(); ctx!.moveTo(x - 22 * direction, 460); ctx!.lineTo(x + 22 * direction, 460);
    ctx!.lineTo(x + 10 * direction, 450); ctx!.moveTo(x + 22 * direction,460); ctx!.lineTo(x + 10 * direction,470); ctx!.stroke();
  });
  let end = lines(data.scope, 800, 715, 1440, 27);
  if (data.warning) end = lines(data.warning, 800, end + 18, 1440, 27, '#9f1239', true);
  lines(ar ? 'راجع الافتراضات وخطة الاختيار قبل إدراج المخطط في المنهجية.' : 'Review assumptions and the sampling plan before including this figure in your methodology.', 800, end + 24, 1440, 23);
  lines('waha.systems/tools/sample-size', 800, 1020, 1440, 24, '#1647c9');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}
