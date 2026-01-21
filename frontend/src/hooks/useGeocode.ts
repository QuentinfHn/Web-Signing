import { useState } from "react";

const PDOK_API_URL = import.meta.env.VITE_PDOK_API_URL || "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export interface GeocodeResult {
    lat: number;
    lng: number;
    address: string;
}

export function useGeocode() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const geocode = async (address: string): Promise<GeocodeResult | null> => {
        if (!address.trim()) {
            alert("Vul een adres in");
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${PDOK_API_URL}?q=${encodeURIComponent(address)}&fq=type:adres&rows=1`);
            const data = await response.json();

            if (data?.response?.docs?.length > 0) {
                const result = data.response.docs[0];
                const pointMatch = result.centroide_ll?.match(/POINT\(([\d.]+) ([\d.]+)\)/);

                if (pointMatch) {
                    const lngNum = parseFloat(pointMatch[1]);
                    const latNum = parseFloat(pointMatch[2]);
                    const displayName = result.weergavenaam || address;

                    return {
                        lat: latNum,
                        lng: lngNum,
                        address: displayName,
                    };
                } else {
                    throw new Error("Adres niet gevonden (geen coördinaten)");
                }
            } else {
                throw new Error("Adres niet gevonden");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Fout bij zoeken locatie";
            setError(errorMessage);
            console.error("Geocoding failed:", err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return { geocode, isLoading, error };
}
