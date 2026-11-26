import { prisma } from "@/db/prisma";

export const runtime = "nodejs";

/** Serves a stored PDF for preview. Content is served as a download-safe PDF, never as HTML. */
export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { bytes: true, fileName: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=300",
    },
  });
}
