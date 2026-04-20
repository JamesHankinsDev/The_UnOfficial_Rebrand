type RGB = readonly [number, number, number];

// GBA Lush — 32 colors covering warm skin tones and cool jersey hues.
const GBA_LUSH: readonly RGB[] = [
  [11, 11, 42], [30, 27, 75], [49, 46, 129], [76, 29, 149],
  [109, 40, 217], [37, 99, 235], [14, 165, 233], [6, 182, 212],
  [20, 184, 166], [5, 150, 105], [22, 163, 74], [101, 163, 13],
  [202, 138, 4], [217, 119, 6], [234, 88, 12], [220, 38, 38],
  [190, 24, 93], [162, 28, 175], [124, 58, 237], [30, 64, 175],
  [3, 105, 161], [8, 145, 178], [4, 120, 87], [22, 101, 52],
  [113, 63, 18], [120, 53, 15], [127, 29, 29], [131, 24, 67],
  [249, 168, 212], [253, 230, 138], [187, 247, 208], [255, 255, 255],
];

export interface PixelateOptions {
  size?: number;
  palette?: readonly RGB[];
  contrast?: number;
}

const cache = new Map<string, Promise<string>>();

export function pixelateImageUrl(url: string, opts: PixelateOptions = {}): Promise<string> {
  const size = opts.size ?? 128;
  const contrast = opts.contrast ?? 20;
  const key = `${url}|${size}|${contrast}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const p = loadAndPixelate(url, size, contrast, opts.palette ?? GBA_LUSH);
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

async function loadAndPixelate(
  url: string,
  size: number,
  contrast: number,
  palette: readonly RGB[],
): Promise<string> {
  const img = await loadImage(url);

  // NBA headshots place the face in the upper portion — crop square from top-center.
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const cropSize = Math.min(srcW, srcH);
  const sx = (srcW - cropSize) / 2;
  const sy = 0;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unsupported");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    r = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128));
    g = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128));
    b = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128));
    const [nr, ng, nb] = nearestPaletteColor(r, g, b, palette);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

function nearestPaletteColor(r: number, g: number, b: number, palette: readonly RGB[]): RGB {
  let minDist = Infinity;
  let nearest = palette[0];
  for (const c of palette) {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < minDist) {
      minDist = d;
      nearest = c;
    }
  }
  return nearest;
}
