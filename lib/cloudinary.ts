import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// During build, env vars might not be available - use placeholder config
if (!cloudName || !apiKey || !apiSecret) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Use placeholder during build
    cloudinary.config({
      cloud_name: 'placeholder',
      api_key: 'placeholder',
      api_secret: 'placeholder',
    });
  } else {
    console.warn("Cloudinary environment variables are missing.");
    cloudinary.config({
      cloud_name: cloudName || 'placeholder',
      api_key: apiKey || 'placeholder',
      api_secret: apiSecret || 'placeholder',
    });
  }
} else {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export function uploadBuffer(buffer: Buffer, filename?: string, folder?: string) {
  return new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      filename_override: filename,
      overwrite: false,
      resource_type: "image",
    }, (error, result) => {
      if (error || !result) {
        reject(error);
      } else {
        resolve(result);
      }
    });

    stream.end(buffer);
  });
}
