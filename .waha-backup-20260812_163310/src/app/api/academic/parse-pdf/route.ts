import { NextResponse } from "next/server";
// استخدام استيراد النطاق لتجنب مشاكل الـ Default Export في حزم الـ Node الخارجية
import * as pdfParseModule from "pdf-parse";

// تعريف واجهة دقيقة لنتيجة الـ PDF
interface PdfParseResult {
  text: string;
  numpages?: number;
  info?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  version?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // حل توافقية الاستيراد (Interoperability) بين ESM و CJS بشكل آمن ومحكم
    const parseFunction = (
      (pdfParseModule as unknown as { default?: (buf: Buffer) => Promise<PdfParseResult> }).default || 
      (pdfParseModule as unknown as (buf: Buffer) => Promise<PdfParseResult>)
    );

    if (typeof parseFunction !== "function") {
      throw new Error("PDF parser module failed to resolve as a callable function.");
    }

    const parsedData = await parseFunction(buffer);
    
    return NextResponse.json({ text: parsedData.text });
  } catch (error: unknown) {
    console.error("PDF Parse Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to parse PDF";
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}