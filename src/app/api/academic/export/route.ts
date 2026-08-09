import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { paper, format } = await req.json();

    if (!paper || !format) {
      return NextResponse.json({ success: false, error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const title = paper.title || 'Untitled';
    const authors = typeof paper.authors === 'string' ? paper.authors : (paper.authors?.join(' and ') || 'Unknown Author');
    const year = paper.year || '2026';
    const citeKey = `paper_${year}_${Math.random().toString(36.substring(2, 7))}`;

    let output = '';

    if (format === 'bibtex') {
      output = `@article{${citeKey},
  title={${title}},
  author={${authors}},
  year={${year}},
  journal={${paper.source || 'Academic Journal'}}
}`;
    } else if (format === 'ris') {
      const authorLines = authors.split(',').map((a: string) => `AU  - ${a.trim()}`).join('\n');
      output = `TY  - JOUR
TI  - ${title}
${authorLines}
PY  - ${year}
JO  - ${paper.source || 'Academic Journal'}
ER  -`;
    } else {
      return NextResponse.json({ success: false, error: 'صيغة غير مسعورة' }, { status: 400 });
    }

    return NextResponse.json({ success: true, output });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في التصدير' }, { status: 500 });
  }
}
