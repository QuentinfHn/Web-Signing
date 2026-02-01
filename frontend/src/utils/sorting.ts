/**
 * Natural sort comparison function.
 * Sorts strings with numbers in natural order (e.g., "Screen 2" before "Screen 10").
 */
export function naturalCompare(a: string, b: string): number {
    const regex = /(\d+)|(\D+)/g;
    const aParts = a.match(regex) || [];
    const bParts = b.match(regex) || [];

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || "";
        const bPart = bParts[i] || "";

        const aNum = parseInt(aPart, 10);
        const bNum = parseInt(bPart, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            if (aNum !== bNum) return aNum - bNum;
        } else {
            const cmp = aPart.localeCompare(bPart);
            if (cmp !== 0) return cmp;
        }
    }
    return 0;
}

/**
 * Sort screens by name using natural sort order.
 */
export function sortScreensByName<T extends { name: string | null; id: string }>(screens: T[]): T[] {
    return [...screens].sort((a, b) => {
        const nameA = a.name || a.id;
        const nameB = b.name || b.id;
        return naturalCompare(nameA, nameB);
    });
}
