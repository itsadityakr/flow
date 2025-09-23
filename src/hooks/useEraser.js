// src/hooks/useEraser.js

import { useRef } from "react";
import { getStrokeAtPoint } from "../utils/canvasUtils";

export const useEraser = (tool, currentHistory, updateHistory) => {
    const isErasingRef = useRef(false);

    const handlePointerDown = (transformedCoords, setTempDrawingHistory) => {
        if (tool !== "stroke-eraser") return false;

        isErasingRef.current = true;
        const strokeToDelete = getStrokeAtPoint(
            transformedCoords,
            currentHistory
        );

        setTempDrawingHistory(
            strokeToDelete
                ? currentHistory.filter((s) => s.id !== strokeToDelete.id)
                : currentHistory
        );
        return true;
    };

    const handlePointerMove = (
        transformedCoords,
        tempDrawingHistory,
        setTempDrawingHistory,
        setHighlightedStrokeId
    ) => {
        if (tool !== "stroke-eraser") return;

        if (isErasingRef.current && tempDrawingHistory) {
            const strokeToDelete = getStrokeAtPoint(
                transformedCoords,
                tempDrawingHistory
            );
            if (strokeToDelete) {
                setTempDrawingHistory((prev) =>
                    prev.filter((s) => s.id !== strokeToDelete.id)
                );
            }
        } else {
            // Highlight stroke on hover when not actively erasing
            const strokeToHighlight = getStrokeAtPoint(
                transformedCoords,
                currentHistory
            );
            setHighlightedStrokeId(
                strokeToHighlight ? strokeToHighlight.id : null
            );
        }
    };

    const handlePointerUp = (tempDrawingHistory, setTempDrawingHistory) => {
        if (!isErasingRef.current) return;
        isErasingRef.current = false;

        if (
            tempDrawingHistory &&
            tempDrawingHistory.length !== currentHistory.length
        ) {
            updateHistory(tempDrawingHistory);
        }
        setTempDrawingHistory(null);
    };

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
};
