export const ALLOWED_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
] as const;

export const ALLOWED_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".webm",
] as const;

export const FILE_MAGIC_NUMBERS = {
    "image/png": Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    "image/jpeg": Buffer.from([0xFF, 0xD8, 0xFF]),
    "image/gif": Buffer.from([0x47, 0x49, 0x46]),
    "image/webp": Buffer.from([0x52, 0x49, 0x46, 0x46]),
    "video/mp4": Buffer.from([0x00, 0x00, 0x00]),
    "video/webm": Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
} as const;
