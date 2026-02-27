import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";

function Session() {
    const location = useLocation();
    const navigate = useNavigate();

    const { script } = location.state || {};

    // LIVE CONTROLS
    const [fontSize, setFontSize] = useState(28);
    const [alignment, setAlignment] = useState("center");
    const [speed, setSpeed] = useState(0.5); // Slower default

    const [isRunning, setIsRunning] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [timer, setTimer] = useState(0);

    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const startTimeRef = useRef(null);

    // ===== START SESSION =====
    const startSession = () => {
        if (!script) {
            alert("No script provided.");
            return;
        }

        if (!("webkitSpeechRecognition" in window)) {
            alert("Speech Recognition not supported in this browser.");
            return;
        }

        setTranscript("");
        setTimer(0);

        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }

        // TELEPROMPTER SCROLL
        const scroll = () => {
            if (!scrollRef.current) return;

            scrollRef.current.scrollTop += speed;

            if (
                scrollRef.current.scrollTop + scrollRef.current.clientHeight >=
                scrollRef.current.scrollHeight
            ) {
                stopSession();
                return;
            }

            animationRef.current = requestAnimationFrame(scroll);
        };

        animationRef.current = requestAnimationFrame(scroll);

        // SPEECH RECOGNITION
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            let text = "";
            for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript + " ";
            }
            setTranscript(text);
        };

        recognition.start();
        recognitionRef.current = recognition;

        // TIMER
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
            setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        setIsRunning(true);
    };

    // ===== STOP SESSION =====
    const stopSession = () => {
        cancelAnimationFrame(animationRef.current);
        clearInterval(timerRef.current);

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        setIsRunning(false);

        const results = analyzeSpeech();
        navigate("/dashboard", { state: results });
    };

 // ===== ANALYSIS =====
const analyzeSpeech = () => {
    const cleanTranscript = transcript.trim();
    const wordsArray = cleanTranscript.split(/\s+/).filter(Boolean);
    const totalWords = wordsArray.length;

    const durationSeconds = timer;
    const durationMinutes = durationSeconds / 60 || 1;

    const wpm = totalWords > 0
        ? Math.round(totalWords / durationMinutes)
        : 0;

    // Ideal speaking range
    const IDEAL_MIN_WPM = 120;
    const IDEAL_MAX_WPM = 160;

    // Filler words tracking
    const fillerWords = ["um", "uh", "like", "ah", "so", "you know"];
    const fillerBreakdown = {};

    const lowerTranscript = cleanTranscript.toLowerCase();
    let fillerCount = 0;

    fillerWords.forEach((word) => {
        const regex = new RegExp("\\b" + word + "\\b", "g");
        const matches = lowerTranscript.match(regex);
        const count = matches ? matches.length : 0;

        if (count > 0) {
            fillerBreakdown[word] = count;
            fillerCount += count;
        }
    });

    const fillerRate = totalWords > 0
        ? ((fillerCount / totalWords) * 100).toFixed(1)
        : 0;

    // ===== SCORING SYSTEM =====

    // Fluency score (based on fillers)
    let fluencyScore = 100 - fillerCount * 3;
    if (fluencyScore < 0) fluencyScore = 0;

    // Pace score
    let paceScore = 100;
    if (wpm < IDEAL_MIN_WPM) {
        paceScore -= 15;
    } else if (wpm > IDEAL_MAX_WPM) {
        paceScore -= 15;
    }

    // Final weighted score
    let overallScore = Math.round(
        fluencyScore * 0.6 +
        paceScore * 0.4
    );

    if (overallScore < 0) overallScore = 0;
    if (overallScore > 100) overallScore = 100;

    // Performance Level
    let performanceLevel = "";
    if (overallScore >= 85) performanceLevel = "Excellent";
    else if (overallScore >= 70) performanceLevel = "Good";
    else if (overallScore >= 50) performanceLevel = "Needs Improvement";
    else performanceLevel = "Beginner";

    // Feedback Messages
    let feedback = [];

    if (fillerCount === 0) {
        feedback.push("Excellent clarity with zero filler words.");
    } else if (fillerCount <= 5) {
        feedback.push("Minor filler usage. Keep refining your pauses.");
    } else {
        feedback.push("High filler usage detected. Practice intentional pauses.");
    }

    if (wpm < IDEAL_MIN_WPM) {
        feedback.push("Your pace is slightly slow. Increase energy and projection.");
    } else if (wpm > IDEAL_MAX_WPM) {
        feedback.push("You're speaking too fast. Slow down for clarity.");
    } else {
        feedback.push("Great pacing within ideal speaking range.");
    }

    return {
        summary: {
            durationSeconds,
            durationFormatted: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
            totalWords,
            wpm,
        },

        fluency: {
            fillerCount,
            fillerRate: Number(fillerRate),
            fillerBreakdown,
            fluencyScore,
        },

        pacing: {
            wpm,
            idealRange: `${IDEAL_MIN_WPM}-${IDEAL_MAX_WPM} WPM`,
            paceScore,
        },

        overall: {
            overallScore,
            performanceLevel,
        },

        feedback,
    };
};
    return (
        <div style={{ padding: "40px", textAlign: "center" }}>
            <h2>🎤 Live Session</h2>

            {/* LIVE CONTROLS */}
            <div style={{ marginBottom: "20px" }}>
                <div>
                    <label>Font Size: {fontSize}px</label><br />
                    <input
                        type="range"
                        min="18"
                        max="60"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                </div>

                <div>
                    <label>Scroll Speed: {speed.toFixed(2)}</label><br />
                    <input
                        type="range"
                        min="0.2"
                        max="2"
                        step="0.1"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                    />
                </div>

                <div>
                    <label>Alignment:</label><br />
                    <select
                        value={alignment}
                        onChange={(e) => setAlignment(e.target.value)}
                    >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                    </select>
                </div>
            </div>

            {/* TELEPROMPTER */}
            <div
                ref={scrollRef}
                style={{
                    height: "300px",
                    overflow: "hidden",
                    fontSize: fontSize,
                    textAlign: alignment,
                    border: "2px solid #6C63FF",
                    padding: "20px",
                    marginBottom: "20px",
                    background: "black",
                    color: "white",
                    lineHeight: "1.6",
                }}
            >
                <div style={{ paddingBottom: "600px" }}>{script}</div>
            </div>

            {/* START / STOP BUTTON */}
            {!isRunning ? (
                <button onClick={startSession}>Start Session</button>
            ) : (
                <button onClick={stopSession}>Stop Session</button>
            )}

            <p>⏱ Time: {timer}s</p>

            <h3>Live Transcript</h3>
            <p style={{ maxWidth: "600px", margin: "0 auto" }}>{transcript}</p>
        </div>
    );
}

export default Session;