import React, { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";

// Main App Component
export default function App() {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    const [tool, setTool] = useState("pen");
    const [color, setColor] = useState("#FFFFFF");
    const [canvasColor, setCanvasColor] = useState("#111827");
    const [strokeWidth, setStrokeWidth] = useState(5);

    const [drawingHistory, setDrawingHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempDrawingHistory, setTempDrawingHistory] = useState(null);

    const [highlightedStrokeId, setHighlightedStrokeId] = useState(null);
    const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
    const [lassoPath, setLassoPath] = useState(null);

    // State for panel visibility
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
    const isLeftPanelManuallyControlled = useRef(false);

    const isDrawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isStrokeErasingRef = useRef(false);
    const isDraggingSelectionRef = useRef(false);
    const isSelectingRef = useRef(false);
    const dragStartDataRef = useRef(null);
    const startPanPointRef = useRef({ x: 0, y: 0 });

    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    const getPointerCoords = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const distanceSq = (p1, p2) =>
        Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

    const getStrokeAtPoint = (point, history) => {
        for (let i = history.length - 1; i >= 0; i--) {
            const path = history[i];
            const threshold = Math.pow(path.strokeWidth / 2 + 5, 2);
            for (const p of path.points) {
                if (distanceSq(p, point) < threshold) {
                    return path;
                }
            }
        }
        return null;
    };

    const getGroupBoundingBox = (strokeIds, history) => {
        if (strokeIds.length === 0) return null;
        let globalMinX = Infinity,
            globalMinY = Infinity,
            globalMaxX = -Infinity,
            globalMaxY = -Infinity;
        strokeIds.forEach((id) => {
            const path = history.find((p) => p.id === id);
            if (path && path.points.length > 0) {
                path.points.forEach((p) => {
                    globalMinX = Math.min(globalMinX, p.x);
                    globalMaxX = Math.max(globalMaxX, p.x);
                    globalMinY = Math.min(globalMinY, p.y);
                    globalMaxY = Math.max(globalMaxY, p.y);
                });
            }
        });
        if (isFinite(globalMinX)) {
            const padding = 10;
            return {
                minX: globalMinX - padding,
                minY: globalMinY - padding,
                width: globalMaxX - globalMinX + padding * 2,
                height: globalMaxY - globalMinY + padding * 2,
            };
        }
        return null;
    };

    const isPointInRect = (point, rect) => {
        if (!rect) return false;
        return (
            point.x >= rect.minX &&
            point.x <= rect.minX + rect.width &&
            point.y >= rect.minY &&
            point.y <= rect.minY + rect.height
        );
    };

    const isPointInPolygon = (point, polygon) => {
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x,
                yi = polygon[i].y;
            const xj = polygon[j].x,
                yj = polygon[j].y;
            const intersect =
                yi > point.y !== yj > point.y &&
                point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
            if (intersect) isInside = !isInside;
        }
        return isInside;
    };

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context) return;

        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;

        context.fillStyle = canvasColor;
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        context.save();
        context.translate(panOffset.x, panOffset.y);

        const historyToDraw =
            tempDrawingHistory ?? drawingHistory.slice(0, historyIndex + 1);

        historyToDraw.forEach((path) => {
            context.beginPath();
            context.strokeStyle = path.color;
            context.lineWidth = path.strokeWidth;
            context.globalCompositeOperation =
                path.tool === "brush-eraser"
                    ? "destination-out"
                    : "source-over";
            if (path.points.length > 0) {
                context.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach((point) =>
                    context.lineTo(point.x, point.y)
                );
                context.stroke();
            }
        });

        const shouldHighlight =
            (highlightedStrokeId &&
                !isStrokeErasingRef.current &&
                tool === "stroke-eraser") ||
            (highlightedStrokeId &&
                !isDraggingSelectionRef.current &&
                tool === "move");

        if (shouldHighlight) {
            const path = historyToDraw.find(
                (p) => p.id === highlightedStrokeId
            );
            if (path) {
                context.beginPath();
                context.strokeStyle = "rgba(0, 150, 255, 0.7)";
                context.lineWidth = path.strokeWidth + 4;
                context.globalCompositeOperation = "source-over";
                context.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach((point) =>
                    context.lineTo(point.x, point.y)
                );
                context.stroke();
            }
        }

        if (selectedStrokeIds.length > 0) {
            const box = getGroupBoundingBox(selectedStrokeIds, historyToDraw);
            if (box) {
                context.strokeStyle = "rgba(0, 150, 255, 0.8)";
                context.lineWidth = 1;
                context.setLineDash([4, 4]);
                context.strokeRect(box.minX, box.minY, box.width, box.height);
                context.setLineDash([]);
            }
        }

        if (lassoPath && lassoPath.length > 0) {
            context.strokeStyle = "rgba(0, 150, 255, 0.9)";
            context.lineWidth = 1;
            context.setLineDash([6, 6]);
            context.beginPath();
            context.moveTo(lassoPath[0].x, lassoPath[0].y);
            lassoPath.forEach((point) => context.lineTo(point.x, point.y));
            context.stroke();
            context.setLineDash([]);
        }

        context.restore();
    }, [
        drawingHistory,
        historyIndex,
        panOffset,
        tempDrawingHistory,
        highlightedStrokeId,
        selectedStrokeIds,
        tool,
        lassoPath,
        canvasColor,
    ]);

    useEffect(() => {
        document.body.style.setProperty("--canvas-bg", canvasColor);
    }, [canvasColor]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const setCanvasDimensions = () => {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            const context = canvas.getContext("2d");
            context.scale(window.devicePixelRatio, window.devicePixelRatio);
            context.lineCap = "round";
            context.lineJoin = "round";
            contextRef.current = context;
            redrawCanvas();
        };
        setCanvasDimensions();
        window.addEventListener("resize", setCanvasDimensions);
        return () => window.removeEventListener("resize", setCanvasDimensions);
    }, [redrawCanvas]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    const handleToggleLeftPanel = () => {
        isLeftPanelManuallyControlled.current = true;
        setIsLeftPanelOpen((prev) => !prev);
    };

    const handleToggleBottomPanel = () => setIsBottomPanelOpen((prev) => !prev);

    const handlePointerDown = (event) => {
        if (event.button === 1 || (tool === "hand" && event.button === 0)) {
            isPanningRef.current = true;
            startPanPointRef.current = getPointerCoords(event);
            canvasRef.current.style.cursor = "grabbing";
            return;
        }
        const coords = getPointerCoords(event);
        const transformedCoords = {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
        };
        const currentHistory = drawingHistory.slice(0, historyIndex + 1);

        if (tool === "move") {
            const strokeToSelect = getStrokeAtPoint(
                transformedCoords,
                currentHistory
            );
            if (strokeToSelect) {
                setSelectedStrokeIds([strokeToSelect.id]);
                isDraggingSelectionRef.current = true;
                const originalStrokes = new Map();
                originalStrokes.set(
                    strokeToSelect.id,
                    JSON.parse(JSON.stringify(strokeToSelect.points))
                );
                dragStartDataRef.current = {
                    startMouse: transformedCoords,
                    originalStrokes,
                };
            } else {
                setSelectedStrokeIds([]);
            }
            return;
        }

        if (tool === "select") {
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
                    if (stroke) {
                        originalStrokes.set(
                            id,
                            JSON.parse(JSON.stringify(stroke.points))
                        );
                    }
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
            return;
        }

        if (tool === "stroke-eraser") {
            isStrokeErasingRef.current = true;
            setHighlightedStrokeId(null);
            const pathToDelete = getStrokeAtPoint(
                transformedCoords,
                currentHistory
            );
            setTempDrawingHistory(
                pathToDelete
                    ? currentHistory.filter((p) => p.id !== pathToDelete.id)
                    : currentHistory
            );
            return;
        }

        if (tool === "pen" || tool === "brush-eraser") {
            isDrawingRef.current = true;
            if (!isLeftPanelManuallyControlled.current) {
                setIsLeftPanelOpen(false);
            }
            const newPath = {
                id: crypto.randomUUID(),
                points: [transformedCoords],
                color: tool === "pen" ? color : "#000000",
                strokeWidth: strokeWidth,
                tool: tool,
            };
            const newHistory = [...currentHistory, newPath];
            setDrawingHistory(newHistory);
            setHistoryIndex(currentHistory.length);
        }
    };

    const handlePointerMove = (event) => {
        if (isPanningRef.current) {
            const currentPanPoint = getPointerCoords(event);
            const dx = currentPanPoint.x - startPanPointRef.current.x;
            const dy = currentPanPoint.y - startPanPointRef.current.y;
            setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
            startPanPointRef.current = currentPanPoint;
            return;
        }
        const coords = getPointerCoords(event);
        const transformedCoords = {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
        };

        if (isDraggingSelectionRef.current) {
            const { startMouse, originalStrokes } = dragStartDataRef.current;
            const dx = transformedCoords.x - startMouse.x;
            const dy = transformedCoords.y - startMouse.y;
            const currentHistory = drawingHistory.slice(0, historyIndex + 1);
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
            return;
        }

        if (isSelectingRef.current) {
            setLassoPath((prev) => [...prev, transformedCoords]);
            return;
        }

        if (isStrokeErasingRef.current && tool === "stroke-eraser") {
            const pathToDelete = getStrokeAtPoint(
                transformedCoords,
                tempDrawingHistory
            );
            if (pathToDelete) {
                setTempDrawingHistory((prev) =>
                    prev.filter((p) => p.id !== pathToDelete.id)
                );
            }
            return;
        }

        if (
            (tool === "stroke-eraser" && !isStrokeErasingRef.current) ||
            (tool === "move" && !isDraggingSelectionRef.current)
        ) {
            const currentHistory = drawingHistory.slice(0, historyIndex + 1);
            const strokeToHighlight = getStrokeAtPoint(
                transformedCoords,
                currentHistory
            );
            setHighlightedStrokeId(
                strokeToHighlight ? strokeToHighlight.id : null
            );
        }

        if (isDrawingRef.current) {
            setDrawingHistory((prevHistory) => {
                const newHistory = [...prevHistory];
                const currentPath = newHistory[newHistory.length - 1];
                if (!currentPath) return newHistory;
                currentPath.points.push(transformedCoords);
                return newHistory;
            });
        }
    };

    const handlePointerUp = () => {
        if (
            (tool === "pen" || tool === "brush-eraser") &&
            !isLeftPanelManuallyControlled.current
        ) {
            setIsLeftPanelOpen(true);
        }
        isDrawingRef.current = false;

        if (isDraggingSelectionRef.current) {
            isDraggingSelectionRef.current = false;
            if (tempDrawingHistory) {
                const newHistory = [...tempDrawingHistory];
                setDrawingHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
                setTempDrawingHistory(null);
            }
            dragStartDataRef.current = null;
        }

        if (isSelectingRef.current) {
            isSelectingRef.current = false;
            const currentHistory = drawingHistory.slice(0, historyIndex + 1);
            const ids = [];
            if (lassoPath && lassoPath.length > 2) {
                currentHistory.forEach((stroke) => {
                    if (
                        stroke.points.some((point) =>
                            isPointInPolygon(point, lassoPath)
                        )
                    ) {
                        ids.push(stroke.id);
                    }
                });
            }
            setSelectedStrokeIds(ids);
            setLassoPath(null);
        }

        if (isStrokeErasingRef.current) {
            isStrokeErasingRef.current = false;
            if (tempDrawingHistory) {
                const originalHistory = drawingHistory.slice(
                    0,
                    historyIndex + 1
                );
                if (tempDrawingHistory.length !== originalHistory.length) {
                    const newHistory = [...tempDrawingHistory];
                    setDrawingHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                }
                setTempDrawingHistory(null);
            }
        }

        if (isPanningRef.current) {
            isPanningRef.current = false;
            selectTool(tool);
        }
    };

    const handlePointerLeave = () => {
        handlePointerUp();
        setHighlightedStrokeId(null);
    };

    const handleUndo = () => {
        if (historyIndex >= 0) setHistoryIndex(historyIndex - 1);
    };

    const handleRedo = () => {
        if (historyIndex < drawingHistory.length - 1)
            setHistoryIndex(historyIndex + 1);
    };

    const selectTool = (selectedTool) => {
        setTool(selectedTool);
        setHighlightedStrokeId(null);
        if (!["select", "move"].includes(selectedTool)) {
            setSelectedStrokeIds([]);
        }

        // Auto-show/hide left panel when a drawing tool is selected
        if (!isLeftPanelManuallyControlled.current) {
            if (selectedTool === "pen" || selectedTool === "brush-eraser") {
                setIsLeftPanelOpen(true);
            } else {
                setIsLeftPanelOpen(false);
            }
        }

        // If user selects a non-drawing tool, reset the manual control flag
        if (selectedTool !== "pen" && selectedTool !== "brush-eraser") {
            isLeftPanelManuallyControlled.current = false;
        }

        if (canvasRef.current) {
            if (selectedTool === "hand")
                canvasRef.current.style.cursor = "grab";
            else if (
                selectedTool === "stroke-eraser" ||
                selectedTool === "select"
            )
                canvasRef.current.style.cursor = "default";
            else if (selectedTool === "move")
                canvasRef.current.style.cursor = "move";
            else canvasRef.current.style.cursor = "crosshair";
        }
    };

    const commonColors = [
        "#FFFFFF",
        "#EF4444",
        "#F97316",
        "#EAB308",
        "#22C55E",
        "#3B82F6",
        "#8B5CF6",
        "#EC4899",
    ];
    const canvasBgColors = [
        "#111827",
        "#374151",
        "#4B5563",
        "#fdfbfb",
        "#f3e7e9",
    ];

    return (
        <div>
            <button
                className={`panel-toggle left-toggle ${
                    isLeftPanelOpen ? "open" : ""
                }`}
                onClick={handleToggleLeftPanel}
                title="Toggle Pen Toolbar">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                </svg>
            </button>

            <button
                className={`panel-toggle bottom-toggle ${
                    isBottomPanelOpen ? "open" : ""
                }`}
                onClick={handleToggleBottomPanel}
                title="Toggle Main Toolbar">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                </svg>
            </button>

            <div
                className={`side-panel left-panel ${
                    isLeftPanelOpen ? "open" : ""
                }`}>
                {commonColors.map((c) => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`color-swatch ${
                            color === c ? "active" : ""
                        }`}
                        title={`Set pen color to ${c}`}
                    />
                ))}
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    title="Custom pen color"
                />
            </div>

            <div
                className={`side-panel right-panel ${
                    tool === "hand" ? "open" : ""
                }`}>
                {canvasBgColors.map((c) => (
                    <button
                        key={c}
                        onClick={() => setCanvasColor(c)}
                        style={{ backgroundColor: c }}
                        className={`color-swatch ${
                            canvasColor === c ? "active" : ""
                        }`}
                        title={`Set canvas color to ${c}`}
                    />
                ))}
                <input
                    type="color"
                    value={canvasColor}
                    onChange={(e) => setCanvasColor(e.target.value)}
                    title="Custom canvas color"
                />
            </div>

            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
            />
            <div className={`bottom-panel ${isBottomPanelOpen ? "open" : ""}`}>
                <div className="panel-content">
                    {/* Tool Group */}
                    <div className="control-group">
                        <button
                            onClick={() => selectTool("pen")}
                            className={tool === "pen" ? "active" : ""}
                            title="Pen">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => selectTool("move")}
                            className={tool === "move" ? "active" : ""}
                            title="Move Stroke">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
                                <path d="m9 13 3-3 3 3" />
                                <path d="M12 10v10" />
                            </svg>
                        </button>
                        <button
                            onClick={() => selectTool("select")}
                            className={tool === "select" ? "active" : ""}
                            title="Lasso Select">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M3.2 8.7C3.2 7 4.7 5.2 6.5 5.2c2.1 0 3.8 1.4 3.8 3.5 0 2.2-1.8 3.5-4 3.5H3.5v3.8h3.8c2.5 0 4.5-1.8 4.5-4.2 0-2.7-2.3-4.8-5-4.8C4.1 4 2 6.1 2 8.7c0 2.3 1.8 4.1 4.1 4.1h2" />
                                <path d="M14.5 4.2c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5z" />
                                <path d="M11.6 20c-1.8 0-3.2-1.5-3.2-3.2 0-1.8 1.5-3.2 3.2-3.2V20zM14 13.5h7.5v1.8H14zM14 17.1h5.8v1.8H14z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => selectTool("hand")}
                            className={tool === "hand" ? "active" : ""}
                            title="Pan Canvas">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                <path d="M10 9V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
                                <path d="M6 14v-1a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                <path d="M18 11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v-4" />
                                <path d="M14 10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v-2" />
                                <path d="M10 9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v-4" />
                                <path d="M6 13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v-1" />
                            </svg>
                        </button>
                    </div>
                    <div className="separator"></div>
                    {/* Stroke Width Slider */}
                    <div className="slider-controls">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="6" />
                            <circle cx="12" cy="12" r="2" />
                        </svg>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={strokeWidth}
                            onChange={(e) =>
                                setStrokeWidth(parseInt(e.target.value, 10))
                            }
                            disabled={!["pen", "brush-eraser"].includes(tool)}
                        />
                        <span className="slider-value">{strokeWidth}</span>
                    </div>
                    <div className="separator"></div>
                    {/* Eraser Group */}
                    <div className="control-group">
                        <button
                            onClick={() => selectTool("brush-eraser")}
                            className={tool === "brush-eraser" ? "active" : ""}
                            title="Brush Eraser">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" />
                                <path d="M22 21H7" />
                                <path d="m5 12 5 5" />
                            </svg>
                        </button>
                        <button
                            onClick={() => selectTool("stroke-eraser")}
                            className={tool === "stroke-eraser" ? "active" : ""}
                            title="Stroke Eraser">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M14.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5L14.5 3Z" />
                                <polyline points="14 3 14 8 19 8" />
                                <path d="m9.5 13.5 5 5" />
                                <path d="m14.5 13.5-5 5" />
                            </svg>
                        </button>
                    </div>
                    <div className="separator"></div>
                    {/* History Group */}
                    <div className="control-group">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex < 0}
                            title="Undo">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M3 7v6h6" />
                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                            </svg>
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= drawingHistory.length - 1}
                            title="Redo">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M21 7v6h-6" />
                                <path d="M3 17a9 9 0 0 0 9 9 9 9 0 0 0 6-2.3L21 13" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
