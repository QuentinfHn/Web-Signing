import { prisma } from "../prisma/client.js";

export const MIN_SCENARIO_COUNT = 4;

function extractSceneNumber(name: string): number | null {
    const match = /^Scene (\d+)$/.exec(name);
    if (!match) return null;
    return Number.parseInt(match[1], 10);
}

export async function ensureMinimumScenarios(minCount = MIN_SCENARIO_COUNT): Promise<number> {
    const existing = await prisma.scenario.findMany({
        select: { name: true, displayOrder: true },
        orderBy: { displayOrder: "asc" },
    });

    if (existing.length >= minCount) return 0;

    const existingNames = new Set(existing.map((scenario) => scenario.name));
    let nextDisplayOrder = existing.reduce((max, scenario) => Math.max(max, scenario.displayOrder), -1) + 1;
    let nextSceneNumber = existing.reduce((max, scenario) => {
        const sceneNumber = extractSceneNumber(scenario.name);
        return sceneNumber === null ? max : Math.max(max, sceneNumber);
    }, 0) + 1;

    let created = 0;
    const totalToCreate = minCount - existing.length;

    for (let i = 0; i < totalToCreate; i++) {
        let name = `Scene ${nextSceneNumber}`;
        while (existingNames.has(name)) {
            nextSceneNumber++;
            name = `Scene ${nextSceneNumber}`;
        }

        await prisma.scenario.create({
            data: {
                name,
                displayOrder: nextDisplayOrder,
            },
        });

        existingNames.add(name);
        nextDisplayOrder++;
        nextSceneNumber++;
        created++;
    }

    return created;
}
