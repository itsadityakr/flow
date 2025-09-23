import React, { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";

// Util and Hook Imports
import { getPointerCoords, getGroupBoundingBox } from "./utils/canvasUtils";
import { useHistory } from "./hooks/useHistory";
import { useDraw } from "./hooks/useDraw";
import { useSelection } from "./hooks/useSelection";
import { usePan } from "./hooks/usePan";
import { useEraser } from "./hooks/useEraser";

// Component Imports
import { Toolbar } from "./components/Toolbar";
import { SidePanels } from "./components/SidePanels";

const LOCAL_STORAGE_KEY = "drawing-board-data";

export default function App() {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    const [tool, setTool] = useState("pen");
    const [color, setColor] = useState("#FFFFFF");
    const [strokeWidth, setStrokeWidth] = useState(5);
    const [canvasColor, setCanvasColor] = useState(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).canvasColor : "#111827";
    });

    // UI State
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
    const isLeftPanelManuallyControlled = useRef(false);

    // Custom Hooks for Core Functionality
    const {
        currentHistory,
        tempDrawingHistory,
        setTempDrawingHistory,
        updateHistory,
        addToHistory,
        updateLastInHistory,
        undo,
        redo,
        isUndoDisabled,
        isRedoDisabled,
    } = useHistory();

    const {
        panOffset,
        handlePointerDown: handlePanDown,
        handlePointerMove: handlePanMove,
        handlePointerUp: handlePanUp,
    } = usePan();
    const {
        handlePointerDown: handleDrawDown,
        handlePointerMove: handleDrawMove,
        handlePointerUp: handleDrawUp,
    } = useDraw(tool, color, strokeWidth, addToHistory, updateLastInHistory);
    const {
        highlightedStrokeId,
        setHighlightedStrokeId,
        selectedStrokeIds,
        setSelectedStrokeIds,
        lassoPath,
        handlePointerDown: handleSelectionDown,
        handlePointerMove: handleSelectionMove,
        handlePointerUp: handleSelectionUp,
    } = useSelection(tool, currentHistory, updateHistory);
    const {
        handlePointerDown: handleEraserDown,
        handlePointerMove: handleEraserMove,
        handlePointerUp: handleEraserUp,
    } = useEraser(tool, currentHistory, updateHistory);

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

        const historyToDraw = tempDrawingHistory ?? currentHistory;

        historyToDraw.forEach((path) => {
            if (!path) return;
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
            (highlightedStrokeId && tool === "stroke-eraser") ||
            (highlightedStrokeId && tool === "move");

        if (shouldHighlight) {
            const path = historyToDraw.find(
                (p) => p && p.id === highlightedStrokeId
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
        canvasColor,
        panOffset,
        tempDrawingHistory,
        currentHistory,
        highlightedStrokeId,
        tool,
        selectedStrokeIds,
        lassoPath,
    ]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const handleResize = () => {
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
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [redrawCanvas]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    useEffect(() => {
        document.body.style.backgroundColor = canvasColor;
        const savedState = JSON.parse(
            localStorage.getItem(LOCAL_STORAGE_KEY) || "{}"
        );
        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify({ ...savedState, canvasColor })
        );
    }, [canvasColor]);

    const selectTool = (selectedTool) => {
        setTool(selectedTool);
        if (!["select", "move"].includes(selectedTool))
            setSelectedStrokeIds([]);

        // --- CHANGE 1: Panel only opens automatically for the pen ---
        if (!isLeftPanelManuallyControlled.current) {
            setIsLeftPanelOpen(selectedTool === "pen");
        }
        // Reset manual control if user selects anything other than the pen
        if (selectedTool !== "pen") {
            isLeftPanelManuallyControlled.current = false;
        }

        if (canvasRef.current) {
            if (selectedTool === "hand")
                canvasRef.current.style.cursor = "grab";
            else if (["stroke-eraser", "select"].includes(selectedTool))
                canvasRef.current.style.cursor = "default";
            else if (selectedTool === "move")
                canvasRef.current.style.cursor = "move";
            else canvasRef.current.style.cursor = "crosshair";
        }
    };

    const handleToggleLeftPanel = () => {
        isLeftPanelManuallyControlled.current = true;
        setIsLeftPanelOpen((prev) => !prev);
    };

    const handleToggleBottomPanel = () => setIsBottomPanelOpen((prev) => !prev);

    const handlePointerDown = (event) => {
        if (handlePanDown(tool, event, getPointerCoords, canvasRef)) return;
        const coords = getPointerCoords(event, canvasRef.current);
        const transformedCoords = {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
        };

        if (handleDrawDown(transformedCoords, event)) {
            if (!isLeftPanelManuallyControlled.current)
                setIsLeftPanelOpen(false);
        } else if (handleSelectionDown(transformedCoords)) {
            // Handled by selection hook
        } else if (handleEraserDown(transformedCoords, setTempDrawingHistory)) {
            // Handled by eraser hook
        }
    };

    const handlePointerMove = (event) => {
        handlePanMove(event, getPointerCoords, canvasRef);
        const coords = getPointerCoords(event, canvasRef.current);
        const transformedCoords = {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
        };
        handleDrawMove(transformedCoords);
        handleSelectionMove(transformedCoords, setTempDrawingHistory);
        handleEraserMove(
            transformedCoords,
            tempDrawingHistory,
            setTempDrawingHistory,
            setHighlightedStrokeId
        );
    };

    const handlePointerUp = () => {
        const wasDrawing = handleDrawUp();
        if (wasDrawing && !isLeftPanelManuallyControlled.current) {
            setIsLeftPanelOpen(true);
        }
        handleSelectionUp(setTempDrawingHistory, tempDrawingHistory);
        handleEraserUp(tempDrawingHistory, setTempDrawingHistory);
        handlePanUp(selectTool, tool);
    };

    const handleContextMenu = (event) => event.preventDefault();

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
            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={handleContextMenu}
            />

            {/* --- CHANGE 2: Left toggle is hidden when an eraser is active --- */}
            {!["brush-eraser", "stroke-eraser"].includes(tool) && (
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
            )}

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

            <SidePanels
                isLeftPanelOpen={isLeftPanelOpen}
                commonColors={commonColors}
                color={color}
                setColor={setColor}
                canvasBgColors={canvasBgColors}
                canvasColor={canvasColor}
                setCanvasColor={setCanvasColor}
                tool={tool}
            />
            <div className={`bottom-panel ${isBottomPanelOpen ? "open" : ""}`}>
                <Toolbar
                    tool={tool}
                    selectTool={selectTool}
                    strokeWidth={strokeWidth}
                    setStrokeWidth={setStrokeWidth}
                    undo={undo}
                    redo={redo}
                    isUndoDisabled={isUndoDisabled}
                    isRedoDisabled={isRedoDisabled}
                />
            </div>
        </div>
    );
}
