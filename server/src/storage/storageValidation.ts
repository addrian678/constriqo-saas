import { ApiError } from "../core/errors";
import { storagePolicy } from "./storagePolicy";

export function validateStorageInput(mimeType: string, sizeBytes: number): void {
  if (!storagePolicy.allowedMimeTypes.includes(mimeType as (typeof storagePolicy.allowedMimeTypes)[number])) {
    throw new ApiError("VALIDATION_ERROR", 400, `Unsupported file type: ${mimeType}`);
  }

  const maxBytes = storagePolicy.maxFileSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    throw new ApiError("VALIDATION_ERROR", 400, `File exceeds ${storagePolicy.maxFileSizeMb}MB limit.`);
  }
}
