import { useState, useEffect } from "react";
import { Screen } from "../utils/trpc";
import { LocationMode } from "../types/screen";

export interface NewScreenData {
    displayId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    lat: number;
    lng: number;
    address: string;
    postcode: string;
    huisnummer: string;
}

export function useScreenEditor(defaultDisplayId: string = "") {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Screen>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newScreenData, setNewScreenData] = useState<NewScreenData>({
        displayId: defaultDisplayId,
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        name: "",
        lat: 0,
        lng: 0,
        address: "",
        postcode: "",
        huisnummer: "",
    });
    const [editPostcode, setEditPostcode] = useState("");
    const [editHuisnummer, setEditHuisnummer] = useState("");
    const [newScreenLocationMode, setNewScreenLocationMode] = useState<LocationMode>("address");
    const [editLocationMode, setEditLocationMode] = useState<LocationMode>("address");

    const startEdit = (screen: Screen) => {
        setEditingId(screen.id);
        setFormData(screen);
        setEditPostcode("");
        setEditHuisnummer("");
        setIsCreating(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({});
        setEditPostcode("");
        setEditHuisnummer("");
    };

    const startCreate = (displayId: string) => {
        setIsCreating(true);
        setNewScreenData(prev => ({ ...prev, displayId }));
        setEditingId(null);
    };

    const cancelCreate = () => {
        setIsCreating(false);
        setNewScreenData({
            displayId: "",
            x: 0,
            y: 0,
            width: 512,
            height: 512,
            name: "",
            lat: 0,
            lng: 0,
            address: "",
            postcode: "",
            huisnummer: "",
        });
    };

    const updateNewScreenData = (field: keyof NewScreenData, value: string | number) => {
        setNewScreenData(prev => ({ ...prev, [field]: value }));
    };

    const updateFormData = (field: keyof Screen, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const resetNewScreenData = (displayId: string = "") => {
        setNewScreenData({
            displayId,
            x: 0,
            y: 0,
            width: 512,
            height: 512,
            name: "",
            lat: 0,
            lng: 0,
            address: "",
            postcode: "",
            huisnummer: "",
        });
    };

    return {
        editingId,
        formData,
        isCreating,
        newScreenData,
        editPostcode,
        editHuisnummer,
        newScreenLocationMode,
        editLocationMode,
        setEditingId,
        setFormData,
        setIsCreating,
        setNewScreenData,
        setEditPostcode,
        setEditHuisnummer,
        setNewScreenLocationMode,
        setEditLocationMode,
        startEdit,
        cancelEdit,
        startCreate,
        cancelCreate,
        updateNewScreenData,
        updateFormData,
        resetNewScreenData,
    };
}
