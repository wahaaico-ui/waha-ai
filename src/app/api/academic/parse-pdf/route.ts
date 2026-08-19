import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export async function POST(request: Request) {
  let parser: PDFParse | undefined;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    return NextResponse.json({ text: result.text });
  } catch (error: unknown) {
    console.error("PDF Parse Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to parse PDF";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    await parser?.destroy();
  }
}