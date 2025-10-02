import React, { useState, useEffect } from "react";

// Main App Component
export default function App({ onAnnotate }) {
    const [zoomedContent, setZoomedContent] = useState(null);
    const [isZooming, setIsZooming] = useState(false);

    const sketchBoxStyle =
        "border-[3px] border-black p-2 rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity";

    const containerStyle = {
        backgroundColor: "#f36a12",
    };

    // Handlers for zooming in and out
    const handleBoxClick = (type, src) => {
        setZoomedContent({ type, src });
    };

    const handleCloseZoom = () => {
        setIsZooming(false);
        // Wait for the animation to finish before clearing the content
        setTimeout(() => {
            setZoomedContent(null);
        }, 300);
    };

    // Effect to trigger the zoom-in animation
    useEffect(() => {
        if (zoomedContent) {
            // A tiny delay allows the DOM to update before we add the animation class
            const timer = setTimeout(() => setIsZooming(true), 10);
            return () => clearTimeout(timer);
        }
    }, [zoomedContent]);

    return (
        <div
            style={containerStyle}
            className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 relative">
            <main className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Left Side: Panels and Button */}
                <div className="w-full">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Top Left Box */}
                        <div
                            className={`${sketchBoxStyle} h-50 sm:h-62`}
                            onClick={() =>
                                handleBoxClick(
                                    "video",
                                    "https://mscontent-gcp.extramarks.com/content_data/Animation/2022/9/13/166304299464366869_dir/1/1663042912488/main.mp4"
                                )
                            }>
                            <video
                                src="https://mscontent-gcp.extramarks.com/content_data/Animation/2022/9/13/166304299464366869_dir/1/1663042912488/main.mp4"
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"></video>
                        </div>

                        {/* Top Right Box */}
                        <div
                            className={`${sketchBoxStyle} h-50 sm:h-62`}
                            onClick={() =>
                                handleBoxClick(
                                    "iframe",
                                    "http://10.12.12.12/DevRoot/Testing/Aditya/Code/WebBuilds/Waves-16-09-2025-19-24-00/index.html"
                                )
                            }>
                            {/* The iframe source was an internal IP, it has been replaced with a public URL for demonstration */}
                            <iframe
                                src="http://10.12.12.12/DevRoot/Testing/Aditya/Code/WebBuilds/Waves-16-09-2025-19-24-00/index.html"
                                className="w-full h-full border-0 pointer-events-none"
                                title="Waves Build"></iframe>
                        </div>

                        {/* Bottom Long Box */}
                        <div
                            className={`${sketchBoxStyle} col-span-2 h-50 sm:h-72`}
                            onClick={() =>
                                handleBoxClick(
                                    "video",
                                    "https://mscontent-gcp.extramarks.com/content_data/Animation/2022/9/13/166304299464366869_dir/1/1663042912488/main.mp4"
                                )
                            }>
                            <video
                                src="https://mscontent-gcp.extramarks.com/content_data/Animation/2022/9/13/166304299464366869_dir/1/1663042912488/main.mp4"
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"></video>
                        </div>
                    </div>
                </div>

                {/* Right Side: WAVES Text */}
                <div className="flex items-center justify-center h-full">
                    <h1
                        className="text-8xl md:text-9xl text-white font-bold tracking-wider"
                        style={{ textShadow: "4px 4px 0 #000" }}>
                        WAVES
                    </h1>
                </div>
            </main>

            {/* Bottom Centered Button */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                    className="h-7 w-24 rounded-full border-1 border-black sm:h-10 sm:w-28 flex items-center justify-center text-xl font-bold transition-transform duration-200 bg-white cursor-pointer"
                    onClick={onAnnotate}>
                    Annotate
                </button>
            </div>

            {/* Zoomed Content Modal */}
            {zoomedContent && (
                <div
                    className={`fixed inset-0 bg-black flex items-center justify-center z-50 transition-opacity duration-300 ${
                        isZooming ? "bg-opacity-75" : "bg-opacity-0"
                    }`}
                    onClick={handleCloseZoom}>
                    <div
                        className={`relative w-11/12 h-5/6 max-w-4xl max-h-4xl bg-black rounded-lg overflow-hidden shadow-2xl transform transition-all duration-300 ${
                            isZooming
                                ? "scale-100 opacity-100"
                                : "scale-95 opacity-0"
                        }`}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the content
                    >
                        <button
                            className="absolute top-2 right-4 text-white text-4xl font-bold z-10 hover:text-gray-300 transition-colors"
                            onClick={handleCloseZoom}>
                            &times;
                        </button>
                        {zoomedContent.type === "video" ? (
                            <video
                                src={zoomedContent.src}
                                className="w-full h-full object-contain"
                                autoPlay
                                controls
                                loop
                            />
                        ) : (
                            <iframe
                                src={zoomedContent.src}
                                className="w-full h-full border-0"
                                title="Zoomed Content"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
