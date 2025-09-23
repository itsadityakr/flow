// src/hooks/useSelection.js
import { useState, useRef } from "react";
import {
    getStrokeAtPoint,
    getGroupBoundingBox,
    isPointInRect,
    isPointInPolygon,
} from "../utils/canvasUtils";

export const useSelection = (tool, currentHistory, updateHistory) => {
    const [highlightedStrokeId, setHighlightedStrokeId] = useState(null);
    const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
    const [lassoPath, setLassoPath] = useState(null);
    const isDraggingSelectionRef = useRef(false);
    const isSelectingRef = useRef(false);
    const dragStartDataRef = useRef(null);

    const handlePointerDown = (transformedCoords) => {
        if (tool !== "move" && tool !== "select") return false;

        if (tool === "move") {
            const stroke = getStrokeAtPoint(transformedCoords, currentHistory);
            if (stroke) {
                setSelectedStrokeIds([stroke.id]);
                isDraggingSelectionRef.current = true;
                const originalStrokes = new Map([
                    [stroke.id, JSON.parse(JSON.stringify(stroke.points))],
                ]);
                dragStartDataRef.current = {
                    startMouse: transformedCoords,
                    originalStrokes,
                };
            } else {
                setSelectedStrokeIds([]);
            }
        } else if (tool === "select") {
            const selectionBox = getGroupBoundingBox(
                selectedStrokeIds,
                currentHistory
            );
            if (
                selectionBox &&
                isPointInRect(transformedCoords, selectionBox)
            ) {
                isDraggingSelectionRef.current = true;
                const originalStrokes = new Map();
                selectedStrokeIds.forEach((id) => {
                    const stroke = currentHistory.find((s) => s.id === id);
                    if (stroke)
                        originalStrokes.set(
                            id,
                            JSON.parse(JSON.stringify(stroke.points))
                        );
                });
                dragStartDataRef.current = {
                    startMouse: transformedCoords,
                    originalStrokes,
                };
            } else {
                setSelectedStrokeIds([]);
                isSelectingRef.current = true;
                setLassoPath([transformedCoords]);
            }
        }
        return true;
    };

    const handlePointerMove = (transformedCoords, setTempDrawingHistory) => {
        if (isDraggingSelectionRef.current) {
            const { startMouse, originalStrokes } = dragStartDataRef.current;
            const dx = transformedCoords.x - startMouse.x;
            const dy = transformedCoords.y - startMouse.y;

            const newTempHistory = currentHistory.map((path) => {
                if (originalStrokes.has(path.id)) {
                    const originalPoints = originalStrokes.get(path.id);
                    return {
                        ...path,
                        points: originalPoints.map((p) => ({
                            x: p.x + dx,
                            y: p.y + dy,
                        })),
                    };
                }
                return path;
            });
            setTempDrawingHistory(newTempHistory);
        } else if (isSelectingRef.current) {
            setLassoPath((prev) => [...prev, transformedCoords]);
        } else if (tool === "move") {
            const stroke = getStrokeAtPoint(transformedCoords, currentHistory);
            setHighlightedStrokeId(stroke ? stroke.id : null);
        }
    };

    const handlePointerUp = (setTempDrawingHistory, tempDrawingHistory) => {
        if (isDraggingSelectionRef.current) {
            isDraggingSelectionRef.current = false;
            if (tempDrawingHistory) {
                updateHistory(tempDrawingHistory);
                setTempDrawingHistory(null);
            }
            dragStartDataRef.current = null;
        } else if (isSelectingRef.current) {
            isSelectingRef.current = false;
            if (lassoPath && lassoPath.length > 2) {
                const ids = currentHistory
                    // FIXED: Added a check for 'stroke' to prevent crashing on corrupt data.
                    .filter(
                        (stroke) =>
                            stroke &&
                            stroke.points.some((point) =>
                                isPointInPolygon(point, lassoPath)
                            )
                    )
                    .map((stroke) => stroke.id);
                setSelectedStrokeIds(ids);
            }
            setLassoPath(null);
        }
    };

    return {
        highlightedStrokeId,
        setHighlightedStrokeId,
        selectedStrokeIds,
        setSelectedStrokeIds,
        lassoPath,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
};
