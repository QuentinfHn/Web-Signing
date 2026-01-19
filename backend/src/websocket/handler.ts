import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../prisma/client.js";

export interface ScreenStateMap {
    [screenId: string]: {
        src: string | null;
        updated: Date;
    };
}

const PING_INTERVAL = 30000; // 30 seconds
const PONG_TIMEOUT = 35000; // 35 seconds

interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean;
}

export function createWebSocketHandler(wss: WebSocketServer) {
    // Ping all clients periodically to keep connections alive
    const pingInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const extWs = ws as ExtendedWebSocket;
            if (extWs.isAlive === false) {
                console.log("Terminating dead WebSocket connection");
                return extWs.terminate();
            }
            extWs.isAlive = false;
            extWs.ping();
        });
    }, PING_INTERVAL);

    wss.on("close", () => {
        clearInterval(pingInterval);
    });
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
        const extWs = ws as ExtendedWebSocket;
        extWs.isAlive = true;
        console.log("New WebSocket connection");

        // Handle pong responses from client
        extWs.on("pong", () => {
            extWs.isAlive = true;
        });
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
