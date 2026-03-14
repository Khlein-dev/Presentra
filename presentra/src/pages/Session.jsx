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
    
    // LIVE SPEECH ANALYSIS STATE
    const [liveWPM, setLiveWPM] = useState(0);
    const [averageWPM, setAverageWPM] = useState(0);
    const [liveFeedback, setLiveFeedback] = useState("");
    const [wordCount, setWordCount] = useState(0);

    // LIVE VOLUME ANALYZER STATE
    const [liveVolume, setLiveVolume] = useState(0);        // 0-100 normalized
    const [volumeLabel, setVolumeLabel] = useState("");     // Too Quiet / Good / Too Loud

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

    // Use a ref for averageWPM so stopSession always has latest value
    const averageWPMRef = useRef(0);
    useEffect(() => { averageWPMRef.current = averageWPM; }, [averageWPM]);

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
        
        // Reset live analysis state
        setLiveWPM(0);
        setAverageWPM(0);
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
                const IDEAL_MAX_WPM = 180;
                
                if (calculatedWPM < IDEAL_MIN_WPM) {
                    setLiveFeedback("Too Slow");
                } else if (calculatedWPM > IDEAL_MAX_WPM) {
                    setLiveFeedback("Too Fast");
                } else {
                    setLiveFeedback("Good Pace");
                }
            }
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

                // Rolling buffer for smoothing — last 15 samples (~750ms at 20fps)
                const smoothingBuffer = [];
                const SMOOTH_WINDOW = 15;

                // Poll volume ~20x per second
                const pollVolume = () => {
                    analyser.getByteFrequencyData(dataArray);

                    // RMS of frequency data as a proxy for volume
                    const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
                    const rms = Math.sqrt(sum / dataArray.length);

                    // Normalize to 0-100
                    const normalized = Math.min(100, Math.round(rms));

                    // Accumulate full session history for dashboard (raw)
                    volumeHistoryRef.current.push(normalized);

                    // Apply rolling average before thresholding and display
                    smoothingBuffer.push(normalized);
                    if (smoothingBuffer.length > SMOOTH_WINDOW) smoothingBuffer.shift();
                    const smoothed = Math.round(
                        smoothingBuffer.reduce((a, b) => a + b, 0) / smoothingBuffer.length
                    );

                    setLiveVolume(smoothed);

                    // --- ALIGNED volume thresholds ---
                    // Live loud threshold is slightly higher than dashboard (94 vs 90)
                    // to account for residual smoothing difference between live and post-session
                    const QUIET_THRESHOLD = 35;
                    const LOUD_THRESHOLD  = 94;

                    if (smoothed < QUIET_THRESHOLD) {
                        setVolumeLabel("Too Quiet");
                    } else if (smoothed > LOUD_THRESHOLD) {
                        setVolumeLabel("Too Loud");
                    } else {
                        setVolumeLabel("Good");
                    }

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

        // Add averageWPM to the results (use ref to avoid stale closure)
        results.summary.averageWPM = averageWPMRef.current;

        navigate("/dashboard", { state: results });
    };

    // ===== ANALYSIS =====
    const analyzeSpeech = (finalTranscript, durationSeconds, fillerTimeline) => {
        const cleanTranscript = (finalTranscript || "").trim();
        const wordsArray = cleanTranscript.split(/\s+/).filter(Boolean);
        const totalWords = wordsArray.length;

        const durationMinutes = durationSeconds / 60 || 1;

        const wpm = totalWords > 0
            ? Math.round(totalWords / durationMinutes)
            : 0;

        // Ideal speaking range for presentations is typically around 120-160 WPM
        const IDEAL_MIN_WPM = 120;
        const IDEAL_MAX_WPM = 160;

        // Filler words tracking
        // Only count fillers not present in the script
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
                wpm,
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
                wpm,
                idealRange: `${IDEAL_MIN_WPM}-${IDEAL_MAX_WPM} WPM`,
                paceScore,
            },

            overall: {
                overallScore,
                performanceLevel,
            },

            // Volume analysis data for dashboard graph
            volume: {
                history: volumeHistoryRef.current,
                quietThreshold: 35,
                loudThreshold: 90,
                sessionDuration: durationSeconds,
            },

            feedback,
            transcript: cleanTranscript,
            script,
        };
    };

    // --- Volume icon helper ---
    // Returns { icon, color } based on current volume level and label
    const getVolumeIcon = () => {
        if (!volumeLabel) return { icon: "bi-volume-mute-fill", color: "#64748b" };
        if (volumeLabel === "Too Quiet") return { icon: "bi-volume-off-fill",  color: "#f59e0b" };
        if (volumeLabel === "Too Loud")  return { icon: "bi-volume-up-fill",   color: "#ef4444" };
        return                                  { icon: "bi-volume-down-fill", color: "#22c55e" };
    };

    const { icon: volIcon, color: volColor } = getVolumeIcon();

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
                                
                                {/* Word Count Display */}
                                <div className="col-4">
                                    <div className="bg-dark rounded p-3">
                                        <div className="small text-white">Words Spoken</div>
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
                                            <span className="text-white">Waiting...</span>
                                        )}
                                    </div>
                                </div>

                                {/* LIVE VOLUME ICON */}
                                <div className="col-4">
                                    <div className="bg-dark rounded p-3 h-100 d-flex flex-column align-items-center justify-content-center gap-1">
                                        <i
                                            className={`bi ${volIcon}`}
                                            style={{
                                                fontSize: "2rem",
                                                color: volColor,
                                                transition: "color 0.2s ease",
                                            }}
                                        />
                                        <span style={{ fontSize: "11px", color: volColor, transition: "color 0.2s ease" }}>
                                            {volumeLabel || "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Ideal Range Indicator */}
                            <div className="mt-3 text-white small">
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