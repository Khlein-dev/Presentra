import { useState } from "react";

function Teleprompter({ onStart }) {
    const [script, setScript] = useState("");
    const [speed, setSpeed] = useState(2);
    const [fontSize, setFontSize] = useState(28);
    const [alignment, setAlignment] = useState("center");

    const handleStart = () => {
        onStart({
            script,
            speed,
            fontSize,
            alignment,
        });
    };

    return (
        <div style={{ marginBottom: "40px" }}>
            <h2>Teleprompter Setup</h2>

            <textarea
                rows="6"
                style={{ width: "100%" }}
                placeholder="Paste your script here..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
            />

            <div style={{ marginTop: "10px" }}>
                <label>Scroll Speed: </label>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                />
                {speed}
            </div>

            <div>
                <label>Font Size: </label>
                <input
                    type="range"
                    min="16"
                    max="60"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                />
                {fontSize}px
            </div>

            <div>
                <label>Alignment: </label>
                <select
                    value={alignment}
                    onChange={(e) => setAlignment(e.target.value)}
                >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                </select>
            </div>

            <button onClick={handleStart} style={{ marginTop: "10px" }}>
                Start Teleprompter
            </button>
        </div>
    );
}

export default Teleprompter;