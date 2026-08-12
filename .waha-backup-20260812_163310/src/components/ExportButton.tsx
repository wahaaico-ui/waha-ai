'use client';

export default function ExportButton({ paper }: { paper: any }) {
  const exportBibTeX = () => {
    const bibtex = `@article{${paper.id || 'waha2026'},
  title={${paper.title}},
  author={${paper.authors}},
  journal={${paper.source || 'Al-Waha Academic'}},
  year={${paper.year}}
}`;
    downloadFile(bibtex, `${paper.title.slice(0, 20)}.bib`, 'text/plain');
  };

  const exportRIS = () => {
    const ris = `TY  - JOUR
TI  - ${paper.title}
AU  - ${paper.authors}
PY  - ${paper.year}
JO  - ${paper.source || 'Al-Waha Academic'}
ER  -`;
    downloadFile(ris, `${paper.title.slice(0, 20)}.ris`, 'text/plain');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportBibTeX}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-medium rounded-lg transition-colors border border-slate-700"
      >
        BibTeX 📥
      </button>
      <button
        onClick={exportRIS}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-medium rounded-lg transition-colors border border-slate-700"
      >
        RIS 📥
      </button>
    </div>
  );
}
