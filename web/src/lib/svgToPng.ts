/**
 * Rasterize an inline SVG element to a PNG blob. The SVG must be
 * self-contained (no foreignObject, no external refs) so the canvas stays
 * untainted and works fully offline.
 */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("could not rasterize card"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png encode failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
