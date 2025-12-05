import sharp from "sharp";

export async function applyWatermark(buffer: Buffer, text: string): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width || 1000;
  const height = metadata.height || 800;

  // Transparent overlay with text
  const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .label {
          fill: rgba(255, 255, 255, 0.65);
          font-size: ${Math.floor(width * 0.04)}px;
          font-family: Arial, sans-serif;
          font-weight: bold;
        }
      </style>
      <text x="${Math.floor(width * 0.70)}" y="${Math.floor(height * 0.95)}" class="label">
        ${text}
      </text>
    </svg>
  `;

  return await image
    .composite([{ input: Buffer.from(svg), gravity: "southeast" }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

