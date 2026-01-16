import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../prisma/client.js";

export interface ScreenStateMap {
    [screenId: string]: {
        src: string | null;
        updated: Date;
    };
}

export function createWebSocketHandler(wss: WebSocketServer) {
    // Broadcast state to all connected clients
    async function broadcastState() {
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

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }

    wss.on("connection", async (ws) => {
        console.log("New WebSocket connection");

        // Send current state on connection
        const states = await prisma.screenState.findMany();
        const stateMap: ScreenStateMap = {};

        for (const state of states) {
            stateMap[state.screenId] = {
                src: state.imageSrc,
                updated: state.updatedAt,
            };
        }

        ws.send(
            JSON.stringify({
                type: "state",
                screens: stateMap,
            })
        );

        ws.on("message", async (msg) => {
            try {
                const data = JSON.parse(msg.toString());

                if (data.type === "setImage") {
                    await prisma.screenState.upsert({
                        where: { screenId: data.screen },
                        update: { imageSrc: data.src },
                        create: { screenId: data.screen, imageSrc: data.src },
                    });

                    // Broadcast to all clients
                    await broadcastState();
                }
            } catch (error) {
                console.error("WebSocket message error:", error);
            }
        });

        ws.on("close", () => {
            console.log("WebSocket connection closed");
        });
    });

    return { broadcastState };
}
