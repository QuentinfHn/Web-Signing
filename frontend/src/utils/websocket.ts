import { useEffect, useRef, useCallback, useState } from "react";

export interface ScreenState {
    [screenId: string]: {
        src: string | null;
        updated: Date | string;
    };
}

export interface WebSocketMessage {
    type: "state";
    screens: ScreenState;
}

export function useWebSocket(onStateUpdate: (state: ScreenState) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
        };

        ws.onmessage = async (event) => {
            try {
                let data = event.data;
                if (data instanceof Blob) {
                    data = await data.text();
                }
                const message: WebSocketMessage = JSON.parse(data);
                if (message.type === "state") {
                    onStateUpdate(message.screens);
                }
            } catch (error) {
                console.error("WebSocket message error:", error);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setConnected(false);
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        return () => {
            ws.close();
        };
    }, [onStateUpdate]);

    const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, ...data }));
        }
    }, []);

    const setImage = useCallback((screen: string, src: string) => {
        sendMessage("setImage", { screen, src });
    }, [sendMessage]);

    return { connected, setImage };
}
