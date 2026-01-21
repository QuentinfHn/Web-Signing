import fs from "fs/promises";
import path from "path";
import { ALLOWED_EXTENSIONS, FILE_MAGIC_NUMBERS } from "../config/upload.js";

export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/^\.+/, "")
        .trim();
}

export async function validateFileType(filePath: string, declaredMimeType: string): Promise<boolean> {
    const fileBuffer = await fs.readFile(filePath);
    const magicNumber = FILE_MAGIC_NUMBERS[declaredMimeType as keyof typeof FILE_MAGIC_NUMBERS];

    if (!magicNumber) {
        return true;
    }

    return fileBuffer.subarray(0, magicNumber.length).equals(magicNumber);
}

export async function validateFileExtension(filename: string): Promise<boolean> {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]);
}
