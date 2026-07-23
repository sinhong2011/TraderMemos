/** Compress oversized images before upload / legacy embed. */
const MAX_BYTES = 900_000;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read image"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not process image"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/** Compress a user image to a File suitable for Storage upload (png/jpeg/webp). */
export async function imageFileToUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported");
  }

  const allowed =
    file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp";
  if (!allowed && file.type !== "image/jpg") {
    throw new Error("Only PNG, JPEG, or WebP images are supported");
  }

  if (file.size <= MAX_BYTES) return file;

  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  if (blob.size > MAX_BYTES) {
    throw new Error("Image is too large after compression — try a smaller file");
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** @deprecated Prefer imageFileToUploadFile + media upload. Kept for reading/legacy tests. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const upload = await imageFileToUploadFile(file);
  return readAsDataUrl(upload);
}
