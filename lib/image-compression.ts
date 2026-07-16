import imageCompression from "browser-image-compression";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

/** Compresse des images avant envoi (mêmes options que lease-requests/support). */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith("image/")) return file;
      try {
        return await imageCompression(file, COMPRESSION_OPTIONS);
      } catch {
        return file;
      }
    })
  );
}
