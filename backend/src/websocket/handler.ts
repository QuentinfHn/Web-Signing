import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../prisma/client.js";
import { setWebSocketServer, broadcastState, type ScreenStateMap } from "../services/screenState.js";

const PING_INTERVAL = 30000; // 30 seconds

interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean;
}

export function createWebSocketHandler(wss: WebSocketServer) {
    setWebSocketServer(wss);

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

    wss.on("connection", async (ws) => {
        const extWs = ws as ExtendedWebSocket;
        extWs.isAlive = true;
        console.log("New WebSocket connection");

        extWs.on("pong", () => {
            extWs.isAlive = true;
        });

        const states = await prisma.screenState.findMany();
        const stateMap: ScreenStateMap = {};

        for (const state of states) {
            let slideshow: { images: string[]; intervalMs: number } | undefined;

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
                        update: { imageSrc: data.src, scenario: data.scenario || null },
                        create: { screenId: data.screen, imageSrc: data.src, scenario: data.scenario || null },
                    });

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
}
