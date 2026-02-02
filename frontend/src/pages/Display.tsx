import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useWebSocket, ScreenState } from "../utils/websocket";
import { signageCache, CachedScreen } from "../lib/signageCache";
import { useAutoSync } from "../hooks/useSync";
import styles from "./Display.module.css";

const FADE_TIME = 500;

// Track slideshow state per screen
interface SlideshowState {
    currentIndex: number;
    scenario: string | null;
}

interface ImageSize {
    width: number;
    height: number;
}

export default function Display() {
    const { displayId = "display1" } = useParams<{ displayId: string }>();

    // Initialize with empty state, will load from cache
    const [screens, setScreens] = useState<CachedScreen[]>([]);
    const [screenStates, setScreenStates] = useState<ScreenState>({});
    const [previousSrcs, setPreviousSrcs] = useState<Record<string, string>>({});
    const [fadingScreens, setFadingScreens] = useState<Set<string>>(new Set());
    const [imageSizes, setImageSizes] = useState<Record<string, ImageSize>>({});

    // Auto-sync every 60 seconds
    useAutoSync(displayId, 60000);

    // Slideshow state per screen
    const [slideshowStates, setSlideshowStates] = useState<Record<string, SlideshowState>>({});
    const slideshowTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    // Load from cache and sync with server on mount
    useEffect(() => {
        let mounted = true;

        const initializeDisplay = async () => {
            try {
                await signageCache.initialize();

                // Load from IndexedDB cache first
                const [cachedScreens, cachedStates] = await Promise.all([
                    signageCache.loadScreens(displayId),
                    signageCache.loadStates()
                ]);

                void signageCache.warmContentCache(cachedStates).catch((error) => {
                    console.error('Failed to warm content cache from IndexedDB:', error);
                });

                if (mounted) {
                    if (cachedScreens.length > 0) {
                        setScreens(cachedScreens);
                    }
                    if (Object.keys(cachedStates).length > 0) {
                        setScreenStates(cachedStates);
                    }
                }
            } catch (error) {
                console.error('Failed to initialize display:', error);
            }
        };

        initializeDisplay();

        return () => {
            mounted = false;
        };
    }, [displayId]);

    const handleStateUpdate = useCallback(async (state: ScreenState) => {
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

        // Cache state to IndexedDB for offline use
        try {
            await signageCache.cacheStates(state);
        } catch (error) {
            console.error('Failed to cache states:', error);
        }
    }, [displayId, screenStates, previousSrcs]);

    useWebSocket(handleStateUpdate);

    useEffect(() => {
        let mounted = true;
        const unsubscribe = signageCache.onSyncStatusChange((status) => {
            if (!mounted || !status.lastSync) return;
            signageCache.loadScreens(displayId)
                .then((cachedScreens) => {
                    if (mounted) {
                        setScreens(cachedScreens);
                    }
                })
                .catch((error) => {
                    console.error('Failed to refresh screens from cache:', error);
                });
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [displayId]);

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

    const shouldUseFill = (screen: CachedScreen, screenId: string): boolean => {
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
