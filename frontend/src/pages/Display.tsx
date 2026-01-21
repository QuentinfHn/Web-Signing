import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { trpcClient, Screen } from "../utils/trpc";
import { useWebSocket, ScreenState } from "../utils/websocket";
import styles from "./Display.module.css";

const FADE_TIME = 500;
const STATE_STORAGE_KEY = 'signage-display-state';
const SCREENS_STORAGE_KEY = 'signage-display-screens';

// Track slideshow state per screen
interface SlideshowState {
    currentIndex: number;
    scenario: string | null;
}

// Load cached state from localStorage
function loadCachedState(displayId: string): ScreenState | null {
    try {
        const stored = localStorage.getItem(`${STATE_STORAGE_KEY}-${displayId}`);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// Save state to localStorage
function saveCachedState(displayId: string, state: ScreenState) {
    try {
        localStorage.setItem(`${STATE_STORAGE_KEY}-${displayId}`, JSON.stringify(state));
    } catch {
        // localStorage might be full or unavailable
    }
}

// Load cached screens from localStorage
function loadCachedScreens(displayId: string): Screen[] | null {
    try {
        const stored = localStorage.getItem(`${SCREENS_STORAGE_KEY}-${displayId}`);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// Save screens to localStorage
function saveCachedScreens(displayId: string, screens: Screen[]) {
    try {
        localStorage.setItem(`${SCREENS_STORAGE_KEY}-${displayId}`, JSON.stringify(screens));
    } catch {
        // localStorage might be full or unavailable
    }
}

interface ImageSize {
    width: number;
    height: number;
}

export default function Display() {
    const { displayId = "display1" } = useParams<{ displayId: string }>();

    // Initialize with cached data if available
    const [screens, setScreens] = useState<Screen[]>(() => loadCachedScreens(displayId) || []);
    const [screenStates, setScreenStates] = useState<ScreenState>(() => loadCachedState(displayId) || {});
    const [previousSrcs, setPreviousSrcs] = useState<Record<string, string>>({});
    const [fadingScreens, setFadingScreens] = useState<Set<string>>(new Set());
    const [imageSizes, setImageSizes] = useState<Record<string, ImageSize>>({});

    // Slideshow state per screen
    const [slideshowStates, setSlideshowStates] = useState<Record<string, SlideshowState>>({});
    const slideshowTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    // Fetch screens on mount, fallback to cached
    useEffect(() => {
        trpcClient.screens.getByDisplay.query({ displayId })
            .then((data) => {
                setScreens(data);
                saveCachedScreens(displayId, data);
            })
            .catch((err) => {
                console.error('Failed to fetch screens, using cached:', err);
                // Already initialized with cached data
            });
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

            // Reset slideshow index when scenario changes
            const currentScenario = screenStates[screenId]?.scenario;
            const newScenario = screenState.scenario;
            if (currentScenario !== newScenario) {
                setSlideshowStates(prev => ({
                    ...prev,
                    [screenId]: { currentIndex: 0, scenario: newScenario }
                }));
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

        // Cache state to localStorage for offline use
        saveCachedState(displayId, state);
    }, [displayId, screenStates, previousSrcs]);

    useWebSocket(handleStateUpdate);

    // Slideshow timer management
    useEffect(() => {
        // Clear all existing timers
        Object.values(slideshowTimersRef.current).forEach(clearInterval);
        slideshowTimersRef.current = {};

        // Set up timers for screens with slideshows
        Object.entries(screenStates).forEach(([screenId, state]) => {
            if (state.slideshow && state.slideshow.images.length > 1 && state.slideshow.intervalMs) {
                const { images, intervalMs } = state.slideshow;

                slideshowTimersRef.current[screenId] = setInterval(() => {
                    setSlideshowStates(prev => {
                        const current = prev[screenId] || { currentIndex: 0, scenario: state.scenario };
                        const nextIndex = (current.currentIndex + 1) % images.length;

                        // Trigger fade transition
                        const currentImage = images[current.currentIndex];
                        const nextImage = images[nextIndex];

                        if (currentImage !== nextImage) {
                            setFadingScreens(prev => new Set(prev).add(screenId));
                            setPreviousSrcs(prev => ({ ...prev, [screenId]: currentImage }));

                            setTimeout(() => {
                                setFadingScreens(prev => {
                                    const next = new Set(prev);
                                    next.delete(screenId);
                                    return next;
                                });
                                setPreviousSrcs(prev => {
                                    const { [screenId]: _, ...rest } = prev;
                                    return rest;
                                });
                            }, FADE_TIME);
                        }

                        return {
                            ...prev,
                            [screenId]: { ...current, currentIndex: nextIndex }
                        };
                    });
                }, intervalMs);
            }
        });

        return () => {
            Object.values(slideshowTimersRef.current).forEach(clearInterval);
        };
    }, [screenStates]);

    // Get current image for a screen (accounting for slideshow)
    const getCurrentImage = (screenId: string): string | null => {
        const state = screenStates[screenId];
        if (!state) return null;

        if (state.slideshow && state.slideshow.images.length > 0) {
            const slideshowState = slideshowStates[screenId];
            const index = slideshowState?.currentIndex ?? 0;
            return state.slideshow.images[index] || state.src;
        }

        return state.src;
    };

    // Preload next slideshow images
    useEffect(() => {
        Object.entries(screenStates).forEach(([screenId, state]) => {
            if (state.slideshow && state.slideshow.images.length > 1) {
                const slideshowState = slideshowStates[screenId];
                const currentIndex = slideshowState?.currentIndex ?? 0;
                const nextIndex = (currentIndex + 1) % state.slideshow.images.length;
                const nextImage = state.slideshow.images[nextIndex];

                // Preload next image
                if (nextImage) {
                    const img = new Image();
                    img.src = nextImage;
                }
            }
        });
    }, [screenStates, slideshowStates]);

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
        <div className={styles.displayPage}>
            <div
                className={styles.displayStage}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    width: 1920,
                    height: 1080,
                }}
            >
                {screens.map((screen) => {
                    const isFading = fadingScreens.has(screen.id);
                    const prevSrc = previousSrcs[screen.id];
                    const currentImage = getCurrentImage(screen.id);

                    const useFill = shouldUseFill(screen, screen.id);
                    const objectFitStyle: React.CSSProperties = useFill ? { objectFit: 'fill' } : {};

                    return (
                        <div
                            key={screen.id}
                            className={styles.displayScreen}
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
                            {currentImage && (
                                <img
                                    src={currentImage}
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
