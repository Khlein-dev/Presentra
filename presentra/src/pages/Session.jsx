import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Holistic } from "@mediapipe/holistic";
import * as cam from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import "../styles/Session.css";

const ALL_FILLER_WORDS = [
    "um",
    "uh",
    "like",
    "ah",
    "so",
    "you know",
    "actually",
    "basically",
    "literally",
    "just",
    "well",
    "yeah",
    "hmm",
];

// -----------------------------
// Hand / Body / Face Tracker
// -----------------------------
const HandTracker = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const holisticRef = useRef(null);
    const cameraRef = useRef(null);
    const [error, setError] = useState("");

    useEffect(() => {
        return () => {
            try {
                cameraRef.current?.stop?.();
            } catch (err) {
                console.error("Error stopping camera:", err);
            }

            try {
                holisticRef.current?.close?.();
            } catch (err) {
                console.error("Error closing holistic:", err);
            }

            try {
                const stream = webcamRef.current?.video?.srcObject;
                if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                }
            } catch (err) {
                console.error("Error stopping webcam tracks:", err);
            }
        };
    }, []);

    const drawManualConnections = (
        ctx,
        landmarks,
        connections,
        width,
        height,
        color,
        lineWidth
    ) => {
        if (!ctx || !landmarks || !connections) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const connection of connections) {
            const start = landmarks[connection.start];
            const end = landmarks[connection.end];

            if (!start || !end) continue;

            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.stroke();
        }
    };

    const drawManualLandmarks = (ctx, landmarks, width, height, color, radius) => {
        if (!ctx || !landmarks) return;

        ctx.fillStyle = color;

        for (const landmark of landmarks) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * width,
                landmark.y * height,
                radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    };

    const onUserMedia = async () => {
        try {
            if (holisticRef.current) return;

            await new Promise((resolve) => {
                const checkVideoReady = () => {
                    const video = webcamRef.current?.video;
                    if (video?.videoWidth > 0 && video?.videoHeight > 0) {
                        resolve();
                    } else {
                        setTimeout(checkVideoReady, 100);
                    }
                };
                checkVideoReady();
            });

            const holistic = new Holistic({
                locateFile: (file) =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
            });

            holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            const POSE_CONNECTIONS = [
                { start: 0, end: 1 },
                { start: 1, end: 2 },
                { start: 2, end: 3 },
                { start: 3, end: 7 },
                { start: 4, end: 5 },
                { start: 5, end: 6 },
                { start: 6, end: 8 },
                { start: 9, end: 10 },
                { start: 11, end: 13 },
                { start: 13, end: 15 },
                { start: 15, end: 17 },
                { start: 17, end: 19 },
                { start: 15, end: 21 },
                { start: 12, end: 14 },
                { start: 14, end: 16 },
                { start: 16, end: 18 },
                { start: 18, end: 20 },
                { start: 16, end: 22 },
                { start: 11, end: 23 },
                { start: 23, end: 25 },
                { start: 25, end: 27 },
                { start: 27, end: 29 },
                { start: 29, end: 31 },
                { start: 12, end: 24 },
                { start: 24, end: 26 },
                { start: 26, end: 28 },
                { start: 28, end: 30 },
                { start: 30, end: 32 },
            ];

            const HAND_CONNECTIONS = [
                { start: 0, end: 1 },
                { start: 1, end: 2 },
                { start: 2, end: 3 },
                { start: 3, end: 4 },
                { start: 0, end: 5 },
                { start: 5, end: 6 },
                { start: 6, end: 7 },
                { start: 7, end: 8 },
                { start: 0, end: 9 },
                { start: 9, end: 10 },
                { start: 10, end: 11 },
                { start: 11, end: 12 },
                { start: 0, end: 13 },
                { start: 13, end: 14 },
                { start: 14, end: 15 },
                { start: 15, end: 16 },
                { start: 0, end: 17 },
                { start: 17, end: 18 },
                { start: 18, end: 19 },
                { start: 19, end: 20 },
            ];

            holistic.onResults((results) => {
                const video = webcamRef.current?.video;
                const canvas = canvasRef.current;
                if (!video || !canvas) return;

                const width = video.videoWidth;
                const height = video.videoHeight;

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.clearRect(0, 0, width, height);

                if (results.image) {
                    ctx.drawImage(results.image, 0, 0, width, height);
                }

                if (results.poseLandmarks) {
                    drawManualConnections(
                        ctx,
                        results.poseLandmarks,
                        POSE_CONNECTIONS,
                        width,
                        height,
                        "#B77CFF",
                        3
                    );
                    drawManualLandmarks(
                        ctx,
                        results.poseLandmarks,
                        width,
                        height,
                        "#F2E8FF",
                        3
                    );
                }

                if (results.leftHandLandmarks) {
                    drawManualConnections(
                        ctx,
                        results.leftHandLandmarks,
                        HAND_CONNECTIONS,
                        width,
                        height,
                        "#B77CFF",
                        2
                    );
                    drawManualLandmarks(
                        ctx,
                        results.leftHandLandmarks,
                        width,
                        height,
                        "#F2E8FF",
                        2.4
                    );
                }

                if (results.rightHandLandmarks) {
                    drawManualConnections(
                        ctx,
                        results.rightHandLandmarks,
                        HAND_CONNECTIONS,
                        width,
                        height,
                        "#B77CFF",
                        2
                    );
                    drawManualLandmarks(
                        ctx,
                        results.rightHandLandmarks,
                        width,
                        height,
                        "#F2E8FF",
                        2.4
                    );
                }

                if (results.faceLandmarks) {
                    drawManualLandmarks(
                        ctx,
                        results.faceLandmarks,
                        width,
                        height,
                        "#F2E8FF",
                        1.25
                    );
                }
            });

            holisticRef.current = holistic;

            const camera = new cam.Camera(webcamRef.current.video, {
                onFrame: async () => {
                    if (holisticRef.current && webcamRef.current?.video) {
                        await holisticRef.current.send({
                            image: webcamRef.current.video,
                        });
                    }
                },
                width: 640,
                height: 480,
            });

            cameraRef.current = camera;
            await camera.start();
        } catch (err) {
            console.error("Holistic tracker error:", err);
            setError(err?.message || "Unable to start body tracker.");
        }
    };

    return (
        <div className="tracker-shell">
            {error ? (
                <div className="tracker-error">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <span>Webcam Error</span>
                    <small>{error}</small>
                </div>
            ) : null}

            <Webcam
                ref={webcamRef}
                mirrored
                audio={false}
                className="tracker-video"
                onUserMedia={onUserMedia}
                onUserMediaError={(err) => {
                    console.error("Webcam permission error:", err);
                    setError("Camera access denied. Check browser permissions.");
                }}
                videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "user",
                }}
            />

            <canvas ref={canvasRef} className="tracker-canvas" />
        </div>
    );
};

