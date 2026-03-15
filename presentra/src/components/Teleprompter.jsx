import { useState } from "react";
import "../styles/Teleprompter.css";

function Teleprompter({ onStart }) {
    const [script, setScript] = useState("");
    const [speed, setSpeed] = useState(2);
    const [fontSize, setFontSize] = useState(28);
    const [alignment, setAlignment] = useState("center");
    const [memorizeMode, setMemorizeMode] = useState(false);

    const handleStart = () => {
        onStart({
            script: script.trim(),
            speed,
            fontSize,
            alignment,
            memorizeMode,
        });
    };

    const isDisabled = !script.trim();

    return (
        <div className="teleprompter-setup-page">
            <div className="teleprompter-setup-glow teleprompter-setup-glow-1"></div>
            <div className="teleprompter-setup-glow teleprompter-setup-glow-2"></div>

            <div className="teleprompter-setup-shell">
                <div className="teleprompter-setup-header">
                    <div className="teleprompter-setup-badge">
                        <i className="bi bi-stars"></i>
                        <span>Teleprompter Setup</span>
                    </div>

                    <h1 className="teleprompter-setup-title">Prepare Your Script</h1>

                    <p className="teleprompter-setup-subtitle">
                        Paste your speech, tune the scroll behavior, adjust font size,
                        choose alignment, and enable memorize mode before starting your
                        live practice session.
                    </p>
                </div>

                <div className="teleprompter-setup-grid">
                    <section className="teleprompter-card teleprompter-script-card">
                        <div className="teleprompter-card-header">
                            <h2>
                                <i className="bi bi-file-earmark-text-fill"></i>
                                Script Content
                            </h2>
                            <span className="teleprompter-chip">
                                {(script.trim().match(/\S+/g) || []).length} words
                            </span>
                        </div>

                        <textarea
                            rows="10"
                            className="teleprompter-textarea"
                            placeholder="Paste your script here..."
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                        />

                        <div className="teleprompter-script-footer">
                            <span className="teleprompter-helper-text">
                                Keep your script clean and easy to scan for the best
                                teleprompter experience.
                            </span>
                        </div>
                    </section>

                    <section className="teleprompter-card teleprompter-controls-card">
                        <div className="teleprompter-card-header">
                            <h2>
                                <i className="bi bi-sliders2"></i>
                                Display Controls
                            </h2>
                        </div>

                        <div className="teleprompter-control-group">
                            <label className="teleprompter-label">
                                <span>
                                    <i className="bi bi-speedometer2"></i>
                                    Scroll Speed
                                </span>
                                <strong>{speed}</strong>
                            </label>

                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={speed}
                                onChange={(e) => setSpeed(Number(e.target.value))}
                                className="form-range teleprompter-range"
                            />
                        </div>

                        <div className="teleprompter-control-group">
                            <label className="teleprompter-label">
                                <span>
                                    <i className="bi bi-type"></i>
                                    Font Size
                                </span>
                                <strong>{fontSize}px</strong>
                            </label>

                            <input
                                type="range"
                                min="16"
                                max="60"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                                className="form-range teleprompter-range"
                            />
                        </div>

                        <div className="teleprompter-control-group">
                            <label className="teleprompter-label">
                                <span>
                                    <i className="bi bi-text-center"></i>
                                    Alignment
                                </span>
                            </label>

                            <select
                                value={alignment}
                                onChange={(e) => setAlignment(e.target.value)}
                                className="form-select teleprompter-select"
                            >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>

                        <div className="teleprompter-control-group">
                            <label className="teleprompter-label">
                                <span>
                                    <i className="bi bi-journal-check"></i>
                                    Memorize Mode
                                </span>
                                <strong>{memorizeMode ? "On" : "Off"}</strong>
                            </label>

                            <div className="teleprompter-memorize-row">
                                <div className="teleprompter-tooltip-wrap">
                                    <button
                                        type="button"
                                        className={`teleprompter-memorize-btn ${
                                            memorizeMode ? "active" : ""
                                        }`}
                                        onClick={() => setMemorizeMode((prev) => !prev)}
                                        aria-pressed={memorizeMode}
                                        aria-label="Toggle memorize mode"
                                    >
                                        <i
                                            className={`bi ${
                                                memorizeMode
                                                    ? "bi-eye-slash-fill"
                                                    : "bi-eye-fill"
                                            }`}
                                        ></i>
                                        <span>
                                            {memorizeMode
                                                ? "Memorize Mode On"
                                                : "Enable Memorize Mode"}
                                        </span>
                                    </button>

                                    <span className="teleprompter-hover-text">
                                        This will hide the script while you are speaking,
                                        then show it again when you become quiet.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="teleprompter-preview-stats">
                            <div className="teleprompter-stat-box">
                                <small>Speed</small>
                                <strong>{speed}/10</strong>
                            </div>

                            <div className="teleprompter-stat-box">
                                <small>Font</small>
                                <strong>{fontSize}px</strong>
                            </div>

                            <div className="teleprompter-stat-box">
                                <small>Align</small>
                                <strong>{alignment}</strong>
                            </div>

                            <div className="teleprompter-stat-box">
                                <small>Memorize</small>
                                <strong>{memorizeMode ? "On" : "Off"}</strong>
                            </div>
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={isDisabled}
                            className="teleprompter-start-btn"
                            type="button"
                        >
                            <i className="bi bi-play-fill"></i>
                            <span>Start Teleprompter</span>
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default Teleprompter;