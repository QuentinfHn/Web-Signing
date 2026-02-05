export type ContentVersion = Date | string | number | null | undefined;

const CONTENT_PATH_PREFIX = "/content/";
const FALLBACK_BASE = "http://localhost";

function toVersion(updated: ContentVersion): number | null {
    if (updated instanceof Date) {
        const ts = updated.getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    if (typeof updated === "number") {
        return Number.isFinite(updated) ? updated : null;
    }

    if (typeof updated === "string") {
        const numeric = Number(updated);
        if (updated.trim() !== "" && Number.isFinite(numeric)) {
            return numeric;
        }
        const parsed = Date.parse(updated);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}

function isContentPath(src: string): boolean {
    if (src.startsWith(CONTENT_PATH_PREFIX)) return true;

    try {
        const url = new URL(src, FALLBACK_BASE);
        return url.pathname.startsWith(CONTENT_PATH_PREFIX);
    } catch {
        return false;
    }
}

function hasScheme(src: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(src);
}

export function withContentVersion(src: string, updated: ContentVersion): string {
    if (!src) return src;
    const version = toVersion(updated);
    if (version === null) return src;
    if (!isContentPath(src)) return src;

    try {
        const url = new URL(src, FALLBACK_BASE);
        url.searchParams.set("v", String(version));

        if (hasScheme(src)) {
            return url.toString();
        }

        if (src.startsWith("//")) {
            return `//${url.host}${url.pathname}${url.search}${url.hash}`;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        const joiner = src.includes("?") ? "&" : "?";
        return `${src}${joiner}v=${encodeURIComponent(String(version))}`;
    }
}

export function buildContentUrl(
    src: string | null,
    updated: ContentVersion,
    baseUrl?: string,
): string | null {
    if (!src) return null;
    const versioned = withContentVersion(src, updated);
    if (baseUrl && versioned.startsWith(CONTENT_PATH_PREFIX)) {
        return baseUrl.replace(/\/$/, "") + versioned;
    }
    return versioned;
}
