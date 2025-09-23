import { useState, useRef, useEffect } from "react";

const LOCAL_STORAGE_KEY = "drawing-board-data";

export const usePan = () => {
    const [panOffset, setPanOffset] = useState(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            return saved ? JSON.parse(saved).panOffset : { x: 0, y: 0 };
        } catch {
            return { x: 0, y: 0 };
        }
    });
    const isPanningRef = useRef(false);
    const startPanPointRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const savedState = JSON.parse(
            localStorage.getItem(LOCAL_STORAGE_KEY) || "{}"
        );
        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify({ ...savedState, panOffset })
        );
    }, [panOffset]);

    const handlePointerDown = (tool, event, getPointerCoords, canvasRef) => {
        if (event.button === 1 || (tool === "hand" && event.button === 0)) {
            isPanningRef.current = true;
            startPanPointRef.current = getPointerCoords(
                event,
                canvasRef.current
            );
            canvasRef.current.style.cursor = "grabbing";
            return true;
        }
        return false;
    };

    const handlePointerMove = (event, getPointerCoords, canvasRef) => {
        if (!isPanningRef.current) return;
        const currentPanPoint = getPointerCoords(event, canvasRef.current);
        const dx = currentPanPoint.x - startPanPointRef.current.x;
        const dy = currentPanPoint.y - startPanPointRef.current.y;
        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        startPanPointRef.current = currentPanPoint;
    };

    const handlePointerUp = (selectTool, tool) => {
        const wasPanning = isPanningRef.current;
        if (wasPanning) {
            isPanningRef.current = false;
            selectTool(tool); // Reset cursor
        }
    };

    return {
        panOffset,
        isPanningRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
};
