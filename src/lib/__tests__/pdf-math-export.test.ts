import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { completePdfUnicodeMappings, pdfFontRuns, type PdfFontName } from '../pdf-font-runs';
import { pdfVisualRuns } from '../pdf-text-runs';
import { buildProjectPdf } from '../project-document-export';

const names: Partial<Record<PdfFontName,string>> = {NotoSans:'NotoSans-Regular.ttf',Amiri:'Amiri-Regular.ttf',NotoNaskhArabicExtended:'NotoNaskhArabic.ttf',NotoSansMath:'NotoSansMath-Regular.ttf'};
const fontkit=jest.requireActual<{create(bytes:Buffer):{hasGlyphForCodePoint(code:number):boolean}}>('fontkit');
test.each(['n₀ ≈ Z²p(1−p)/e²; n ≥ 385; α = 0.05; ρ = 0.', 'المجتمع N = 1000، وهامش ±5%؛ حجم العينة n ≥ 278.'])('each rendered math character has a glyph in its selected font: %s',text=>{
  for(const run of pdfVisualRuns(text)) {
    const base=/\p{Script=Arabic}/u.test(run)?'Amiri':'NotoSans';
    for(const part of pdfFontRuns(run,base)) {
      const font=fontkit.create(readFileSync(`public/fonts/${names[part.font]}`));
      for(const c of part.text) if(!/\s/u.test(c)) expect({c,font:part.font,supported:font.hasGlyphForCodePoint(c.codePointAt(0)!)}).toMatchObject({supported:true});
    }
  }
});
test('only empty shaping mappings are filled; valid source mappings remain unchanged',()=>{
  const font={unicode:[[0],[0x3b1],[],[0x644,0x627]]};
  completePdfUnicodeMappings({_fontFamilies:{arabic:font,alias:font,latin:{}}});
  expect(font.unicode).toEqual([[0],[0x3b1],[0x200b],[0x644,0x627]]);
});
test('font changes within a shaped Arabic span preserve visual placement',()=>{
  expect(pdfFontRuns('ن≥م','Amiri')).toEqual([{text:'م',font:'Amiri'},{text:'≥',font:'NotoSansMath'},{text:'ن',font:'Amiri'}]);
});
test('extended Arabic keeps the original font across the whole joining span', () => {
  expect(pdfFontRuns('\u0870كلمة', 'Amiri')).toEqual([{ text: '\u0870كلمة', font: 'NotoNaskhArabicExtended' }]);
});
test('actual generated PDF embeds math glyphs and contains no empty Unicode mappings',async()=>{
  const pdf=await buildProjectPdf({language:'ar',title:'Mathematical planning fixture',notice:'Synthetic values only.',sections:[{title:'الحساب والمنهجية',paragraphs:['العينة n ≥ 278 من المجتمع N = 1000، بنسبة استجابة 70%.','n₀ ≈ Z²p(1−p)/e²; α = 0.05; ρ = 0.','ينبغي حفظ ملاحظات المشرف ومراجع الدراسة كاملة.']}]});
  expect(pdf.toString('latin1')).toContain('NotoSansMath');
  const streams:string[]=[];
  for(const match of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {streams.push(inflateSync(Buffer.from(match[1],'latin1')).toString('utf8'));} catch { /* Not a Flate stream. */ }
  }
  const maps=streams.filter(value=>value.includes('begincmap'));
  expect(maps.length).toBeGreaterThan(0);
  for(const map of maps) expect(map).not.toMatch(/<>/);
  expect(maps.join('\n').toLowerCase()).toContain('<2248>');
  expect(maps.join('\n').toLowerCase()).toContain('<2212>');
  expect(streams.some(value=>value.includes('/ActualText'))).toBe(true);
});