// -----------------------------
// Main Session
// -----------------------------
function Session() {
    const location = useLocation();
    const navigate = useNavigate();

    const { script, memorizeMode: initialMemorizeMode = false } = location.state || {};
    const [isMemorizeMode, setIsMemorizeMode] = useState(initialMemorizeMode);

    const [fontSize, setFontSize] = useState(24);
    const [alignment, setAlignment] = useState("center");
    const [speed, setSpeed] = useState(0.55);

    const [isRunning, setIsRunning] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [timer, setTimer] = useState(0);

    const [liveWPM, setLiveWPM] = useState(0);
    const [averageWPM, setAverageWPM] = useState(0);
    const [liveFeedback, setLiveFeedback] = useState("");
    const [wordCount, setWordCount] = useState(0);

    const [liveVolume, setLiveVolume] = useState(0);
    const [volumeLabel, setVolumeLabel] = useState("");


    const [isScriptVisible, setIsScriptVisible] = useState(true);



    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const startTimeRef = useRef(null);

    const transcriptRef = useRef("");
    const wordsSpokenRef = useRef([]);
    const lastAnalysisTimeRef = useRef(null);
    const lastWordCountRef = useRef(0);
    const fillerTimelineRef = useRef([]);

    const timerValueRef = useRef(0);
    const averageWPMRef = useRef(0);

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const micStreamRef = useRef(null);
    const volumeRafRef = useRef(null);
    const volumeHistoryRef = useRef([]);
    const hideScriptTimeoutRef = useRef(null);

    useEffect(() => {
        timerValueRef.current = timer;
    }, [timer]);

    useEffect(() => {
        averageWPMRef.current = averageWPM;
    }, [averageWPM]);

    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationRef.current);
            cancelAnimationFrame(volumeRafRef.current);
            clearInterval(timerRef.current);
            clearTimeout(hideScriptTimeoutRef.current);

            try {
                recognitionRef.current?.stop?.();
            } catch (err) {
                console.error("Error stopping recognition:", err);
            }

            try {
                micStreamRef.current?.getTracks()?.forEach((track) => track.stop());
            } catch (err) {
                console.error("Error stopping mic stream:", err);
            }

            try {
                audioContextRef.current?.close?.();
            } catch (err) {
                console.error("Error closing audio context:", err);
            }
        };
    }, []);

    const scriptWordsSet = useMemo(() => {
        if (!script) return new Set();
        const words = script.toLowerCase().match(/\b\w+\b/g) || [];
        return new Set(words);
    }, [script]);

    const effectiveFillerWords = useMemo(() => {
        return ALL_FILLER_WORDS.filter((filler) => {
            const parts = filler.split(" ");
            if (parts.length > 1) {
                return !script?.toLowerCase().includes(filler);
            }
            return !scriptWordsSet.has(filler);
        });
    }, [script, scriptWordsSet]);

    const handleMemorizeModeSpeechActivity = () => {
        if (!isMemorizeMode || !isRunning) return;

        setIsScriptVisible(false);

        clearTimeout(hideScriptTimeoutRef.current);
        hideScriptTimeoutRef.current = setTimeout(() => {
            setIsScriptVisible(true);
        }, 1400);
    };

    const toggleMemorizeMode = () => {
        setIsMemorizeMode((prev) => {
            const next = !prev;

            clearTimeout(hideScriptTimeoutRef.current);
            setIsScriptVisible(true);

            return next;
        });
    };

    const startVolumeTracking = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });

            micStreamRef.current = stream;

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.6;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const smoothingBuffer = [];
            const SMOOTH_WINDOW = 15;

            const pollVolume = () => {
                analyser.getByteFrequencyData(dataArray);

                const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
                const rms = Math.sqrt(sum / dataArray.length);
                const normalized = Math.min(100, Math.round(rms));

                volumeHistoryRef.current.push(normalized);

                smoothingBuffer.push(normalized);
                if (smoothingBuffer.length > SMOOTH_WINDOW) smoothingBuffer.shift();

                const smoothed = Math.round(
                    smoothingBuffer.reduce((acc, val) => acc + val, 0) /
                    smoothingBuffer.length
                );

                setLiveVolume(smoothed);

                const QUIET_THRESHOLD = 35;
                const LOUD_THRESHOLD = 94;

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
        } catch (err) {
            console.warn("Volume analyzer unavailable:", err);
        }
    };

    const stopVolumeTracking = async () => {
        cancelAnimationFrame(volumeRafRef.current);

        try {
            micStreamRef.current?.getTracks()?.forEach((track) => track.stop());
        } catch (err) {
            console.error("Error stopping mic stream:", err);
        }

        try {
            await audioContextRef.current?.close?.();
        } catch (err) {
            console.error("Error closing audio context:", err);
        }

        micStreamRef.current = null;
        audioContextRef.current = null;
        analyserRef.current = null;
    };

    const startSession = async () => {
        if (!script?.trim()) {
            alert("No script provided.");
            return;
        }

        if (!("webkitSpeechRecognition" in window)) {
            alert("Speech Recognition is not supported in this browser.");
            return;
        }

        setTranscript("");
        setTimer(0);
        setLiveWPM(0);
        setAverageWPM(0);
        setLiveFeedback("");
        setWordCount(0);
        setLiveVolume(0);
        setVolumeLabel("");
        setIsScriptVisible(true);

        clearTimeout(hideScriptTimeoutRef.current);

        transcriptRef.current = "";
        wordsSpokenRef.current = [];
        fillerTimelineRef.current = [];
        volumeHistoryRef.current = [];

        lastAnalysisTimeRef.current = Date.now();
        lastWordCountRef.current = 0;
        startTimeRef.current = Date.now();

        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }

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

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let sessionBaseTranscript = "";

        recognition.onstart = () => {
            sessionBaseTranscript = transcriptRef.current;
        };

        recognition.onresult = (event) => {
            let sessionText = "";

            for (let i = 0; i < event.results.length; i += 1) {
                sessionText += `${event.results[i][0].transcript} `;
            }

            const text = `${sessionBaseTranscript}${sessionText}`;
            setTranscript(text);
            transcriptRef.current = text;

            handleMemorizeModeSpeechActivity();

            const currentTranscript = text.trim();
            const wordsArray = currentTranscript.split(/\s+/).filter(Boolean);
            const currentWordCount = wordsArray.length;
            const now = Date.now();
            const secondsElapsed = Math.floor((now - startTimeRef.current) / 1000);

            const newWords = wordsArray.slice(lastWordCountRef.current);

            newWords.forEach((word, newWordIdx) => {
                wordsSpokenRef.current.push({ word, timestamp: now });

                const lowerWord = word.toLowerCase().replace(/[^a-z]/g, "");
                if (effectiveFillerWords.includes(lowerWord)) {
                    const fillerGlobalIdx = lastWordCountRef.current + newWordIdx;
                    const contextStart = Math.max(0, fillerGlobalIdx - 3);
                    const contextEnd = Math.min(wordsArray.length, fillerGlobalIdx + 4);
                    const contextWords = wordsArray.slice(contextStart, contextEnd);
                    const fillerLocalIdx = fillerGlobalIdx - contextStart;

                    contextWords[fillerLocalIdx] = `__${contextWords[fillerLocalIdx]}__`;

                    fillerTimelineRef.current.push({
                        word: lowerWord,
                        secondsElapsed,
                        snippet: contextWords.join(" "),
                    });
                }
            });

            const newChunk = newWords.join(" ").toLowerCase();
            effectiveFillerWords.forEach((filler) => {
                if (filler.includes(" ") && newChunk.includes(filler)) {
                    const phraseLength = filler.split(" ").length;
                    const phraseIdx = wordsArray.findLastIndex((_, i) => {
                        return (
                            wordsArray
                                .slice(i, i + phraseLength)
                                .join(" ")
                                .toLowerCase() === filler
                        );
                    });

                    if (phraseIdx >= 0) {
                        const contextStart = Math.max(0, phraseIdx - 3);
                        const contextEnd = Math.min(
                            wordsArray.length,
                            phraseIdx + phraseLength + 3
                        );

                        fillerTimelineRef.current.push({
                            word: filler,
                            secondsElapsed,
                            isPhrase: true,
                            snippet: wordsArray.slice(contextStart, contextEnd).join(" "),
                        });
                    }
                }
            });

            lastWordCountRef.current = currentWordCount;

            const WINDOW_SIZE_MS = 10000;
            const windowStartTime = now - WINDOW_SIZE_MS;

            const recentWords = wordsSpokenRef.current.filter(
                (entry) => entry.timestamp >= windowStartTime
            );
            wordsSpokenRef.current = recentWords;

            const recentWordCount = recentWords.length;
            const windowDurationSeconds = 10;

            let actualDuration = windowDurationSeconds;
            if (recentWords.length > 0) {
                const oldestTimestamp = recentWords[0].timestamp;
                const elapsed = (now - oldestTimestamp) / 1000;
                if (elapsed < windowDurationSeconds) actualDuration = elapsed || 1;
            }

            const calculatedWPM =
                recentWordCount > 0
                    ? Math.round((recentWordCount / actualDuration) * 60)
                    : 0;

            setLiveWPM(calculatedWPM);
            setWordCount(currentWordCount);

            const sessionElapsedMs = now - lastAnalysisTimeRef.current;
            const sessionElapsedMinutes = sessionElapsedMs / 60000 || 1;
            const avgWPM =
                currentWordCount > 0
                    ? Math.round(currentWordCount / sessionElapsedMinutes)
                    : 0;

            setAverageWPM(avgWPM);

            const IDEAL_MIN_WPM = 90;
            const IDEAL_MAX_WPM = 180;

            if (calculatedWPM < IDEAL_MIN_WPM) {
                setLiveFeedback("Too Slow");
            } else if (calculatedWPM > IDEAL_MAX_WPM) {
                setLiveFeedback("Too Fast");
            } else {
                setLiveFeedback("Good Pace");
            }
        };

        recognition.onend = () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (err) {
                    // silent restart attempt
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === "no-speech" || event.error === "aborted") return;
            console.error("Speech recognition error:", event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;

        timerRef.current = setInterval(() => {
            setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        await startVolumeTracking();
        setIsRunning(true);
    };

    const analyzeSpeech = (finalTranscript, durationSeconds, fillerTimeline) => {
        const cleanTranscript = (finalTranscript || "").trim();
        const wordsArray = cleanTranscript.split(/\s+/).filter(Boolean);
        const totalWords = wordsArray.length;

        const durationMinutes = durationSeconds / 60 || 1;
        const wpm = totalWords > 0 ? Math.round(totalWords / durationMinutes) : 0;

        const IDEAL_MIN_WPM = 120;
        const IDEAL_MAX_WPM = 160;

        const fillerBreakdown = {};
        const lowerTranscript = cleanTranscript.toLowerCase();
        let fillerCount = 0;

        effectiveFillerWords.forEach((word) => {
            const regex = new RegExp(`\\b${word.replace(" ", "\\s+")}\\b`, "g");
            const matches = lowerTranscript.match(regex);
            const count = matches ? matches.length : 0;

            if (count > 0) {
                fillerBreakdown[word] = count;
                fillerCount += count;
            }
        });

        const fillerRate =
            totalWords > 0 ? ((fillerCount / totalWords) * 100).toFixed(1) : 0;

        let fluencyScore = 100 - fillerCount * 3;
        if (fluencyScore < 0) fluencyScore = 0;

        let paceScore = 100;
        if (wpm < IDEAL_MIN_WPM) paceScore -= 15;
        else if (wpm > IDEAL_MAX_WPM) paceScore -= 15;

        let overallScore = Math.round(fluencyScore * 0.6 + paceScore * 0.4);
        if (overallScore < 0) overallScore = 0;
        if (overallScore > 100) overallScore = 100;

        let performanceLevel = "";
        if (overallScore >= 85) performanceLevel = "Excellent";
        else if (overallScore >= 70) performanceLevel = "Good";
        else if (overallScore >= 50) performanceLevel = "Needs Improvement";
        else performanceLevel = "Beginner";

        const feedback = [];

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

        const cleanedTimeline = fillerTimeline.filter((entry) => {
            if (entry.isPhrase) return true;
            return !entry.word.includes(" ");
        });

        return {
            summary: {
                durationSeconds,
                durationFormatted: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60
                    }s`,
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
                excludedFillers: ALL_FILLER_WORDS.filter(
                    (filler) => !effectiveFillerWords.includes(filler)
                ),
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

    const stopSession = async () => {
        cancelAnimationFrame(animationRef.current);
        clearInterval(timerRef.current);
        clearTimeout(hideScriptTimeoutRef.current);

        await stopVolumeTracking();

        setIsRunning(false);
        setIsScriptVisible(true);

        const stoppedRecognition = recognitionRef.current;
        recognitionRef.current = null;

        if (stoppedRecognition) {
            try {
                stoppedRecognition.stop();
            } catch (err) {
                console.error("Error stopping recognition:", err);
            }
        }

        const results = analyzeSpeech(
            transcriptRef.current,
            timerValueRef.current,
            fillerTimelineRef.current
        );

        results.summary.averageWPM = averageWPMRef.current;

        navigate("/dashboard", { state: results });
    };

    const getVolumeIcon = () => {
        if (!volumeLabel) {
            return { icon: "bi-volume-mute-fill", colorClass: "metric-neutral" };
        }
        if (volumeLabel === "Too Quiet") {
            return { icon: "bi-volume-off-fill", colorClass: "metric-warning" };
        }
        if (volumeLabel === "Too Loud") {
            return { icon: "bi-volume-up-fill", colorClass: "metric-danger" };
        }
        return { icon: "bi-volume-down-fill", colorClass: "metric-good" };
    };

    const getFeedbackClass = () => {
        if (liveFeedback === "Good Pace") return "status-good";
        if (liveFeedback === "Too Fast") return "status-danger";
        if (liveFeedback === "Too Slow") return "status-warning";
        return "status-neutral";
    };

    const { icon: volIcon, colorClass: volColorClass } = getVolumeIcon();

    return (
        <div className="session-page">
            <div className="session-bg-glow session-bg-glow-1"></div>
            <div className="session-bg-glow session-bg-glow-2"></div>

            <div className="session-shell">
                <div className="session-header reveal-session">
                    <div className="session-badge">
                        <i className="bi bi-mic-fill"></i>
                        <span>Live Practice Mode</span>
                    </div>

                    <h1 className="session-title">Live Speech Session</h1>

                    <p className="session-subtitle">
                        Practice your delivery in real time with pacing, transcript,
                        volume, and body tracking.
                    </p>
                </div>

                <div className="session-bento">
                    <section className="session-panel controls-panel reveal-session reveal-delay-1">
                        <div className="panel-header">
                            <h5>
                                <i className="bi bi-sliders2"></i>
                                Live Controls
                            </h5>
                        </div>

                        <div className="control-group">
                            <label className="control-label">
                                <span>
                                    <i className="bi bi-fonts"></i>
                                    Font Size
                                </span>
                                <strong>{fontSize}px</strong>
                            </label>
                            <input
                                type="range"
                                className="form-range session-range"
                                min="18"
                                max="48"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                            />
                        </div>

                        <div className="control-group">
                            <label className="control-label">
                                <span>
                                    <i className="bi bi-speedometer2"></i>
                                    Scroll Speed
                                </span>
                                <strong>{speed.toFixed(2)}</strong>
                            </label>
                            <input
                                type="range"
                                className="form-range session-range"
                                min="0.2"
                                max="2"
                                step="0.1"
                                value={speed}
                                onChange={(e) => setSpeed(Number(e.target.value))}
                            />
                        </div>

                        <div className="control-group">
                            <label className="control-label">
                                <span>
                                    <i className="bi bi-text-center"></i>
                                    Alignment
                                </span>
                            </label>

                            <select
                                className="form-select session-select"
                                value={alignment}
                                onChange={(e) => setAlignment(e.target.value)}
                            >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>

                        <div className="session-timer-tile">
                            <div className="timer-icon">
                                <i className="bi bi-clock-history"></i>
                            </div>

                            <div>
                                <small>Session Timer</small>
                                <div>{timer}s</div>
                            </div>
                        </div>

                        <div className="session-action-row">
                            {!isRunning ? (
                                <button className="session-btn start-btn" onClick={startSession}>
                                    <i className="bi bi-play-fill"></i>
                                    <span>Start Session</span>
                                </button>
                            ) : (
                                <button className="session-btn stop-btn" onClick={stopSession}>
                                    <i className="bi bi-stop-fill"></i>
                                    <span>Stop Session</span>
                                </button>
                            )}

                            <div className="session-tooltip-wrap">
                                <button
                                    type="button"
                                    className={`session-btn memorize-btn ${isMemorizeMode ? "active" : ""
                                        }`}
                                    onClick={toggleMemorizeMode}
                                    title="Memorize mode hides the script while you are speaking and shows it again when you are quiet."
                                    aria-label="Toggle memorize mode"
                                >
                                    <i
                                        className={`bi ${isMemorizeMode
                                                ? isScriptVisible
                                                    ? "bi-eye-fill"
                                                    : "bi-eye-slash-fill"
                                                : "bi-journal-check"
                                            }`}
                                    ></i>
                                    <span>Memorize</span>
                                </button>

                                <span className="session-hover-text">
                                    It hides the script while you speak, then shows it again
                                    when you become quiet.
                                </span>
                            </div>
                        </div>
                    </section>

                    <section
                        className={`session-panel analysis-panel ${getFeedbackClass()} reveal-session`}
                    >
                        <div className="panel-header">
                            <h5>
                                <i className="bi bi-activity"></i>
                                Live Speech Analysis
                            </h5>
                        </div>

                        <div className="analysis-grid">
                            <div className="metric-card">
                                <span className="metric-label">Words Spoken</span>
                                <strong className="metric-value">{wordCount}</strong>
                                <small className="metric-sub">Running total</small>
                            </div>

                            <div className="metric-card">
                                <span className="metric-label">Live WPM</span>
                                <strong className="metric-value">{liveWPM}</strong>
                                <small className="metric-sub">Last 10 seconds</small>
                            </div>

                            <div className="metric-card">
                                <span className="metric-label">Average WPM</span>
                                <strong className="metric-value">{averageWPM}</strong>
                                <small className="metric-sub">Whole session</small>
                            </div>

                            <div className="metric-card">
                                <span className="metric-label">Pacing</span>
                                <div className={`metric-pill ${getFeedbackClass()}`}>
                                    {liveFeedback || "Waiting"}
                                </div>
                                <small className="metric-sub">Ideal: 90–160 WPM</small>
                            </div>

                            <div className="metric-card">
                                <span className="metric-label">Volume</span>
                                <div className={`volume-display ${volColorClass}`}>
                                    <i className={`bi ${volIcon}`}></i>
                                    <span>{volumeLabel || "—"}</span>
                                </div>
                                <small className="metric-sub">{liveVolume}/100</small>
                            </div>
                        </div>
                    </section>

                    <section className="session-panel teleprompter-panel reveal-session reveal-delay-1">
                        <div className="panel-header teleprompter-header">
                            <h5>
                                <i className="bi bi-file-earmark-text-fill"></i>
                                Teleprompter
                            </h5>

                            <div className="teleprompter-mini-stats">
                                <span>
                                    <i className="bi bi-type"></i>
                                    {fontSize}px
                                </span>
                                <span>
                                    <i className="bi bi-arrow-down-up"></i>
                                    {speed.toFixed(1)}
                                </span>
                                {isMemorizeMode ? (
                                    <span>
                                        <i
                                            className={`bi ${isScriptVisible
                                                    ? "bi-eye-fill"
                                                    : "bi-eye-slash-fill"
                                                }`}
                                        ></i>
                                        {isScriptVisible ? "Visible" : "Hidden"}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div
                            ref={scrollRef}
                            className={`teleprompter-body ${isMemorizeMode && !isScriptVisible ? "teleprompter-hidden" : ""
                                }`}
                            style={{
                                fontSize: `${fontSize}px`,
                                textAlign: alignment,
                            }}
                        >
                            <div className="teleprompter-content">
                                {isMemorizeMode && !isScriptVisible
                                    ? "Memorize mode is active. Keep speaking from memory."
                                    : script || "No script loaded."}
                            </div>
                        </div>
                    </section>

                    <section className="session-panel tracker-panel reveal-session reveal-delay-2">
                        <div className="panel-header">
                            <h5>
                                <i className="bi bi-camera-video-fill"></i>
                                Webcam Feed
                            </h5>
                        </div>
                        <HandTracker />
                    </section>

                    <section className="session-panel transcript-panel reveal-session reveal-delay-2">
                        <div className="panel-header">
                            <h5>
                                <i className="bi bi-chat-dots-fill"></i>
                                Live Transcript
                            </h5>
                        </div>

                        <div className="transcript-body">
                            {transcript ? (
                                <p>{transcript}</p>
                            ) : (
                                <p className="transcript-placeholder">
                                    Your live transcript will appear here once the session starts.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default Session;