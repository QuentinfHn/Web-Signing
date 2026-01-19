import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { trpcClient, Screen } from "../utils/trpc";
import { useWebSocket, ScreenState } from "../utils/websocket";

const FADE_TIME = 500;

interface ImageSize {
    width: number;
    height: number;
}

export default function Display() {
    const [searchParams] = useSearchParams();
    const displayId = searchParams.get("display") || "display1";

    const [screens, setScreens] = useState<Screen[]>([]);
    const [screenStates, setScreenStates] = useState<ScreenState>({});
    const [previousSrcs, setPreviousSrcs] = useState<Record<string, string>>({});
    const [fadingScreens, setFadingScreens] = useState<Set<string>>(new Set());
    const [imageSizes, setImageSizes] = useState<Record<string, ImageSize>>({});

    // Fetch screens on mount
    useEffect(() => {

        trpcClient.screens.getByDisplay.query({ displayId }).then(setScreens).catch(console.error);
    }, [displayId]);

    const handleStateUpdate = useCallback((state: ScreenState) => {
        const newFading = new Set<string>();
        const newPrevious: Record<string, string> = { ...previousSrcs };

        Object.entries(state).forEach(([screenId, screenState]) => {
            const currentSrc = screenStates[screenId]?.src;
            const newSrc = screenState.src;

            if (currentSrc && newSrc && currentSrc !== newSrc) {
                newFading.add(screenId);
                newPrevious[screenId] = currentSrc;
            }
        });

        if (newFading.size > 0) {
            setPreviousSrcs(newPrevious);
            setFadingScreens(newFading);

            setTimeout(() => {
                setFadingScreens(new Set());
                setPreviousSrcs({});
            }, FADE_TIME);
        }

        setScreenStates(state);
    }, [screenStates, previousSrcs]);

    useWebSocket(handleStateUpdate);

    const [scale, setScale] = useState(1);

    const handleImageLoad = (screenId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSizes(prev => ({
            ...prev,
            [screenId]: { width: img.naturalWidth, height: img.naturalHeight }
        }));
    };

    const shouldUseFill = (screen: Screen, screenId: string): boolean => {
        const imageSize = imageSizes[screenId];
        if (!imageSize) return false;
        return imageSize.width !== screen.width || imageSize.height !== screen.height;
    };

    useEffect(() => {
        const updateScale = () => {
            const scaleX = window.innerWidth / 1920;
            const scaleY = window.innerHeight / 1080;
            setScale(Math.min(scaleX, scaleY));
        };
        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);

    return (
        <div className="display-page">
            <div
                className="display-stage"
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    width: 1920,
                    height: 1080,
                }}
            >
                {screens.map((screen) => {
                    const state = screenStates[screen.id];
                    const isFading = fadingScreens.has(screen.id);
                    const prevSrc = previousSrcs[screen.id];

                    const useFill = shouldUseFill(screen, screen.id);
                    const objectFitStyle = useFill ? { objectFit: 'fill' as const } : {};

                    return (
                        <div
                            key={screen.id}
                            className="display-screen"
                            style={{
                                left: screen.x,
                                top: screen.y,
                                width: screen.width,
                                height: screen.height,
                            }}
                        >
                            {isFading && prevSrc && (
                                <img src={prevSrc} alt="" style={{ position: "absolute", opacity: 0, transition: `opacity ${FADE_TIME}ms`, ...objectFitStyle }} />
                            )}
                            {state?.src && (
                                <img
                                    src={state.src}
                                    alt={screen.name || screen.id}
                                    style={{ opacity: 1, transition: `opacity ${FADE_TIME}ms`, ...objectFitStyle }}
                                    onLoad={(e) => handleImageLoad(screen.id, e)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
