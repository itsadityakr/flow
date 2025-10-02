// App.jsx
import React, { useState } from "react";
import DrawingCanvas, { SET_BG_DEFAULT_TRANSPARENT } from "./DrawingCanvas";
import Screen from "./Screen";


const App = () => {
    const [isAnnotating, setIsAnnotating] = useState(false);


    return (
        <div className="relative w-full h-screen">
            {/* पीछे का Screen dim होता है जब annotate mode ON */}
            <div>
                <Screen onAnnotate={() => setIsAnnotating(true)} />
            </div>


            {/* ऊपर Drawing overlay */}
            {isAnnotating && (
                <div className="absolute inset-0 z-50">
                    {/* Transparent behaviour global flag से decide */}
                    <DrawingCanvas transparent={SET_BG_DEFAULT_TRANSPARENT} />


                    {/* Close button */}
                    <button
                        className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow"
                        onClick={() => setIsAnnotating(false)}>
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};


export default App;



