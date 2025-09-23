import { useRef } from "react";

export const useDraw = (
    tool,
    color,
    strokeWidth,
    addToHistory,
    updateLastInHistory
) => {
    const isDrawingRef = useRef(false);

    const handlePointerDown = (transformedCoords, event) => {
        if (tool !== "pen" && tool !== "brush-eraser") return false;
        if (tool === "brush-eraser" && event.button === 2) return true; // Prevent right-click for eraser

        isDrawingRef.current = true;
        const actionTool =
            tool === "pen" && event.button === 2 ? "brush-eraser" : tool;

        const newPath = {
            id: crypto.randomUUID(),
            points: [transformedCoords],
            color,
            strokeWidth,
            tool: actionTool,
        };
        addToHistory(newPath);
        return true;
    };

    const handlePointerMove = (transformedCoords) => {
        if (!isDrawingRef.current) return;

        updateLastInHistory((prevPath) => ({
            ...prevPath,
            points: [...prevPath.points, transformedCoords],
        }));
    };

    const handlePointerUp = () => {
        const wasDrawing = isDrawingRef.current;
        isDrawingRef.current = false;
        return wasDrawing;
    };

    return {
        isDrawingRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
};
