import { useEffect, useRef, useCallback, useState } from "react";

export interface ScreenState {
    [screenId: string]: {
        src: string | null;
        scenario: string | null;
        updated: Date | string;
    };
}

export interface WebSocketMessage {
    type: "state";
    screens: ScreenState;
}

const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

export function useWebSocket(onStateUpdate: (state: ScreenState) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    const savedCallback = useRef(onStateUpdate);

    useEffect(() => {
        savedCallback.current = onStateUpdate;
    }, [onStateUpdate]);

    const getWsUrl = useCallback(() => {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (apiUrl) {
            // Use configured API URL, convert http(s) to ws(s)
            return apiUrl.replace(/^http/, "ws") + "/ws";
        } else {
            // Fallback to same host (development with proxy)
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/ws`;
        }
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (!mountedRef.current) return;

        // Schedule reconnection with exponential backoff
        setReconnecting(true);
        const delay = reconnectDelayRef.current;
        console.log(`Reconnecting in ${delay / 1000}s...`);

        // Increase delay for next attempt (exponential backoff)
        reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY
        );

        reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) {
                connect();
            }
        }, delay);
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        const wsUrl = getWsUrl();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            setReconnecting(false);
            // Reset reconnect delay on successful connection
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        };

        ws.onmessage = async (event) => {
            try {
                let data = event.data;
                if (data instanceof Blob) {
                    data = await data.text();
                }
                const message: WebSocketMessage = JSON.parse(data);
                if (message.type === "state") {
                    if (savedCallback.current) {
                        savedCallback.current(message.screens);
                    }
                }
            } catch (error) {
                console.error("WebSocket message error:", error);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setConnected(false);
            scheduleReconnect();
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }, [getWsUrl, scheduleReconnect]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectTimeoutRef.current !== null) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, ...data }));
        }
    }, []);

    const setImage = useCallback((screen: string, src: string, scenario?: string) => {
        sendMessage("setImage", { screen, src, scenario });
    }, [sendMessage]);

    return { connected, reconnecting, setImage };
}
