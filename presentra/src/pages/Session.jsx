import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Holistic } from "@mediapipe/holistic";
import * as cam from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import Webcam from "react-webcam";
import "../styles/Session.css";

// --- HOLISTIC TRACKER COMPONENT (Hands + Body + Face) ---
const HandTracker = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [error, setError] = useState(null);
    const holisticRef = useRef(null);
    const cameraRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log("Cleaning up camera and holistic...");
            
            // Stop camera
            if (cameraRef.current) {
                try {
                    cameraRef.current.stop?.();
                    console.log("Camera stopped");
                } catch (err) {
                    console.error("Error stopping camera:", err);
                }
            }

            // Close holistic
            if (holisticRef.current) {
                try {
                    holisticRef.current.close?.();
                    console.log("Holistic closed");
                } catch (err) {
                    console.error("Error closing holistic:", err);
                }
            }

            // Stop webcam tracks
            if (webcamRef.current?.video?.srcObject) {
                const tracks = webcamRef.current.video.srcObject.getTracks();
                tracks.forEach(track => {
                    track.stop();
                    console.log("Webcam track stopped");
                });
            }
        };
    }, []);

    const onUserMedia = async () => {
        try {
            console.log("Webcam ready, initializing MediaPipe Holistic...");
            
            if (holisticRef.current) {
                console.log("MediaPipe already initialized");
                return;
            }

            // Wait for video to have actual dimensions
            await new Promise(resolve => {
                const checkDimensions = () => {
                    if (webcamRef.current?.video?.videoWidth > 0) {
                        console.log("Video dimensions ready");
                        resolve();
                    } else {
                        setTimeout(checkDimensions, 100);
                    }
                };
                checkDimensions();
            });

            // Initialize Holistic (combines hands, pose, and face)
            const holistic = new Holistic({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
            });

            holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            // Setup Holistic results with drawing
            holistic.onResults((results) => {
                if (!webcamRef.current?.video || !canvasRef.current) return;
                
                const videoWidth = webcamRef.current.video.videoWidth;
                const videoHeight = webcamRef.current.video.videoHeight;
                
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;

                const canvasCtx = canvasRef.current.getContext("2d");
                if (!canvasCtx) return;

                canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
                
                // Draw video frame
                if (results.image) {
                    canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);
                }

                // Helper function to draw connections manually
                const drawManualConnections = (landmarks, connections, color, lineWidth) => {
                    if (!landmarks || !connections) return;
                    
                    canvasCtx.strokeStyle = color;
                    canvasCtx.lineWidth = lineWidth;
                    canvasCtx.lineCap = 'round';
                    canvasCtx.lineJoin = 'round';

                    for (const connection of connections) {
                        const start = landmarks[connection.start];
                        const end = landmarks[connection.end];

                        if (start && end) {
                            canvasCtx.beginPath();
                            canvasCtx.moveTo(start.x * videoWidth, start.y * videoHeight);
                            canvasCtx.lineTo(end.x * videoWidth, end.y * videoHeight);
                            canvasCtx.stroke();
                        }
                    }
                };

                // Helper function to draw landmarks
                const drawManualLandmarks = (landmarks, color, radius) => {
                    if (!landmarks) return;
                    
                    canvasCtx.fillStyle = color;

                    for (const landmark of landmarks) {
                        canvasCtx.beginPath();
                        canvasCtx.arc(landmark.x * videoWidth, landmark.y * videoHeight, radius, 0, 2 * Math.PI);
                        canvasCtx.fill();
                    }
                };

                // Connection definitions for pose (MediaPipe Holistic Pose landmarks)
                const POSE_CONNECTIONS = [
                    // Head
                    { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 7 },
                    { start: 4, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 8 },
                    // Torso
                    { start: 9, end: 10 },
                    // Right arm
                    { start: 11, end: 13 }, { start: 13, end: 15 }, { start: 15, end: 17 }, { start: 17, end: 19 },
                    { start: 15, end: 21 },
                    // Left arm
                    { start: 12, end: 14 }, { start: 14, end: 16 }, { start: 16, end: 18 }, { start: 18, end: 20 },
                    { start: 16, end: 22 },
                    // Right leg
                    { start: 11, end: 23 }, { start: 23, end: 25 }, { start: 25, end: 27 }, { start: 27, end: 29 },
                    { start: 29, end: 31 },
                    // Left leg
                    { start: 12, end: 24 }, { start: 24, end: 26 }, { start: 26, end: 28 }, { start: 28, end: 30 },
                    { start: 30, end: 32 }
                ];

                // Hand connections (simplified)
                const HAND_CONNECTIONS = [
                    { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 4 },
                    { start: 0, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 7 }, { start: 7, end: 8 },
                    { start: 0, end: 9 }, { start: 9, end: 10 }, { start: 10, end: 11 }, { start: 11, end: 12 },
                    { start: 0, end: 13 }, { start: 13, end: 14 }, { start: 14, end: 15 }, { start: 15, end: 16 },
                    { start: 0, end: 17 }, { start: 17, end: 18 }, { start: 18, end: 19 }, { start: 19, end: 20 }
                ];

                // Draw Pose (body)
                if (results.poseLandmarks) {
                    drawManualConnections(results.poseLandmarks, POSE_CONNECTIONS, "#00FF00", 3);
                    drawManualLandmarks(results.poseLandmarks, "#FF0000", 4);
                }

                // Draw Left Hand
                if (results.leftHandLandmarks) {
                    drawManualConnections(results.leftHandLandmarks, HAND_CONNECTIONS, "#00FF00", 2);
                    drawManualLandmarks(results.leftHandLandmarks, "#FF0000", 3);
                }

                // Draw Right Hand
                if (results.rightHandLandmarks) {
                    drawManualConnections(results.rightHandLandmarks, HAND_CONNECTIONS, "#00FF00", 2);
                    drawManualLandmarks(results.rightHandLandmarks, "#FF0000", 3);
                }

                // Draw Face
                if (results.faceLandmarks) {
                    drawManualLandmarks(results.faceLandmarks, "#FF0000", 2);
                    // Draw some basic face connections for lips and eyes
                    const faceLandmarks = results.faceLandmarks;
                    canvasCtx.strokeStyle = "#00FF00";
                    canvasCtx.lineWidth = 1;
                    
                    // Draw mouth
                    const mouthStart = 61;
                    const mouthEnd = 291;
                    if (faceLandmarks[mouthStart] && faceLandmarks[mouthEnd]) {
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(faceLandmarks[mouthStart].x * videoWidth, faceLandmarks[mouthStart].y * videoHeight);
                        canvasCtx.lineTo(faceLandmarks[mouthEnd].x * videoWidth, faceLandmarks[mouthEnd].y * videoHeight);
                        canvasCtx.stroke();
                    }
                }
            });

            holisticRef.current = holistic;

            // Now start the camera
            const camera = new cam.Camera(webcamRef.current.video, {
                onFrame: async () => {
                    if (holisticRef.current && webcamRef.current?.video) {
                        await holisticRef.current.send({ image: webcamRef.current.video });
                    }
                },
                width: 640,
                height: 480,
            });

            cameraRef.current = camera;
            camera.start();
            console.log("Holistic tracking started - hands, body, and face");
        } catch (err) {
            console.error("Holistic tracker error:", err);
            setError(`Error: ${err.message}`);
        }
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "250px", borderRadius: "10px", overflow: "hidden", background: "#1a1a1a" }}>
            {error && (
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "#1a1a1a",
                    color: "#ff6b6b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                    fontSize: "13px",
                    padding: "20px",
                    textAlign: "center",
                    flexDirection: "column",
                    gap: "10px"
                }}>
                    <span>⚠️ Webcam Error</span>
                    <span style={{ fontSize: "12px" }}>{error}</span>
                </div>
            )}
            <Webcam 
                ref={webcamRef} 
                mirrored={true} 
                style={{ 
                    position: "absolute", 
                    width: "100%", 
                    height: "100%",
                }}
                onUserMedia={onUserMedia}
                onUserMediaError={(err) => {
                    console.error("Webcam permission error:", err);
                    setError("Camera access denied. Check browser permissions.");
                }}
                videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "user"
                }}
            />
            <canvas 
                ref={canvasRef} 
                style={{ 
                    position: "absolute", 
                    width: "100%", 
                    height: "100%", 
                    transform: "scaleX(-1)" 
                }} 
            />
        </div>
    );
};

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
    
    // LIVE SPEECH ANALYSIS STATE
    const [liveWPM, setLiveWPM] = useState(0);
    const [averageWPM, setAverageWPM] = useState(0);
    const [liveFeedback, setLiveFeedback] = useState("");
    const [wordCount, setWordCount] = useState(0);
    
    // Refs for live analysis - rolling window approach
    const wordsSpokenRef = useRef([]); // Store timestamped words for rolling window
    const lastAnalysisTimeRef = useRef(null);
    const lastWordCountRef = useRef(0);

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
        
        // Reset live analysis state
        setLiveWPM(0);
        setAverageWPM(0);
        setLiveFeedback("");
        setWordCount(0);
        wordsSpokenRef.current = [];
        lastAnalysisTimeRef.current = Date.now();

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
            
            // ===== LIVE SPEECH ANALYSIS (Rolling Window) =====
            const currentTranscript = text.trim();
            const wordsArray = currentTranscript.split(/\s+/).filter(Boolean);
            const currentWordCount = wordsArray.length;
            
            // Get current time
            const now = Date.now();
            
            // Add new words with timestamp to rolling window
            const newWords = wordsArray.slice(lastWordCountRef.current);
            newWords.forEach(word => {
                wordsSpokenRef.current.push({ word, timestamp: now });
            });
            lastWordCountRef.current = currentWordCount;
            
            // Keep only words from the last 10 seconds (rolling window)
            const WINDOW_SIZE_MS = 10000; // 10 seconds
            const windowStartTime = now - WINDOW_SIZE_MS;
            
            // Filter to keep only recent words within the window
            const recentWords = wordsSpokenRef.current.filter(w => w.timestamp >= windowStartTime);
            wordsSpokenRef.current = recentWords;
            
            const recentWordCount = recentWords.length;
            const windowDurationSeconds = 10; // Fixed 10-second window
            
            // Calculate WPM based on rolling window
            if (recentWordCount > 0) {
                // Calculate actual window duration if less than 10 seconds
                let actualDuration = windowDurationSeconds;
                if (recentWords.length > 0) {
                    const oldestTimestamp = recentWords[0].timestamp;
                    const elapsed = (now - oldestTimestamp) / 1000;
                    if (elapsed < windowDurationSeconds) {
                        actualDuration = elapsed;
                    }
                }
                
                // Calculate WPM: (words in window / duration in minutes)
                const calculatedWPM = Math.round((recentWordCount / actualDuration) * 60);
                setLiveWPM(calculatedWPM);
                setWordCount(currentWordCount);
                
                // Calculate average WPM (total words / total time since session start)
                const sessionElapsedMs = now - lastAnalysisTimeRef.current;
                const sessionElapsedMinutes = sessionElapsedMs / 60000;
                const avgWPM = currentWordCount > 0 
                    ? Math.round(currentWordCount / sessionElapsedMinutes)
                    : 0;
                setAverageWPM(avgWPM);
                
                // Determine feedback based on WPM
                const IDEAL_MIN_WPM = 90;
                const IDEAL_MAX_WPM = 160;
                
                if (calculatedWPM < IDEAL_MIN_WPM) {
                    setLiveFeedback("Too Slow");
                } else if (calculatedWPM > IDEAL_MAX_WPM) {
                    setLiveFeedback("Too Fast");
                } else {
                    setLiveFeedback("Good Pace");
                }
            }
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
        
        // Add averageWPM to the results
        results.summary.averageWPM = averageWPM;
        
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

        // Ideal speaking range for presentations is typically around 120-160 WPM
        const IDEAL_MIN_WPM = 120;
        const IDEAL_MAX_WPM = 160;

        // Filler words tracking
        const fillerWords = ["um", "uh", "like", "ah", "so", "you know", "actually", "basically", "literally", "just", "well", "yeah", "hmm"];
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
        <div className="py-5 p-5 body">

            <div className="text-center mb-4">
                <h2 className="fw-bold text-white">
                    <i className="bi bi-mic-fill text-white me-2"></i>
                    Live Speech Session
                </h2>
                <p className="text-secondary">Practice your delivery in real time</p>
            </div>

            <div className="row g-4">

                {/* LEFT: CONTROLS */}
                <div className="col-lg-4 teleprompter-controls">
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h5 className="card-title mb-4 text-white">
                                <i className="bi bi-sliders me-2 text-white"></i>
                                Live Controls
                            </h5>

                            {/* Font Size */}
                            <div className="mb-4">
                                <label className="form-label text-white">
                                    <i className="bi bi-fonts me-2 text-white"></i>
                                    Font Size ({fontSize}px)
                                </label>
                                <input
                                    type="range"
                                    className="form-range"
                                    min="18"
                                    max="60"
                                    value={fontSize}
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                />
                            </div>

                            {/* Scroll Speed */}
                            <div className="mb-4">
                                <label className="form-label text-white">
                                    <i className="bi bi-speedometer2 me-2 text-white"></i>
                                    Scroll Speed ({speed.toFixed(2)})
                                </label>
                                <input
                                    type="range"
                                    className="form-range"
                                    min="0.2"
                                    max="2"
                                    step="0.1"
                                    value={speed}
                                    onChange={(e) => setSpeed(Number(e.target.value))}
                                />
                            </div>

                            {/* Alignment */}
                            <div className="mb-4">
                                <label className="form-label text-white">
                                    <i className="bi bi-text-left me-2 text-white"></i>
                                    Alignment
                                </label>
                                <select
                                    className="form-select"
                                    value={alignment}
                                    onChange={(e) => setAlignment(e.target.value)}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>

                            {/* Timer */}
                            <div className="alert alert-dark text-center">
                                <i className="bi bi-clock me-2 text-white"></i>
                                {timer}s
                            </div>

                            {/* Start / Stop */}
                            {!isRunning ? (
                                <button
                                    className="btn btn-success w-100"
                                    onClick={startSession}
                                >
                                    <i className="bi bi-play-fill me-2"></i>
                                    Start Session
                                </button>
                            ) : (
                                <button
                                    className="btn btn-danger w-100"
                                    onClick={stopSession}
                                >
                                    <i className="bi bi-stop-fill me-2"></i>
                                    Stop Session
                                </button>
                            )}
                        </div>
                    </div>

                    {/* WEBCAM FEED */}
                    <div className="card shadow-sm mt-4">
                        <div className="card-body">
                            <h5 className="card-title mb-3 text-white">
                                <i className="bi bi-camera-video me-2"></i>
                                Webcam Feed
                            </h5>
                            <HandTracker />
                        </div>
                    </div>
                </div>

                {/* RIGHT: TELEPROMPTER */}
                <div className="col-lg-8">
                    {/* LIVE SPEECH ANALYSIS DISPLAY */}
                    <div className="card shadow-sm mb-4" style={{ background: liveFeedback === "Good Pace" ? "#1a3d1a" : liveFeedback === "Too Fast" || liveFeedback === "Too Slow" ? "#3d1a1a" : "#2d2d2d" }}>
                        <div className="card-body text-center">
                            <h5 className="text-white mb-3">
                                <i className="bi bi-graph-up me-2"></i>
                                Live Speech Analysis
                            </h5>
                            
                            <div className="row g-3">
                                {/* WPM Display */}
                                <div className="col-4">
                                    <div className="bg-dark rounded p-3">
                                        <div className="text-muted small text-white">Current WPM</div>
                                        <div className="fs-2 fw-bold text-white">{liveWPM}</div>
                                    </div>
                                </div>
                                
                                {/* Word Count Display */}
                                <div className="col-4">
                                    <div className="bg-dark rounded p-3">
                                        <div className="text-muted small text-white">Words Spoken</div>
                                        <div className="fs-2 fw-bold text-white">{wordCount}</div>
                                    </div>
                                </div>
                                
                                {/* Feedback Badge */}
                                <div className="col-4">
                                    <div className="bg-dark rounded p-3 h-100 d-flex align-items-center justify-content-center">
                                        {liveFeedback ? (
                                            <span className={`badge fs-6 px-3 py-2 ${
                                                liveFeedback === "Good Pace" ? "bg-success" : 
                                                liveFeedback === "Too Fast" ? "bg-danger" : "bg-warning text-dark"
                                            }`}>
                                                {liveFeedback}
                                            </span>
                                        ) : (
                                            <span className="text-muted">Waiting...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Ideal Range Indicator */}
                            <div className="mt-3 text-muted small">
                                Ideal speaking range: 90-160 WPM | Based on last 10 seconds
                            </div>
                        </div>
                    </div>
                    
                    <div className="card shadow-sm">
                        <div
                            ref={scrollRef}
                            className="card-body bg-black text-white"
                            style={{
                                height: "400px",
                                overflow: "hidden",
                                fontSize: fontSize,
                                textAlign: alignment,
                                lineHeight: "1.6",
                            }}
                        >
                            <div style={{ paddingBottom: "600px" }}>
                                {script}
                            </div>
                        </div>
                    </div>

                    {/* Transcript */}
                    <div className="card mt-4 shadow-sm">
                        <div className="card-body">
                            <h5>
                                <i className="bi bi-chat-dots me-2"></i>
                                Live Transcript
                            </h5>
                            <p className="text-muted">{transcript}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Session;
