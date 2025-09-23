// src/hooks/useHistory.js
import { useState, useEffect } from "react";

const LOCAL_STORAGE_KEY = "drawing-board-data";

// UPDATED: This function now cleans corrupted data on load.
const loadState = (key, defaultValue) => {
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!saved) return defaultValue;
        const parsed = JSON.parse(saved);
        const value = parsed[key];

        // If loading history, filter out any null/undefined entries
        if (key === "drawingHistory" && Array.isArray(value)) {
            return value.filter(Boolean);
        }

        return value ?? defaultValue;
    } catch (error) {
        console.warn(`Error loading state for key "${key}":`, error);
        return defaultValue;
    }
};

export const useHistory = () => {
    const [drawingHistory, setDrawingHistory] = useState(() =>
        loadState("drawingHistory", [])
    );
    const [historyIndex, setHistoryIndex] = useState(() =>
        loadState("historyIndex", -1)
    );
    const [tempDrawingHistory, setTempDrawingHistory] = useState(null);

    useEffect(() => {
        try {
            const savedState = JSON.parse(
                localStorage.getItem(LOCAL_STORAGE_KEY) || "{}"
            );
            const stateToSave = {
                ...savedState,
                drawingHistory,
                historyIndex,
            };
            localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(stateToSave)
            );
        } catch (error) {
            console.warn("Error saving state to localStorage:", error);
        }
    }, [drawingHistory, historyIndex]);

    const currentHistory = drawingHistory.slice(0, historyIndex + 1);

    const updateHistory = (newHistory) => {
        setDrawingHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const addToHistory = (item) => {
        const newHistory = [...currentHistory, item];
        setDrawingHistory(newHistory);
        setHistoryIndex(currentHistory.length);
    };

    const updateLastInHistory = (updaterFn) => {
        setDrawingHistory((prev) => {
            const newHistory = [...prev];
            const lastItemIndex = newHistory.length - 1;
            if (lastItemIndex >= 0) {
                const updatedItem = updaterFn(newHistory[lastItemIndex]);
                newHistory[lastItemIndex] = updatedItem;
            }
            return newHistory;
        });
    };

    const undo = () => {
        if (historyIndex >= 0) setHistoryIndex(historyIndex - 1);
    };

    const redo = () => {
        if (historyIndex < drawingHistory.length - 1)
            setHistoryIndex(historyIndex + 1);
    };

    return {
        drawingHistory,
        currentHistory,
        tempDrawingHistory,
        setTempDrawingHistory,
        updateHistory,
        addToHistory,
        updateLastInHistory,
        undo,
        redo,
        isUndoDisabled: historyIndex < 0,
        isRedoDisabled: historyIndex >= drawingHistory.length - 1,
    };
};
