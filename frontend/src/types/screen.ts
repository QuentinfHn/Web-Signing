export type ConflictMode = "update" | "skip" | "error";
export type LocationMode = "address" | "coordinates";

export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}
