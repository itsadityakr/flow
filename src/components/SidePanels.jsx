import React from "react";

export const SidePanels = ({
    isLeftPanelOpen,
    commonColors,
    color,
    setColor,
    canvasBgColors,
    canvasColor,
    setCanvasColor,
    tool,
}) => {
    return (
        <>
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
        </>
    );
};
