import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../prisma/client.js";

export interface SlideshowConfig {
    images: string[];
    intervalMs: number;
}

export interface ScreenStateMap {
    [screenId: string]: {
        src: string | null;
        scenario: string | null;
        updated: Date;
        slideshow?: SlideshowConfig;
    };
}

let wssInstance: WebSocketServer | null = null;

export function setWebSocketServer(wss: WebSocketServer) {
    wssInstance = wss;
}

export async function broadcastState() {
    if (!wssInstance) {
        console.warn("WebSocket server not initialized, broadcast skipped");
        return;
    }

    const states = await prisma.screenState.findMany() ?? [];
    const stateMap: ScreenStateMap = {};

    for (const state of states) {
        let slideshow: SlideshowConfig | undefined;

        // If there's a scenario, check for slideshow config
        if (state.scenario) {
            const assignment = await prisma.scenarioAssignment.findUnique({
                where: {
                    screenId_scenario: {
                        screenId: state.screenId,
                        scenario: state.scenario,
                    },
                },
                include: { images: { orderBy: { order: "asc" } } },
            });

            if (assignment && assignment.intervalMs && assignment.images.length > 0) {
                slideshow = {
                    images: assignment.images.map((img: { imagePath: string }) => img.imagePath),
                    intervalMs: assignment.intervalMs,
                };
            }
        }

        stateMap[state.screenId] = {
            src: state.imageSrc,
            scenario: state.scenario,
            updated: state.updatedAt,
            slideshow,
        };
    }

    const payload = JSON.stringify({
        type: "state",
        screens: stateMap,
    });

    wssInstance.clients?.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
