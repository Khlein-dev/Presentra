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

// All known filler words to check against
const ALL_FILLER_WORDS = ["um", "uh", "like", "ah", "so", "you know", "actually", "basically", "literally", "just", "well", "yeah", "hmm"];

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
    
    // LIVE SPEECH ANALYSIS STATE (WPM removed)
    const [liveFeedback, setLiveFeedback] = useState(""); // Repurposed for other feedback if needed
    const [wordCount, setWordCount] = useState(0);

    // LIVE VOLUME ANALYZER STATE
    const [liveVolume, setLiveVolume] = useState(0);        // 0-100 normalized
    const [volumeLabel, setVolumeLabel] = useState("");     // Too Quiet / Good / Too Loud
    const [volumeHistory, setVolumeHistory] = useState([]); // rolling ~5s of samples

    // Refs for live analysis - rolling window approach
    const wordsSpokenRef = useRef([]); // Store timestamped words for rolling window
    const lastAnalysisTimeRef = useRef(null);
    const lastWordCountRef = useRef(0);

    // Refs for Web Audio API volume analysis
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const micStreamRef = useRef(null);
    const volumeRafRef = useRef(null); // requestAnimationFrame handle for volume polling
    const volumeHistoryRef = useRef([]); // full session volume samples for dashboard

    // Store filler occurrences with timestamps for timeline
    const fillerTimelineRef = useRef([]); // [{ word, secondsElapsed }]
    const transcriptRef = useRef(""); // always up-to-date transcript

    // Use a ref for timer so stopSession always has latest value
    const timerValueRef = useRef(0);
    useEffect(() => { timerValueRef.current = timer; }, [timer]);



    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const startTimeRef = useRef(null);

    // Build a set of words in the script (lowercased) so we never flag them as fillers
    const scriptWordsSet = React.useMemo(() => {
        if (!script) return new Set();
        const words = script.toLowerCase().match(/\b\w+\b/g) || [];
        return new Set(words);
    }, [script]);

    // Effective filler list = ALL_FILLER_WORDS minus any that appear in the script
    const effectiveFillerWords = React.useMemo(() => {
        return ALL_FILLER_WORDS.filter(filler => {
            // For multi-word fillers (e.g. "you know"), check if the exact phrase appears in the script
            const parts = filler.split(" ");
            if (parts.length > 1) {
                return !script?.toLowerCase().includes(filler);
            }
            return !scriptWordsSet.has(filler);
        });
    }, [scriptWordsSet, script]);

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
        
        // Reset live analysis state (WPM removed)
        setLiveFeedback("");
        setWordCount(0);
        wordsSpokenRef.current = [];
        lastAnalysisTimeRef.current = Date.now();
        lastWordCountRef.current = 0;
        fillerTimelineRef.current = [];
        transcriptRef.current = "";

        // Reset volume state
        setLiveVolume(0);
        setVolumeLabel("");
        setVolumeHistory([]);
        volumeHistoryRef.current = [];

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

        // Snapshot of transcript at the start of each recognition session
        // so restarts don't overwrite previously accumulated text
        let sessionBaseTranscript = "";

        recognition.onstart = () => {
            sessionBaseTranscript = transcriptRef.current;
        };

        recognition.onresult = (event) => {
            // Build only what this recognition session has heard
            let sessionText = "";
            for (let i = 0; i < event.results.length; i++) {
                sessionText += event.results[i][0].transcript + " ";
            }
            // Append to whatever was said before this session started
            const text = sessionBaseTranscript + sessionText;
            setTranscript(text);
            transcriptRef.current = text;
            
            // ===== LIVE SPEECH ANALYSIS (Rolling Window) =====
            const currentTranscript = text.trim();
            const wordsArray = currentTranscript.split(/\s+/).filter(Boolean);
            const currentWordCount = wordsArray.length;
            
            // Get current time
            const now = Date.now();
            const secondsElapsed = Math.floor((now - startTimeRef.current) / 1000);
            
            // Add new words with timestamp to rolling window
            const newWords = wordsArray.slice(lastWordCountRef.current);
            newWords.forEach((word, newWordIdx) => {
                wordsSpokenRef.current.push({ word, timestamp: now });

                // Detect new filler word occurrences with timestamps
                const lowerWord = word.toLowerCase().replace(/[^a-z]/g, "");
                if (effectiveFillerWords.includes(lowerWord)) {
                    // Grab ~5-word context window around filler from the full transcript
                    const fillerGlobalIdx = lastWordCountRef.current + newWordIdx;
                    const contextStart = Math.max(0, fillerGlobalIdx - 3);
                    const contextEnd = Math.min(wordsArray.length, fillerGlobalIdx + 4);
                    const contextWords = wordsArray.slice(contextStart, contextEnd);
                    // Wrap the filler word in markers so Dashboard can highlight it
                    const fillerLocalIdx = fillerGlobalIdx - contextStart;
                    contextWords[fillerLocalIdx] = `__${contextWords[fillerLocalIdx]}__`;
                    const snippet = contextWords.join(" ");

                    fillerTimelineRef.current.push({ word: lowerWord, secondsElapsed, snippet });
                }
            });

            // Check for new multi-word filler phrases in the latest spoken chunk
            const newChunk = newWords.join(" ").toLowerCase();
            effectiveFillerWords.forEach(filler => {
                if (filler.includes(" ") && newChunk.includes(filler)) {
                    // Build snippet for phrase fillers too
                    const phraseIdx = wordsArray.findLastIndex((_, i) =>
                        wordsArray.slice(i, i + filler.split(" ").length).join(" ").toLowerCase() === filler
                    );
                    const contextStart = Math.max(0, phraseIdx - 3);
                    const contextEnd = Math.min(wordsArray.length, phraseIdx + filler.split(" ").length + 3);
                    const contextWords = [...wordsArray.slice(contextStart, contextEnd)];
                    const snippet = contextWords.join(" ");

                    fillerTimelineRef.current.push({ word: filler, secondsElapsed, isPhrase: true, snippet });
                }
            });

            lastWordCountRef.current = currentWordCount;
            
            // Keep only words from the last 10 seconds (rolling window)
            const WINDOW_SIZE_MS = 15000; // 10 seconds
            const windowStartTime = now - WINDOW_SIZE_MS;
            
            // Filter to keep only recent words within the window
            const recentWords = wordsSpokenRef.current.filter(w => w.timestamp >= windowStartTime);
            wordsSpokenRef.current = recentWords;
            
            // WPM calculation removed
            setLiveFeedback("Analyzing...");
        };

        recognition.onend = () => {
            // Browser silently stops recognition after a pause — restart if session still running
            if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) { /* already starting */ }
            }
        };

        recognition.onerror = (event) => {
            // "no-speech" and "aborted" are non-fatal — onend will handle the restart
            if (event.error === "no-speech" || event.error === "aborted") return;
            console.error("Speech recognition error:", event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;

        // TIMER
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
            setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        // VOLUME ANALYZER (Web Audio API)
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then((stream) => {
                micStreamRef.current = stream;

                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioContextRef.current = audioCtx;

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.6; // Smooth out jitter
                analyserRef.current = analyser;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                // Poll volume ~20x per second
                const pollVolume = () => {
                    analyser.getByteFrequencyData(dataArray);

                    // RMS of frequency data as a proxy for volume
                    const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
                    const rms = Math.sqrt(sum / dataArray.length);

                    // Normalize to 0-100 (typical rms range ~0-100 for speech)
                    const normalized = Math.min(100, Math.round(rms));

                    setLiveVolume(normalized);

                    // Accumulate full session history for dashboard
                    volumeHistoryRef.current.push(normalized);

                    // Volume label thresholds
                    if (normalized < 15) {
                        setVolumeLabel("Too Quiet");
                    } else if (normalized > 70) {
                        setVolumeLabel("Too Loud");
                    } else {
                        setVolumeLabel("Good");
                    }

                    // Rolling history — keep last 60 samples (~3s at 20fps)
                    setVolumeHistory(prev => {
                        const next = [...prev, normalized];
                        return next.length > 60 ? next.slice(next.length - 60) : next;
                    });

                    volumeRafRef.current = requestAnimationFrame(pollVolume);
                };

                volumeRafRef.current = requestAnimationFrame(pollVolume);
                console.log("Volume analyzer started");
            })
            .catch((err) => {
                console.warn("Volume analyzer: mic access denied or unavailable", err);
            });

        setIsRunning(true);
    };

    // ===== STOP SESSION =====
    const stopSession = () => {
        cancelAnimationFrame(animationRef.current);
        clearInterval(timerRef.current);

        // Stop volume analyzer
        cancelAnimationFrame(volumeRafRef.current);
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            console.log("Mic stream stopped");
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            console.log("AudioContext closed");
        }

        setIsRunning(false);

        const stoppedRecognition = recognitionRef.current;
        recognitionRef.current = null; // clear ref BEFORE stopping so onend doesn't restart
        if (stoppedRecognition) stoppedRecognition.stop();

        const results = analyzeSpeech(transcriptRef.current, timerValueRef.current, fillerTimelineRef.current);



        navigate("/dashboard", { state: results });
    };

    // ===== ANALYSIS =====
    const analyzeSpeech = (finalTranscript, durationSeconds, fillerTimeline) => {
        const cleanTranscript = (finalTranscript || "").trim();
        const wordsArray = cleanTranscript.split(/\s+/).filter(Boolean);
        const totalWords = wordsArray.length;

        const fillerBreakdown = {}; 

        const lowerTranscript = cleanTranscript.toLowerCase();
        let fillerCount = 0;

        effectiveFillerWords.forEach((word) => {
            const regex = new RegExp("\\b" + word.replace(" ", "\\s+") + "\\b", "g");
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

        // Pace scoring removed (no WPM)
        let paceScore = 100;

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

        // Pace feedback removed

        // Deduplicate phrase fillers (single-word matches already counted, remove double-counting)
        const cleanedTimeline = fillerTimeline.filter(entry => {
            if (entry.isPhrase) return true; // keep phrase hits
            return !entry.word.includes(" "); // skip phrase words counted individually
        });

        return {
            summary: {
                durationSeconds,
                durationFormatted: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
                totalWords,

            },

            fluency: {
                fillerCount,
                fillerRate: Number(fillerRate),
                fillerBreakdown,
                fluencyScore,
                fillerTimeline: cleanedTimeline,
                sessionDuration: durationSeconds,
                excludedFillers: ALL_FILLER_WORDS.filter(f => !effectiveFillerWords.includes(f)),
            },

            pacing: {
                paceScore,
            },

            overall: {
                overallScore,
                performanceLevel,
            },

            // Volume analysis data for dashboard graph
            volume: {
                history: volumeHistoryRef.current,
                quietThreshold: 15,  // below this = Too Quiet
                loudThreshold: 70,   // above this = Too Loud
                sessionDuration: durationSeconds,
            },

            feedback,
            transcript: cleanTranscript,
            script,
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
                                {/* Volume Only Display */}
                                <div className="col-12">
                                    <div className="bg-dark rounded p-3">
                                        <div className="text-muted small text-white">Live Speech Analysis</div>
                                        <div className="text-white fs-4">{liveFeedback || "Analyzing..."}</div>
                                    </div>
                                </div>
                            </div>

                            {/* LIVE VOLUME ANALYZER */}
                            <div className="bg-dark rounded p-3 mt-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-white small">
                                        <i className="bi bi-volume-up me-1"></i>
                                        Live Volume
                                    </span>
                                    {/* Volume label badge */}
                                    {volumeLabel ? (
                                        <span className={`badge ${
                                            volumeLabel === "Good" ? "bg-success" :
                                            volumeLabel === "Too Loud" ? "bg-danger" : "bg-warning text-dark"
                                        }`}>
                                            {volumeLabel}
                                        </span>
                                    ) : (
                                        <span className="text-muted small">Waiting...</span>
                                    )}
                                </div>

                                {/* Volume meter bar */}
                                <div style={{
                                    height: "10px",
                                    background: "rgba(255,255,255,0.08)",
                                    borderRadius: "999px",
                                    overflow: "hidden",
                                    marginBottom: "10px",
                                }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${liveVolume}%`,
                                        borderRadius: "999px",
                                        background: liveVolume > 70 ? "#ef4444" : liveVolume < 15 ? "#f59e0b" : "#22c55e",
                                        transition: "width 0.08s ease-out, background 0.2s",
                                    }} />
                                </div>

                                {/* Volume sparkline — last ~3s of history */}
                                {volumeHistory.length > 1 && (() => {
                                    const pts = volumeHistory;
                                    const svgW = 500, svgH = 40;
                                    const n = pts.length;
                                    const xp = (i) => (i / (n - 1)) * svgW;
                                    const yp = (v) => svgH - (v / 100) * svgH;

                                    // Smooth cubic bezier path
                                    let d = `M ${xp(0)},${yp(pts[0])}`;
                                    for (let i = 0; i < n - 1; i++) {
                                        const cpx = (xp(i + 1) - xp(i)) * 0.4;
                                        d += ` C ${xp(i) + cpx},${yp(pts[i])} ${xp(i + 1) - cpx},${yp(pts[i + 1])} ${xp(i + 1)},${yp(pts[i + 1])}`;
                                    }

                                    const areaD = `M 0,${svgH} L ${xp(0)},${yp(pts[0])} ${d.slice(d.indexOf("C"))} L ${xp(n - 1)},${svgH} Z`;

                                    const lineColor = liveVolume > 70 ? "#ef4444" : liveVolume < 15 ? "#f59e0b" : "#22c55e";

                                    return (
                                        <svg viewBox={`0 0 ${svgW} ${svgH}`}
                                            style={{ width: "100%", height: "40px", display: "block" }}
                                            preserveAspectRatio="none"
                                        >
                                            <defs>
                                                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                                                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                                                </linearGradient>
                                            </defs>
                                            {/* Area */}
                                            <path d={areaD} fill="url(#volGrad)" />
                                            {/* Line */}
                                            <path d={d} fill="none" stroke={lineColor}
                                                strokeWidth="1.5" strokeLinecap="round" />
                                        </svg>
                                    );
                                })()}
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