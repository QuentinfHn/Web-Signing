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

    // Initialize with empty state; hydrate after a fresh sync
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
    const slideshowConfigRef = useRef<Record<string, { images: string[]; intervalMs: number }>>({});

    // Initialize cache storage on mount (do not hydrate from cache)
    useEffect(() => {
        const initializeDisplay = async () => {
            try {
                await signageCache.initialize();
            } catch (error) {
                console.error('Failed to initialize display cache:', error);
            }
        };

        void initializeDisplay();
    }, [displayId]);

    const handleStateUpdate = useCallback(async (state: ScreenState) => {
        setScreenStates(prev => {
            // Skip update if nothing actually changed
            const hasChanges = Object.entries(state).some(([screenId, screenState]) => {
                const current = prev[screenId];
                if (!current) return true;
                return current.src !== screenState.src
                    || current.scenario !== screenState.scenario
                    || JSON.stringify(current.slideshow) !== JSON.stringify(screenState.slideshow);
            });
            if (!hasChanges) return prev;

            const newFading = new Set<string>();
            const newPrevious: Record<string, string> = {};

            Object.entries(state).forEach(([screenId, screenState]) => {
                const currentSrc = prev[screenId]?.src;
                const newSrc = screenState.src;

                if (currentSrc && newSrc && currentSrc !== newSrc) {
                    newFading.add(screenId);
                    newPrevious[screenId] = currentSrc;
                }

                // Reset slideshow index when scenario changes
                const currentScenario = prev[screenId]?.scenario;
                if (currentScenario !== screenState.scenario) {
                    setSlideshowStates(s => ({
                        ...s,
                        [screenId]: { currentIndex: 0, scenario: screenState.scenario }
                    }));
                }
            });

            if (newFading.size > 0) {
                setPreviousSrcs(p => ({ ...p, ...newPrevious }));
                setFadingScreens(newFading);

                setTimeout(() => {
                    setFadingScreens(prev => {
                        const next = new Set(prev);
                        newFading.forEach(id => next.delete(id));
                        return next;
                    });
                    setPreviousSrcs(prev => {
                        const next = { ...prev };
                        Object.keys(newPrevious).forEach(id => delete next[id]);
                        return next;
                    });
                }, FADE_TIME);
            }

            return { ...prev, ...state };
        });

        // Cache state to IndexedDB for offline use
        try {
            await signageCache.cacheStates(state);
        } catch (error) {
            console.error('Failed to cache states:', error);
        }
    }, []);

    useWebSocket(handleStateUpdate);

    useEffect(() => {
        let mounted = true;
        const unsubscribe = signageCache.onSyncStatusChange((status) => {
            if (!mounted || !status.lastSync) return;

            const shouldLoadScreens = status.lastSuccess?.screens === true;
            const shouldLoadStates = status.lastSuccess?.states === true;

            if (shouldLoadScreens) {
                signageCache.loadScreens(displayId).then((cachedScreens) => {
                    if (!mounted) return;
                    setScreens(cachedScreens);
                }).catch((error) => {
                    console.error('Failed to refresh screens from cache:', error);
                });
            }

            if (shouldLoadStates) {
                signageCache.loadStates().then((cachedStates) => {
                    if (!mounted) return;
                    if (Object.keys(cachedStates).length > 0) {
                        setScreenStates(prev => ({ ...prev, ...cachedStates }));
                    }
                }).catch((error) => {
                    console.error('Failed to refresh states from cache:', error);
                });
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [displayId]);

    // Clean up all slideshow timers on unmount only
    useEffect(() => {
        return () => {
            Object.values(slideshowTimersRef.current).forEach(clearInterval);
            slideshowTimersRef.current = {};
        };
    }, []);

    // Slideshow timer management — only reset timers when config actually changes
    useEffect(() => {
        const prevConfig = slideshowConfigRef.current;
        const nextConfig: Record<string, { images: string[]; intervalMs: number }> = {};

        // Build next config from current screenStates
        Object.entries(screenStates).forEach(([screenId, state]) => {
            if (state.slideshow && state.slideshow.images.length > 1 && state.slideshow.intervalMs) {
                nextConfig[screenId] = {
                    images: state.slideshow.images,
                    intervalMs: state.slideshow.intervalMs,
                };
            }
        });

        // Determine which screens need timer changes
        const allScreenIds = new Set([...Object.keys(prevConfig), ...Object.keys(nextConfig)]);

        allScreenIds.forEach(screenId => {
            const prev = prevConfig[screenId];
            const next = nextConfig[screenId];

            const configChanged =
                !prev !== !next ||
                (prev && next && (
                    prev.intervalMs !== next.intervalMs ||
                    prev.images.length !== next.images.length ||
                    prev.images.some((img, i) => img !== next.images[i])
                ));

            if (!configChanged) return;

            // Clear existing timer for this screen
            if (slideshowTimersRef.current[screenId]) {
                clearInterval(slideshowTimersRef.current[screenId]);
                delete slideshowTimersRef.current[screenId];
            }

            // Set up new timer if config exists
            if (next) {
                const { images, intervalMs } = next;

                slideshowTimersRef.current[screenId] = setInterval(() => {
                    setSlideshowStates(prev => {
                        const current = prev[screenId] || { currentIndex: 0, scenario: null };
                        const nextIndex = (current.currentIndex + 1) % images.length;

                        // Trigger fade transition
                        const currentImage = images[current.currentIndex];
                        const nextImage = images[nextIndex];

                        if (currentImage !== nextImage) {
                            setFadingScreens(f => new Set(f).add(screenId));
                            setPreviousSrcs(p => ({ ...p, [screenId]: currentImage }));

                            setTimeout(() => {
                                setFadingScreens(f => {
                                    const s = new Set(f);
                                    s.delete(screenId);
                                    return s;
                                });
                                setPreviousSrcs(p => {
                                    const { [screenId]: _, ...rest } = p;
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

        slideshowConfigRef.current = nextConfig;
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
