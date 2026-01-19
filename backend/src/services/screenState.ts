import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../prisma/client.js";

export interface ScreenStateMap {
    [screenId: string]: {
        src: string | null;
        updated: Date;
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

    const states = await prisma.screenState.findMany();
    const stateMap: ScreenStateMap = {};

    for (const state of states) {
        stateMap[state.screenId] = {
            src: state.imageSrc,
            updated: state.updatedAt,
        };
    }

    const payload = JSON.stringify({
        type: "state",
        screens: stateMap,
    });

    wssInstance.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
