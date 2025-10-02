// DrawingCanvas.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

// Icons
import penIcon from "./assets/icons/pen.svg";
import strokeMoveIcon from "./assets/icons/stroke-move.svg";
import lassoIcon from "./assets/icons/lasso.svg";
import panIcon from "./assets/icons/pan.svg";
import brushSizeIcon from "./assets/icons/brush-size.svg";
import brushEraserIcon from "./assets/icons/brush-eraser.svg";
import strokeEraserIcon from "./assets/icons/stroke-eraser.svg";
import undoIcon from "./assets/icons/undo.svg";
import redoIcon from "./assets/icons/redo.svg";

// --- Global Configuration ---
const SAVE_TO_LOCALSTORAGE = false;
const LOCAL_STORAGE_KEY = "drawing-board-data";

// Annotate खोलते वक्त डिफ़ॉल्ट transparency:
// true => डिफ़ॉल्ट transparent overlay
// false => डिफ़ॉल्ट solid background
export const SET_BG_DEFAULT_TRANSPARENT = true;

// Solid BG भरते समय कितना opaque?
// 1 = पूरा solid, 0 = पूरा transparent (alpha)
export const SET_TRANSPARENCY = 0.3;

export default function DrawingCanvas({
    transparent = SET_BG_DEFAULT_TRANSPARENT,
}) {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    // Tools & history
    const [tool, setTool] = useState("pen");
    const [drawingHistory, setDrawingHistory] = useState(() => {
        if (!SAVE_TO_LOCALSTORAGE) return [];
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            return saved ? JSON.parse(saved).drawingHistory : [];
        } catch {
            return [];
        }
    });
    const [historyIndex, setHistoryIndex] = useState(() => {
        if (!SAVE_TO_LOCALSTORAGE) return -1;
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            return saved ? JSON.parse(saved).historyIndex : -1;
        } catch {
            return -1;
        }
    });

    // Pan
    const [panOffset, setPanOffset] = useState(() => {
        if (!SAVE_TO_LOCALSTORAGE) return { x: 0, y: 0 };
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            return saved ? JSON.parse(saved).panOffset : { x: 0, y: 0 };
        } catch {
            return { x: 0, y: 0 };
        }
    });

    // Unified Background State
    const [bgMode, setBgMode] = useState(transparent ? "off" : "opaque-solid");
    const [bgColor, setBgColor] = useState(() => {
        if (!SAVE_TO_LOCALSTORAGE) return "#111827";
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            // Using 'canvasColor' for backward compatibility with old saves
            return saved
                ? JSON.parse(saved).bgColor || JSON.parse(saved).canvasColor
                : "#111827";
        } catch {
            return "#111827";
        }
    });

    // Pen
    const [color, setColor] = useState("#FFFFFF");
    const [strokeWidth, setStrokeWidth] = useState(5);

    // Temp states
    const [tempDrawingHistory, setTempDrawingHistory] = useState(null);
    const [highlightedStrokeId, setHighlightedStrokeId] = useState(null);
    const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
    const [lassoPath, setLassoPath] = useState(null);

    // Panels
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
    const isLeftPanelManuallyControlled = useRef(false);

    // Flags
    const isDrawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isStrokeErasingRef = useRef(false);
    const isDraggingSelectionRef = useRef(false);
    const isSelectingRef = useRef(false);
    const dragStartDataRef = useRef(null);
    const startPanPointRef = useRef({ x: 0, y: 0 });

    // Save (optional)
    useEffect(() => {
        if (SAVE_TO_LOCALSTORAGE) {
            const stateToSave = {
                drawingHistory,
                historyIndex,
                bgColor, // Updated
                bgMode, // Updated
                panOffset,
            };
            localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(stateToSave)
            );
        }
    }, [drawingHistory, historyIndex, bgColor, bgMode, panOffset]);

    // Body styles: केवल normal mode में ही (transparent overlay में नहीं)
    useEffect(() => {
        if (transparent) return;
        document.body.style.backgroundColor = bgColor;
        document.body.style.color = "#ffffff";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";
        document.body.style.width = "100vw";
        document.body.style.height = "100vh";
        document.body.style.transition = "background-color 0.3s ease";
    }, [bgColor, transparent]);

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context) return;

        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = canvas.width / dpr;
        const canvasHeight = canvas.height / dpr;

        // --- New Unified Background Drawing Logic ---
        context.clearRect(0, 0, canvasWidth, canvasHeight);

        switch (bgMode) {
            case "transparent-solid":
                context.fillStyle = withAlpha(bgColor, SET_TRANSPARENCY);
                context.fillRect(0, 0, canvasWidth, canvasHeight);
                break;
            case "opaque-solid":
                context.fillStyle = bgColor;
                context.fillRect(0, 0, canvasWidth, canvasHeight);
                break;
            case "off":
                // In standalone mode, 'off' reverts to a default dark color
                // to avoid a blank white page.
                if (!transparent) {
                    context.fillStyle = "#111827";
                    context.fillRect(0, 0, canvasWidth, canvasHeight);
                }
                // In overlay mode (transparent=true), we do nothing, leaving it clear.
                break;
        }
        // --- End of Background Logic ---

        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        const offscreenContext = offscreenCanvas.getContext("2d");
        if (!offscreenContext) return;

        offscreenContext.scale(dpr, dpr);
        offscreenContext.lineCap = "round";
        offscreenContext.lineJoin = "round";

        const historyToDraw =
            tempDrawingHistory ?? drawingHistory.slice(0, historyIndex + 1);

        historyToDraw.forEach((path) => {
            offscreenContext.beginPath();
            offscreenContext.strokeStyle = path.color;
            offscreenContext.lineWidth = path.strokeWidth;
            offscreenContext.globalCompositeOperation =
                path.tool === "brush-eraser"
                    ? "destination-out"
                    : "source-over";
            if (path.points.length > 0) {
                offscreenContext.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach((point) =>
                    offscreenContext.lineTo(point.x, point.y)
                );
                offscreenContext.stroke();
            }
        });

        context.save();
        context.translate(panOffset.x, panOffset.y);
        context.drawImage(offscreenCanvas, 0, 0, canvasWidth, canvasHeight);

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
        transparent,
        bgMode,
        bgColor,
    ]);

    // Canvas init & resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const setCanvasDimensions = () => {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            const context = canvas.getContext("2d");
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.scale(window.devicePixelRatio, window.devicePixelRatio);
            context.lineCap = "round";
            context.lineJoin = "round";
            contextRef.current = context;
            redrawCanvas();
        };

        setCanvasDimensions();
        window.addEventListener("resize", setCanvasDimensions);
        return () => window.removeEventListener("resize", setCanvasDimensions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // Utils
    const getPointerCoords = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const distanceSq = (p1, p2) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

    const getStrokeAtPoint = (point, history) => {
        for (let i = history.length - 1; i >= 0; i--) {
            const path = history[i];
            const threshold = (path.strokeWidth / 2 + 5) ** 2;
            for (const p of path.points) {
                if (distanceSq(p, point) < threshold) return path;
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

    const withAlpha = (hex, alpha = 1) => {
        let c = hex.replace("#", "");
        if (c.length === 3)
            c = c
                .split("")
                .map((x) => x + x)
                .join("");
        const r = parseInt(c.slice(0, 2), 16);
        const g = parseInt(c.slice(2, 4), 16);
        const b = parseInt(c.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const applyBgPanelColor = (c) => {
        setBgColor(c);
    };

    const handleBgModeToggle = () => {
        setBgMode((currentMode) => {
            if (currentMode === "off") return "transparent-solid";
            if (currentMode === "transparent-solid") return "opaque-solid";
            return "off"; // From 'opaque-solid' back to 'off'
        });
    };

    // Panel toggles
    const handleToggleLeftPanel = () => {
        isLeftPanelManuallyControlled.current = true;
        setIsLeftPanelOpen((prev) => !prev);
    };
    const handleToggleBottomPanel = () => setIsBottomPanelOpen((prev) => !prev);

    // Pointer handlers
    const handlePointerDown = (event) => {
        if (event.button === 1 || (tool === "hand" && event.button === 0)) {
            isPanningRef.current = true;
            startPanPointRef.current = getPointerCoords(event);
            if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
            return;
        }

        const coords = getPointerCoords(event);
        const transformedCoords = {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
        };
        const currentHistory = drawingHistory.slice(0, historyIndex + 1);

        if (tool === "pen") {
            if (event.button === 0 || event.button === 2) {
                isDrawingRef.current = true;
                if (!isLeftPanelManuallyControlled.current)
                    setIsLeftPanelOpen(false);
                const actionTool = event.button === 2 ? "brush-eraser" : "pen";
                const newPath = {
                    id: uuidv4(),
                    points: [transformedCoords],
                    color,
                    strokeWidth,
                    tool: actionTool,
                };
                const newHistory = [...currentHistory, newPath];
                setDrawingHistory(newHistory);
                setHistoryIndex(currentHistory.length);
                return;
            }
        } else if (tool === "brush-eraser") {
            if (event.button === 0) {
                isDrawingRef.current = true;
                if (!isLeftPanelManuallyControlled.current)
                    setIsLeftPanelOpen(false);
                const newPath = {
                    id: uuidv4(),
                    points: [transformedCoords],
                    color,
                    strokeWidth,
                    tool: "brush-eraser",
                };
                const newHistory = [...currentHistory, newPath];
                setDrawingHistory(newHistory);
                setHistoryIndex(currentHistory.length);
                return;
            }
            if (event.button === 2) return;
        }

        if (event.button === 0) {
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
        if (!["select", "move"].includes(selectedTool))
            setSelectedStrokeIds([]);

        if (!isLeftPanelManuallyControlled.current) {
            if (selectedTool === "pen" || selectedTool === "brush-eraser")
                setIsLeftPanelOpen(true);
            else setIsLeftPanelOpen(false);
        }

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

    const handleContextMenu = (event) => {
        event.preventDefault();
    };

    // Palettes
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
        <div className="w-screen h-screen">
            {/* Canvas */}
            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={handleContextMenu}
                className="absolute inset-0 touch-none bg-transparent"
            />

            {/* Left panel toggle */}
            <button
                className="fixed z-20 left-0 top-1/2 -translate-y-1/2 w-6 h-16 rounded-r-lg border border-white/10 border-l-0 bg-slate-800 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
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
                    strokeLinejoin="round"
                    className={`${
                        isLeftPanelOpen ? "rotate-180" : ""
                    } transition-transform`}>
                    <path d="m9 18 6-6-6-6" />
                </svg>
            </button>

            {/* Bottom panel toggle */}
            <button
                className="fixed z-20 bottom-0 left-1/2 -translate-x-1/2 w-20 h-6 rounded-t-lg border border-white/10 border-b-0 bg-slate-800 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
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
                    strokeLinejoin="round"
                    className={`${
                        isBottomPanelOpen ? "rotate-180" : ""
                    } transition-transform`}>
                    <path d="m18 15-6-6-6 6" />
                </svg>
            </button>

            {/* Solid BG Toggle */}
            <div className="fixed z-50 top-4 left-14 flex items-center gap-2">
                <button
                    onClick={handleBgModeToggle}
                    className={`px-3 py-2 rounded-lg text-sm font-medium shadow w-32 text-center transition-colors ${
                        bgMode === "off"
                            ? "bg-white/90 text-slate-900"
                            : "bg-blue-600 text-white"
                    }`}
                    title="Toggle Background Mode">
                    {bgMode === "off" && "BG: Off"}
                    {bgMode === "transparent-solid" && "BG: Transparent"}
                    {bgMode === "opaque-solid" && "BG: Solid"}
                </button>
            </div>

            {/* Left (pen colors) panel */}
            <div
                className={[
                    "fixed z-10 left-6 top-1/2 -translate-y-1/2",
                    "flex flex-col items-center gap-3",
                    "bg-slate-800/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-3",
                    "transition-all duration-300",
                    isLeftPanelOpen
                        ? "opacity-100 pointer-events-auto translate-x-0"
                        : "opacity-0 pointer-events-none translate-x-[-150%]",
                ].join(" ")}>
                {commonColors.map((c) => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-full transition-transform ${
                            color === c
                                ? "ring-4 ring-white ring-offset-2 ring-offset-slate-800"
                                : ""
                        }`}
                        title={`Set pen color to ${c}`}
                    />
                ))}
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    title="Custom pen color"
                    className="w-10 h-10 p-0 rounded-full border-0 cursor-pointer appearance-none"
                />
            </div>

            {/* Right (canvas bg) panel */}
            <div
                className={[
                    "fixed z-10 right-6 top-1/2 -translate-y-1/2",
                    "flex flex-col items-center gap-3",
                    "bg-slate-800/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-3",
                    "transition-all duration-300",
                    bgMode !== "off"
                        ? "opacity-100 pointer-events-auto translate-x-0"
                        : "opacity-0 pointer-events-none translate-x-[150%]",
                ].join(" ")}>
                {canvasBgColors.map((c) => (
                    <button
                        key={c}
                        onClick={() => applyBgPanelColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-10 h-10 rounded-full ${
                            bgColor === c
                                ? "ring-4 ring-white ring-offset-2 ring-offset-slate-800"
                                : ""
                        }`}
                        title={`Set background color to ${c}`}
                    />
                ))}
                <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => applyBgPanelColor(e.target.value)}
                    title="Pick Background Color"
                    className="w-10 h-10 p-0 rounded-full border-0 cursor-pointer appearance-none"
                />
            </div>

            {/* Bottom toolbar */}
            <div
                className={[
                    "fixed bottom-4 left-1/2 -translate-x-1/2 z-10",
                    "transition-transform duration-300",
                    isBottomPanelOpen ? "translate-y-0" : "translate-y-[120%]",
                ].join(" ")}>
                <div className="flex items-center gap-4 bg-slate-800/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-3">
                    {/* Tool Group */}
                    <div className="flex items-center bg-slate-900/50 rounded-md">
                        <ToolbarButton
                            active={tool === "pen"}
                            onClick={() => selectTool("pen")}
                            title="Pen"
                            icon={penIcon}
                        />
                        <ToolbarButton
                            active={tool === "move"}
                            onClick={() => selectTool("move")}
                            title="Move Stroke"
                            icon={strokeMoveIcon}
                        />
                        <ToolbarButton
                            active={tool === "select"}
                            onClick={() => selectTool("select")}
                            title="Lasso Select"
                            icon={lassoIcon}
                        />
                        <ToolbarButton
                            active={tool === "hand"}
                            onClick={() => selectTool("hand")}
                            title="Pan Canvas"
                            icon={panIcon}
                        />
                    </div>

                    <div className="w-px h-10 bg-white/10" />

                    {/* Stroke Width Slider */}
                    <div className="flex items-center gap-3">
                        <img
                            src={brushSizeIcon}
                            alt="Stroke width"
                            width="24"
                            height="24"
                        />
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={strokeWidth}
                            onChange={(e) =>
                                setStrokeWidth(parseInt(e.target.value, 10))
                            }
                            disabled={!["pen", "brush-eraser"].includes(tool)}
                            className="w-32 disabled:opacity-50 cursor-pointer"
                        />
                        <span className="text-sm w-8 text-center bg-slate-900/50 rounded px-2 py-1">
                            {strokeWidth}
                        </span>
                    </div>

                    <div className="w-px h-10 bg-white/10" />

                    {/* Eraser Group */}
                    <div className="flex items-center bg-slate-900/50 rounded-md">
                        <ToolbarButton
                            active={tool === "brush-eraser"}
                            onClick={() => selectTool("brush-eraser")}
                            title="Brush Eraser"
                            icon={brushEraserIcon}
                        />
                        <ToolbarButton
                            active={tool === "stroke-eraser"}
                            onClick={() => selectTool("stroke-eraser")}
                            title="Stroke Eraser"
                            icon={strokeEraserIcon}
                        />
                    </div>

                    <div className="w-px h-10 bg-white/10" />

                    {/* History Group */}
                    <div className="flex items-center bg-slate-900/50 rounded-md">
                        <ToolbarButton
                            onClick={handleUndo}
                            title="Undo"
                            icon={undoIcon}
                            disabled={historyIndex < 0}
                        />
                        <ToolbarButton
                            onClick={handleRedo}
                            title="Redo"
                            icon={redoIcon}
                            disabled={historyIndex >= drawingHistory.length - 1}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Small button helper to keep classes consistent */
function ToolbarButton({ active, disabled, onClick, title, icon }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={[
                "p-3 rounded-md transition-colors",
                "text-white disabled:opacity-50 disabled:cursor-not-allowed",
                active ? "bg-blue-600 shadow" : "hover:bg-white/10",
            ].join(" ")}>
            <img src={icon} alt={title} width="24" height="24" />
        </button>
    );
}
