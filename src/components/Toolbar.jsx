import React from "react";
import penIcon from "../assets/icons/pen.svg";
import strokeMoveIcon from "../assets/icons/stroke-move.svg";
import lassoIcon from "../assets/icons/lasso.svg";
import panIcon from "../assets/icons/pan.svg";
import brushSizeIcon from "../assets/icons/brush-size.svg";
import brushEraserIcon from "../assets/icons/brush-eraser.svg";
import strokeEraserIcon from "../assets/icons/stroke-eraser.svg";
import undoIcon from "../assets/icons/undo.svg";
import redoIcon from "../assets/icons/redo.svg";

export const Toolbar = ({
    tool,
    selectTool,
    strokeWidth,
    setStrokeWidth,
    undo,
    redo,
    isUndoDisabled,
    isRedoDisabled,
}) => {
    return (
        <div className="panel-content">
            <div className="control-group">
                <button
                    onClick={() => selectTool("pen")}
                    className={tool === "pen" ? "active" : ""}
                    title="Pen">
                    <img src={penIcon} alt="Pen" width="24" height="24" />
                </button>
                <button
                    onClick={() => selectTool("move")}
                    className={tool === "move" ? "active" : ""}
                    title="Move Stroke">
                    <img
                        src={strokeMoveIcon}
                        alt="Move Stroke"
                        width="24"
                        height="24"
                    />
                </button>
                <button
                    onClick={() => selectTool("select")}
                    className={tool === "select" ? "active" : ""}
                    title="Lasso Select">
                    <img
                        src={lassoIcon}
                        alt="Lasso Select"
                        width="24"
                        height="24"
                    />
                </button>
                <button
                    onClick={() => selectTool("hand")}
                    className={tool === "hand" ? "active" : ""}
                    title="Pan Canvas">
                    <img
                        src={panIcon}
                        alt="Pan Canvas"
                        width="24"
                        height="24"
                    />
                </button>
            </div>
            <div className="separator"></div>
            <div className="slider-controls">
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
                />
                <span className="slider-value">{strokeWidth}</span>
            </div>
            <div className="separator"></div>
            <div className="control-group">
                <button
                    onClick={() => selectTool("brush-eraser")}
                    className={tool === "brush-eraser" ? "active" : ""}
                    title="Brush Eraser">
                    <img
                        src={brushEraserIcon}
                        alt="Brush Eraser"
                        width="24"
                        height="24"
                    />
                </button>
                <button
                    onClick={() => selectTool("stroke-eraser")}
                    className={tool === "stroke-eraser" ? "active" : ""}
                    title="Stroke Eraser">
                    <img
                        src={strokeEraserIcon}
                        alt="Stroke Eraser"
                        width="24"
                        height="24"
                    />
                </button>
            </div>
            <div className="separator"></div>
            <div className="control-group">
                <button onClick={undo} disabled={isUndoDisabled} title="Undo">
                    <img src={undoIcon} alt="Undo" width="24" height="24" />
                </button>
                <button onClick={redo} disabled={isRedoDisabled} title="Redo">
                    <img src={redoIcon} alt="Redo" width="24" height="24" />
                </button>
            </div>
        </div>
    );
};
