// File reader helper. PDFs and .docx get real text extraction (pdfjs / mammoth,
// lazy-loaded so they stay out of the main bundle); plain-text formats are read
// directly. Legacy binary .doc can't be parsed in the browser — tell the user
// instead of silently feeding the AI garbage bytes.
export async function readFileAsText(file) {
  const name = file.name.toLowerCase();
  const MAX_CHARS = 15000;

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages && text.length < MAX_CHARS; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    const cleaned = text.replace(/[ \t]+/g, " ").trim().slice(0, MAX_CHARS);
    if (!cleaned) throw new Error("No readable text found in this PDF — it may be a scanned image. Try pasting the content instead.");
    return cleaned;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    const cleaned = (value || "").trim().slice(0, MAX_CHARS);
    if (!cleaned) throw new Error("No readable text found in this Word document. Try pasting the content instead.");
    return cleaned;
  }

  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported — save it as .docx or PDF, or paste the text.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target.result).slice(0, MAX_CHARS));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
