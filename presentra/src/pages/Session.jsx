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

// --- HOLISTIC TRACKER COMPONENT (Hands + Body + Face) ---
const HandTracker = ({ onTrackingUpdate, onCleanup }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [error, setError] = useState(null);
    const holisticRef = useRef(null);
    const cameraRef = useRef(null);
    
    // Track hand positions for movement detection
    const handPosRef = useRef({
        leftHand: { x: null, y: null, orientation: null, fingerSpread: null },
        rightHand: { x: null, y: null, orientation: null, fingerSpread: null }
    });
    
    // Gesture state for landmark smoothing (reduce bouncy detection)
    const gestureStateRef = useRef({
        // Mouth smoothing values (for reducing bouncy landmarks)
        mouthOpenness: null,
        mouthWidth: null,
        mouthCornerRise: null,
    });

    // Comprehensive facial reference points based on MediaPipe standards
    const FACIAL_REFERENCE_POINTS = {
        // Mouth reference points
        mouth: {
            // Corners (61, 291), top (13), bottom (14)
            // For smile: corners rise, mouth opens slightly
            smileCornerRise: 0.008, // LOWERED from 0.015 - detect subtle smiles
            smileMouthOpen: { min: 0.01, max: 0.12 }, // WIDENED from 0.02-0.08 - detect more natural smiles
            smileMouthWidth: 0.10, // LOWERED from 0.15 - detect smaller smiles
            
            // For frown: corners drop, mouth slightly open
            frownCornerDrop: -0.008, // LOWERED from -0.015 - detect subtle frowns
            frownMouthOpen: { min: 0.005, max: 0.10 }, // WIDENED from 0.01-0.06
            
            // For neutral: closed mouth, no corner movement
            neutralMouthOpen: { max: 0.02 },
        },

        // Eyebrow reference points
        eyebrows: {
            // Inner points (105 left, 334 right), outer points (107 left, 336 right)
            // For angry/mad: eyebrows down, angled inward
            madAngleRange: { min: -60, max: 10 }, // WIDENED from -70 to 0 - easier to detect
            madDistance: 0.25, // RELAXED from 0.2 - allow slightly more distance
            madEyebrowDrop: 0.02, // Drop below reference height
            
            // For normal: eyebrows relatively straight
            normalAngleRange: { min: -10, max: 10 },
            normalDistance: 0.25, // Normal spacing
        },

        // Eye reference points
        eyes: {
            // Iris centers (468 left, 473 right)
            // For eye contact: both irises centered horizontally in face
            eyeContactCenterX: 0.5, // Face center
            eyeContactThreshold: 0.08, // ±8% tolerance (STRICTER - was 0.2)
            
            // Eye width landmarks (33, 362 outer; 133, 263 inner)
            eyeOpenness: { min: 0.08, max: 0.4 }, // Eye height range
            eyeSymmetry: 0.05, // Max difference between left and right (STRICTER - was 0.1)
            
            // For looking left/right, eyes move horizontally
            eyeLookLeftThreshold: 0.40, // Left iris X position (ADJUSTED from 0.35)
            eyeLookRightThreshold: 0.60, // Right iris X position (ADJUSTED from 0.65)
        }
    };

    // Detect eye contact and gaze direction with reference points
    const detectEyeContactAdvanced = (faceLandmarks) => {
        if (!faceLandmarks || faceLandmarks.length < 478) return { contact: false, gaze: "center" };

        // Get iris centers
        const leftIrisCenter = faceLandmarks[468];
        const rightIrisCenter = faceLandmarks[473];

        if (!leftIrisCenter || !rightIrisCenter) return { contact: false, gaze: "center" };

        // Calculate eye openness (distance between top and bottom)
        const leftEyeTop = faceLandmarks[159];
        const leftEyeBottom = faceLandmarks[145];
        const rightEyeTop = faceLandmarks[386];
        const rightEyeBottom = faceLandmarks[374];

        let leftEyeOpen = 0.15;
        let rightEyeOpen = 0.15;
        
        if (leftEyeTop && leftEyeBottom) {
            leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
        }
        if (rightEyeTop && rightEyeBottom) {
            rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);
        }

        // Check if eyes are open (within normal range)
        const eyesOpen = 
            leftEyeOpen > FACIAL_REFERENCE_POINTS.eyes.eyeOpenness.min &&
            leftEyeOpen < FACIAL_REFERENCE_POINTS.eyes.eyeOpenness.max &&
            rightEyeOpen > FACIAL_REFERENCE_POINTS.eyes.eyeOpenness.min &&
            rightEyeOpen < FACIAL_REFERENCE_POINTS.eyes.eyeOpenness.max;

        // Calculate iris centers
        const leftIrisX = leftIrisCenter.x;
        const rightIrisX = rightIrisCenter.x;
        const avgIrisX = (leftIrisX + rightIrisX) / 2;

        // Check eye contact (both irises centered)
        const eyeContactThreshold = FACIAL_REFERENCE_POINTS.eyes.eyeContactThreshold;
        const eyeCenterMin = FACIAL_REFERENCE_POINTS.eyes.eyeContactCenterX - eyeContactThreshold;
        const eyeCenterMax = FACIAL_REFERENCE_POINTS.eyes.eyeContactCenterX + eyeContactThreshold;

        const hasEyeContact = 
            avgIrisX > eyeCenterMin && avgIrisX < eyeCenterMax &&
            Math.abs(leftIrisX - rightIrisX) < FACIAL_REFERENCE_POINTS.eyes.eyeSymmetry &&
            eyesOpen;

        // Determine gaze direction if no eye contact
        let gaze = "center";
        if (!hasEyeContact) {
            if (avgIrisX < FACIAL_REFERENCE_POINTS.eyes.eyeLookLeftThreshold) {
                gaze = "left";
            } else if (avgIrisX > FACIAL_REFERENCE_POINTS.eyes.eyeLookRightThreshold) {
                gaze = "right";
            } else {
                gaze = "away";
            }
        }

        console.log("👁️ Eye analysis:", { 
            leftIrisX: leftIrisX.toFixed(3), 
            rightIrisX: rightIrisX.toFixed(3), 
            avgIrisX: avgIrisX.toFixed(3),
            leftEyeOpen: leftEyeOpen.toFixed(3),
            rightEyeOpen: rightEyeOpen.toFixed(3),
            eyeContact: hasEyeContact,
            gaze: gaze,
            eyesOpen: eyesOpen
        });

        return { contact: hasEyeContact, gaze: gaze };
    };

    // Detect mouth movement and expression with reference points
    const detectMouthExpression = (faceLandmarks) => {
        if (!faceLandmarks || faceLandmarks.length < 478) return "neutral";

        // Get mouth landmarks
        const mouthTop = faceLandmarks[13];
        const mouthBottom = faceLandmarks[14];
        const mouthLeft = faceLandmarks[61];
        const mouthRight = faceLandmarks[291];

        if (!mouthTop || !mouthBottom || !mouthLeft || !mouthRight) return "neutral";

        // Calculate metrics
        const mouthOpenness = Math.abs(mouthBottom.y - mouthTop.y);
        const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
        const centerMouthY = (mouthTop.y + mouthBottom.y) / 2;
        
        // Corner heights relative to center
        const leftCornerRise = centerMouthY - mouthLeft.y; // Positive = raised
        const rightCornerRise = centerMouthY - mouthRight.y;
        const avgCornerRise = (leftCornerRise + rightCornerRise) / 2;

        // Apply exponential smoothing to reduce bouncy landmarks
        // Store smoothed values in gestureStateRef for persistence across frames
        let smoothedOpenness = mouthOpenness;
        let smoothedWidth = mouthWidth;
        let smoothedRise = avgCornerRise;
        
        const alpha = 0.3; // 30% new value, 70% old smoothed value (stable)
        
        if (gestureStateRef.current.mouthOpenness !== null) {
            smoothedOpenness = alpha * mouthOpenness + (1 - alpha) * gestureStateRef.current.mouthOpenness;
            smoothedWidth = alpha * mouthWidth + (1 - alpha) * gestureStateRef.current.mouthWidth;
            smoothedRise = alpha * avgCornerRise + (1 - alpha) * gestureStateRef.current.mouthCornerRise;
        }
        
        // Store smoothed values for next frame
        gestureStateRef.current.mouthOpenness = smoothedOpenness;
        gestureStateRef.current.mouthWidth = smoothedWidth;
        gestureStateRef.current.mouthCornerRise = smoothedRise;

        // Compare against reference points using SMOOTHED values
        const refs = FACIAL_REFERENCE_POINTS.mouth;

        // SMILE detection - using smoothed values reduces flicker
        if (smoothedOpenness >= refs.smileMouthOpen.min &&
            smoothedOpenness <= refs.smileMouthOpen.max &&
            smoothedWidth >= refs.smileMouthWidth &&
            smoothedRise > refs.smileCornerRise) {
            console.log("✓ SMILE (smoothed):", { openness: smoothedOpenness.toFixed(3), width: smoothedWidth.toFixed(3), rise: smoothedRise.toFixed(3) });
            return "smile";
        }

        // FROWN detection - using smoothed values
        if (smoothedOpenness >= refs.frownMouthOpen.min &&
            smoothedOpenness <= refs.frownMouthOpen.max &&
            smoothedRise < refs.frownCornerDrop) {
            console.log("✓ FROWN (smoothed):", { openness: smoothedOpenness.toFixed(3), drop: smoothedRise.toFixed(3) });
            return "frown";
        }

        console.log("Mouth metrics (smoothed):", { openness: smoothedOpenness.toFixed(3), width: smoothedWidth.toFixed(3), rise: smoothedRise.toFixed(3) });
        return "neutral";
    };

    // Detect eyebrow expression with reference points
    const detectEyebrowExpression = (faceLandmarks) => {
        if (!faceLandmarks || faceLandmarks.length < 478) return "normal";

        const leftEyebrowInner = faceLandmarks[105];
        const leftEyebrowOuter = faceLandmarks[107];
        const rightEyebrowInner = faceLandmarks[334];
        const rightEyebrowOuter = faceLandmarks[336];

        if (!leftEyebrowInner || !leftEyebrowOuter || !rightEyebrowInner || !rightEyebrowOuter) {
            return "normal";
        }

        // Calculate eyebrow angles
        const leftEyebrowAngle = Math.atan2(
            leftEyebrowOuter.y - leftEyebrowInner.y,
            leftEyebrowOuter.x - leftEyebrowInner.x
        ) * (180 / Math.PI);

        const rightEyebrowAngle = Math.atan2(
            rightEyebrowInner.y - rightEyebrowOuter.y,
            rightEyebrowInner.x - rightEyebrowOuter.x
        ) * (180 / Math.PI);

        // Calculate eyebrow distance (inner points)
        const eyebrowDistance = Math.abs(leftEyebrowInner.x - rightEyebrowInner.x);

        const refs = FACIAL_REFERENCE_POINTS.eyebrows;

        // MAD/ANGRY detection
        const leftSlanted = leftEyebrowAngle >= refs.madAngleRange.min && leftEyebrowAngle <= refs.madAngleRange.max;
        const rightSlanted = rightEyebrowAngle >= refs.madAngleRange.min && rightEyebrowAngle <= refs.madAngleRange.max;
        const eyebrowsClose = eyebrowDistance < refs.madDistance;

        if (leftSlanted && rightSlanted && eyebrowsClose) {
            console.log("✓ MAD:", { leftAngle: leftEyebrowAngle.toFixed(1), rightAngle: rightEyebrowAngle.toFixed(1), distance: eyebrowDistance.toFixed(3) });
            return "mad";
        }

        console.log("Eyebrow metrics:", { leftAngle: leftEyebrowAngle.toFixed(1), rightAngle: rightEyebrowAngle.toFixed(1), distance: eyebrowDistance.toFixed(3) });
        return "normal";
    };

    // Reference points for hand gesture detection
    const HAND_GESTURE_REFERENCES = {
        openHand: {
            // Open hand: fingers spread far apart
            fingerSpreadMin: 0.35, // INCREASED from 0.25 - LESS SENSITIVE
            description: "Open Hand"
        },
        closeHand: {
            // Closed hand: fingers close together
            fingerSpreadMax: 0.05, // DECREASED from 0.08 - LESS SENSITIVE
            description: "Close Hand"
        },
        sidewaysRight: {
            // Sideways right: hand rotated with index finger pointing right
            palmAngleMin: 30,
            palmAngleMax: 150,
            description: "Sideways Right"
        },
        sidewaysLeft: {
            // Sideways left: hand rotated with index finger pointing left
            palmAngleMin: -150,
            palmAngleMax: -30,
            description: "Sideways Left"
        }
    };

    // Detect hand movement with reference points
    const detectHandMovement = (handLandmarks, lastHandPos) => {
        if (!handLandmarks || handLandmarks.length < 21) return null;

        const wrist = handLandmarks[0];
        if (!wrist || wrist.visibility < 0.3) return null;

        let movement = null;

        // Initialize position on first detection
        if (lastHandPos.x === null || lastHandPos.y === null) {
            lastHandPos.x = wrist.x;
            lastHandPos.y = wrist.y;
            lastHandPos.fingerSpread = null;
            lastHandPos.palmAngle = null;
            lastHandPos.smoothedFingerSpread = null;
            lastHandPos.closeHandFrameCounter = 0;
            return null;
        }

        // Check movement - compare with last position
        const deltaX = wrist.x - lastHandPos.x;
        const deltaY = wrist.y - lastHandPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Register movement if significant (>0.05 units) - LESS SENSITIVE
        if (distance > 0.05) {
            movement = "handMoved";
        }

        // Check if hand is opening or closing based on finger spread
        const thumb = handLandmarks[4];
        const pinky = handLandmarks[20];
        const indexFinger = handLandmarks[8];
        const middleFinger = handLandmarks[12];

        if (thumb && pinky && thumb.visibility > 0.3 && pinky.visibility > 0.3) {
            const fingerSpread = Math.abs(thumb.x - pinky.x);
            
            // Apply exponential moving average smoothing to stabilize bouncy landmarks
            // alpha = 0.4 means: 40% new value, 60% old value (more stable, less bouncy)
            let smoothedSpread = fingerSpread;
            if (lastHandPos.smoothedFingerSpread !== null) {
                smoothedSpread = 0.4 * fingerSpread + 0.6 * lastHandPos.smoothedFingerSpread;
            }
            lastHandPos.smoothedFingerSpread = smoothedSpread;
            
            // Store both raw and smoothed for debugging
            lastHandPos.currentFingerSpread = fingerSpread;
            lastHandPos.debugSmoothedSpread = smoothedSpread;

            // Initialize finger spread on first detection
            if (lastHandPos.fingerSpread === null) {
                lastHandPos.fingerSpread = fingerSpread;
                lastHandPos.smoothedFingerSpread = fingerSpread;
                lastHandPos.closeHandFrameCounter = 0;
            } else {
                // Check against reference points using SMOOTHED values
                // Open Hand: smoothed spread >= 0.35 units
                if (smoothedSpread >= HAND_GESTURE_REFERENCES.openHand.fingerSpreadMin) {
                    movement = "openHand";
                    lastHandPos.fingerSpread = smoothedSpread;
                    lastHandPos.closeHandFrameCounter = 0; // Reset closed hand counter
                    console.log(`✋ OPEN HAND - Smoothed: ${smoothedSpread.toFixed(3)}, Raw: ${fingerSpread.toFixed(3)}`);
                }
                // Close Hand: smoothed spread <= 0.05 units
                // Require 3 consecutive frames of low spread to confirm closed hand (prevents bouncing)
                else if (smoothedSpread <= 0.05) {
                    lastHandPos.closeHandFrameCounter += 1;
                    
                    // Only count as closed hand after 3 stable frames
                    if (lastHandPos.closeHandFrameCounter >= 3) {
                        movement = "closeHand";
                        lastHandPos.fingerSpread = smoothedSpread;
                        console.log(`✋ CLOSED HAND DETECTED - Smoothed: ${smoothedSpread.toFixed(3)}, Raw: ${fingerSpread.toFixed(3)}, Frames: ${lastHandPos.closeHandFrameCounter}`);
                    }
                }
                // Reset counter if spreading beyond 0.08 threshold
                else if (smoothedSpread > 0.08) {
                    lastHandPos.closeHandFrameCounter = 0;
                }
            }
        }

        // Detect sideways hand orientation
        if (indexFinger && middleFinger && indexFinger.visibility > 0.3 && middleFinger.visibility > 0.3) {
            // Calculate palm angle (angle of index finger to middle finger)
            const palmAngle = Math.atan2(
                middleFinger.y - indexFinger.y,
                middleFinger.x - indexFinger.x
            ) * (180 / Math.PI);

            lastHandPos.currentPalmAngle = palmAngle;

            if (lastHandPos.palmAngle === null) {
                lastHandPos.palmAngle = palmAngle;
            } else {
                // Sideways Right: palm facing right (angle between 30-150 degrees)
                if (palmAngle > 30 && palmAngle < 150) {
                    movement = "sidewaysRight";
                    lastHandPos.palmAngle = palmAngle;
                }
                // Sideways Left: palm facing left (angle between -150 to -30 degrees)
                else if (palmAngle < -30 && palmAngle > -150) {
                    movement = "sidewaysLeft";
                    lastHandPos.palmAngle = palmAngle;
                }
            }
        }

        // Update position for next frame
        lastHandPos.x = wrist.x;
        lastHandPos.y = wrist.y;

        return movement;
    };

    // Detect eye contact (looking at camera) - IMPROVED with iris tracking
    const detectEyeContact = (faceLandmarks) => {
        const result = detectEyeContactAdvanced(faceLandmarks);
        return result.contact;
    };

    // Cleanup function that can be called from parent
    const cleanupCamera = async () => {
        console.log("Cleaning up camera and holistic from stopSession...");
        
        // IMPORTANT: Stop camera FIRST before closing holistic
        // This prevents "Cannot pass deleted object" error
        
        // Stop webcam tracks
        if (webcamRef.current?.video?.srcObject) {
            try {
                const tracks = webcamRef.current.video.srcObject.getTracks();
                tracks.forEach(track => {
                    track.stop();
                    console.log("Webcam track stopped");
                });
            } catch (err) {
                console.error("Error stopping webcam tracks:", err);
            }
        }

        // Stop camera BEFORE closing holistic
        if (cameraRef.current) {
            try {
                cameraRef.current.stop?.();
                console.log("Camera stopped");
            } catch (err) {
                console.error("Error stopping camera:", err);
            }
        }

        // Add small delay to ensure camera has stopped
        await new Promise(resolve => setTimeout(resolve, 100));

        // THEN close holistic (after camera has stopped sending frames)
        if (holisticRef.current) {
            try {
                holisticRef.current.close?.();
                console.log("Holistic closed");
                holisticRef.current = null;
            } catch (err) {
                console.error("Error closing holistic:", err);
            }
        }
    };

    // Expose cleanup function to parent component
    useEffect(() => {
        if (onCleanup) {
            onCleanup(cleanupCamera);
        }
    }, [onCleanup]);

    // Cleanup on unmount - CRITICAL: This runs when user leaves the page
    useEffect(() => {
        // Capture refs at mount time to avoid stale references
        const camera = cameraRef.current;
        const holistic = holisticRef.current;
        const webcam = webcamRef.current;

        return () => {
            console.log("🛑 CLEANUP TRIGGERED: User left the page - Stopping all tracking...");
            
            // STOP EVERYTHING IMMEDIATELY
            try {
                // Stop webcam tracks FIRST
                if (webcam?.video?.srcObject) {
                    try {
                        const tracks = webcam.video.srcObject.getTracks();
                        tracks.forEach(track => {
                            track.stop();
                            console.log("✅ Webcam track stopped");
                        });
                    } catch (err) {
                        console.error("❌ Error stopping webcam tracks:", err);
                    }
                }

                // Stop camera
                if (camera) {
                    try {
                        camera.stop?.();
                        console.log("✅ Camera stopped");
                    } catch (err) {
                        console.error("❌ Error stopping camera:", err);
                    }
                }

                // Close holistic
                if (holistic) {
                    try {
                        holistic.close?.();
                        console.log("✅ Holistic closed");
                    } catch (err) {
                        console.error("❌ Error closing holistic:", err);
                    }
                }
                
                // Force nullify refs
                cameraRef.current = null;
                holisticRef.current = null;
                
                console.log("✅ CLEANUP COMPLETE - All resources released");
            } catch (err) {
                console.error("❌ Critical error during cleanup:", err);
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

                // Detect facial expression using new methods
                const mouthExpression = detectMouthExpression(results.faceLandmarks);
                const eyebrowExpression = detectEyebrowExpression(results.faceLandmarks);
                
                // Combine for final expression
                let facialExpression = "neutral";
                if (eyebrowExpression === "mad") {
                    facialExpression = "mad";
                } else if (mouthExpression === "smile") {
                    facialExpression = "smile";
                } else if (mouthExpression === "frown") {
                    facialExpression = "frown";
                }
                
                // Detect eye contact
                const hasEyeContact = detectEyeContact(results.faceLandmarks);

                // Detect hand movements and orientations
                let leftMovement = null;
                let rightMovement = null;
                if (results.leftHandLandmarks) {
                    leftMovement = detectHandMovement(results.leftHandLandmarks, handPosRef.current.leftHand);
                }
                if (results.rightHandLandmarks) {
                    rightMovement = detectHandMovement(results.rightHandLandmarks, handPosRef.current.rightHand);
                }

                // Update tracking data
                if (onTrackingUpdate) {
                    onTrackingUpdate({
                        facialExpression,
                        eyeContact: hasEyeContact,
                        leftHandMovement: leftMovement,
                        rightHandMovement: rightMovement
                    });
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
                    
                    // Draw reference points for left hand
                    const leftThumb = results.leftHandLandmarks[4];
                    const leftPinky = results.leftHandLandmarks[20];
                    const leftIndex = results.leftHandLandmarks[8];
                    const leftMiddle = results.leftHandLandmarks[12];
                    
                    if (leftThumb && leftPinky) {
                        const leftFingerSpread = Math.abs(leftThumb.x - leftPinky.x);
                        
                        // Draw current spread indicator
                        canvasCtx.fillStyle = "#FFFF00";
                        canvasCtx.font = "12px Arial";
                        canvasCtx.fillText(`L-Spread: ${leftFingerSpread.toFixed(2)}`, 10, 20);
                        
                        // Visual reference - Open Hand zone (green)
                        if (leftFingerSpread >= HAND_GESTURE_REFERENCES.openHand.fingerSpreadMin) {
                            canvasCtx.fillStyle = "rgba(0, 255, 0, 0.2)";
                            canvasCtx.fillRect(10, 30, 140, 15);
                            canvasCtx.fillStyle = "#00FF00";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("OPEN HAND", 20, 41);
                        }
                        // Visual reference - Close Hand zone (red)
                        else if (leftFingerSpread <= HAND_GESTURE_REFERENCES.closeHand.fingerSpreadMax) {
                            canvasCtx.fillStyle = "rgba(255, 0, 0, 0.2)";
                            canvasCtx.fillRect(10, 30, 140, 15);
                            canvasCtx.fillStyle = "#FF0000";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("CLOSE HAND", 20, 41);
                        }
                    }
                    
                    // Draw sideways reference
                    if (leftIndex && leftMiddle) {
                        const palmAngle = Math.atan2(
                            leftMiddle.y - leftIndex.y,
                            leftMiddle.x - leftIndex.x
                        ) * (180 / Math.PI);
                        
                        canvasCtx.fillStyle = "#FFFF00";
                        canvasCtx.font = "12px Arial";
                        canvasCtx.fillText(`L-Angle: ${palmAngle.toFixed(0)}°`, 10, 55);
                        
                        // Sideways Right
                        if (palmAngle > 30 && palmAngle < 150) {
                            canvasCtx.fillStyle = "rgba(255, 165, 0, 0.2)";
                            canvasCtx.fillRect(10, 60, 140, 15);
                            canvasCtx.fillStyle = "#FFA500";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("SIDEWAYS RIGHT", 15, 71);
                        }
                        // Sideways Left
                        else if (palmAngle < -30 && palmAngle > -150) {
                            canvasCtx.fillStyle = "rgba(128, 0, 128, 0.2)";
                            canvasCtx.fillRect(10, 60, 140, 15);
                            canvasCtx.fillStyle = "#800080";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("SIDEWAYS LEFT", 20, 71);
                        }
                    }
                }

                // Draw Right Hand
                if (results.rightHandLandmarks) {
                    drawManualConnections(results.rightHandLandmarks, HAND_CONNECTIONS, "#00FF00", 2);
                    drawManualLandmarks(results.rightHandLandmarks, "#FF0000", 3);
                    
                    // Draw reference points for right hand
                    const rightThumb = results.rightHandLandmarks[4];
                    const rightPinky = results.rightHandLandmarks[20];
                    const rightIndex = results.rightHandLandmarks[8];
                    const rightMiddle = results.rightHandLandmarks[12];
                    
                    if (rightThumb && rightPinky) {
                        const rightFingerSpread = Math.abs(rightThumb.x - rightPinky.x);
                        
                        // Draw current spread indicator
                        canvasCtx.fillStyle = "#FFFF00";
                        canvasCtx.font = "12px Arial";
                        canvasCtx.fillText(`R-Spread: ${rightFingerSpread.toFixed(2)}`, videoWidth - 170, 20);
                        
                        // Visual reference - Open Hand zone (green)
                        if (rightFingerSpread >= HAND_GESTURE_REFERENCES.openHand.fingerSpreadMin) {
                            canvasCtx.fillStyle = "rgba(0, 255, 0, 0.2)";
                            canvasCtx.fillRect(videoWidth - 170, 30, 160, 15);
                            canvasCtx.fillStyle = "#00FF00";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("OPEN HAND", videoWidth - 150, 41);
                        }
                        // Visual reference - Close Hand zone (red)
                        else if (rightFingerSpread <= HAND_GESTURE_REFERENCES.closeHand.fingerSpreadMax) {
                            canvasCtx.fillStyle = "rgba(255, 0, 0, 0.2)";
                            canvasCtx.fillRect(videoWidth - 170, 30, 160, 15);
                            canvasCtx.fillStyle = "#FF0000";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("CLOSE HAND", videoWidth - 150, 41);
                        }
                    }
                    
                    // Draw sideways reference
                    if (rightIndex && rightMiddle) {
                        const palmAngle = Math.atan2(
                            rightMiddle.y - rightIndex.y,
                            rightMiddle.x - rightIndex.x
                        ) * (180 / Math.PI);
                        
                        canvasCtx.fillStyle = "#FFFF00";
                        canvasCtx.font = "12px Arial";
                        canvasCtx.fillText(`R-Angle: ${palmAngle.toFixed(0)}°`, videoWidth - 170, 55);
                        
                        // Sideways Right
                        if (palmAngle > 30 && palmAngle < 150) {
                            canvasCtx.fillStyle = "rgba(255, 165, 0, 0.2)";
                            canvasCtx.fillRect(videoWidth - 170, 60, 160, 15);
                            canvasCtx.fillStyle = "#FFA500";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("SIDEWAYS RIGHT", videoWidth - 155, 71);
                        }
                        // Sideways Left
                        else if (palmAngle < -30 && palmAngle > -150) {
                            canvasCtx.fillStyle = "rgba(128, 0, 128, 0.2)";
                            canvasCtx.fillRect(videoWidth - 170, 60, 160, 15);
                            canvasCtx.fillStyle = "#800080";
                            canvasCtx.font = "11px Arial";
                            canvasCtx.fillText("SIDEWAYS LEFT", videoWidth - 150, 71);
                        }
                    }
                }

                // Draw Face with expression and eye tracking
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

                    // Detect and display comprehensive facial analysis
                    const mouthExpr = detectMouthExpression(faceLandmarks);
                    const eyebrowExpr = detectEyebrowExpression(faceLandmarks);
                    const eyeAnalysis = detectEyeContactAdvanced(faceLandmarks);

                    // Combine expressions for final result
                    let finalExpression = "neutral";
                    if (eyebrowExpr === "mad") {
                        finalExpression = "mad";
                    } else if (mouthExpr === "smile") {
                        finalExpression = "smile";
                    } else if (mouthExpr === "frown") {
                        finalExpression = "frown";
                    }

                    // Display expression with color coding
                    let expressionColor = "#FFFF00";
                    if (finalExpression === "smile") expressionColor = "#00FF00";
                    else if (finalExpression === "frown") expressionColor = "#FF6600";
                    else if (finalExpression === "mad") expressionColor = "#FF0000";

                    canvasCtx.fillStyle = expressionColor;
                    canvasCtx.font = "bold 16px Arial";
                    canvasCtx.fillText(`😊 Expression: ${finalExpression.toUpperCase()}`, 10, videoHeight - 60);

                    // Display eye contact and gaze direction
                    canvasCtx.font = "bold 16px Arial";
                    if (eyeAnalysis.contact) {
                        canvasCtx.fillStyle = "#00FF00";
                        canvasCtx.fillText("👁️ EYE CONTACT: YES", 10, videoHeight - 40);
                    } else {
                        canvasCtx.fillStyle = "#FF6600";
                        canvasCtx.fillText(`👁️ LOOKING: ${eyeAnalysis.gaze.toUpperCase()}`, 10, videoHeight - 40);
                    }

                    // Display mouth openness indicator
                    const mouthTop = faceLandmarks[13];
                    const mouthBottom = faceLandmarks[14];
                    if (mouthTop && mouthBottom) {
                        const mouthOpenness = Math.abs(mouthBottom.y - mouthTop.y);
                        canvasCtx.fillStyle = "#CCFFCC";
                        canvasCtx.font = "12px Arial";
                        canvasCtx.fillText(`Mouth: ${(mouthOpenness * 100).toFixed(1)}%`, 10, videoHeight - 20);
                    }

                    // Hide iris centers, mouth points, eyebrow points - user only visible
                    // All detection still works, just not displayed

                    // // Draw iris centers for eye tracking visualization (HIDDEN)
                    // const leftIrisCenter = faceLandmarks[468];
                    // const rightIrisCenter = faceLandmarks[473];
                    // 
                    // if (leftIrisCenter && rightIrisCenter) {
                    //     // Draw iris circles (HIDDEN)
                    //     // Draw center reference line (HIDDEN)
                    // }

                    // // Draw mouth reference points (HIDDEN)
                    // const mouthLeft = faceLandmarks[61];
                    // const mouthRight = faceLandmarks[291];

                    // // Draw eyebrow inner points for mad detection (HIDDEN)
                    // const leftEyebrowInner = faceLandmarks[105];
                    // const rightEyebrowInner = faceLandmarks[334];
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
                mirrored={false} 
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
                    height: "100%"
                }} 
            />
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

    // Hand gesture tracking
    const [handMovementsCount, setHandMovementsCount] = useState(0);

    const [isScriptVisible, setIsScriptVisible] = useState(true);



    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const startTimeRef = useRef(null);
    const cameraCleanupRef = useRef(null); // Camera cleanup callback from HandTracker

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

    // Gesture tracking refs to prevent duplicate counting
    const lastLeftMovementRef = useRef(null);
    const lastRightMovementRef = useRef(null);
    const leftMovementFrameCountRef = useRef(0);
    const rightMovementFrameCountRef = useRef(0);

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
            // NEW: Direct toggle visibility on button press
            setIsScriptVisible(next ? false : true);  // Hide if memorize ON, show if OFF
            clearTimeout(hideScriptTimeoutRef.current);
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

    // Handle tracking updates from HandTracker component
    const handleTrackingUpdate = (trackingData) => {
        const { leftHandMovement, rightHandMovement } = trackingData;

        // Process LEFT HAND movement with debouncing (require 2 consecutive frames)
        if (leftHandMovement && leftHandMovement !== lastLeftMovementRef.current) {
            leftMovementFrameCountRef.current += 1;
            console.log(`🟢 LEFT GESTURE: ${leftHandMovement} (frame ${leftMovementFrameCountRef.current})`);

            if (leftMovementFrameCountRef.current >= 2) {
                // Gesture confirmed - increment counter
                setHandMovementsCount(prev => {
                    const newCount = prev + 1;
                    console.log(`✅ LEFT GESTURE COUNTED: Total = ${newCount}`);
                    return newCount;
                });
                lastLeftMovementRef.current = leftHandMovement;
                leftMovementFrameCountRef.current = 0; // Reset counter
            }
        } else if (!leftHandMovement) {
            // Reset frame counter when no movement
            leftMovementFrameCountRef.current = 0;
            lastLeftMovementRef.current = null;
        }

        // Process RIGHT HAND movement with debouncing (require 2 consecutive frames)
        if (rightHandMovement && rightHandMovement !== lastRightMovementRef.current) {
            rightMovementFrameCountRef.current += 1;
            console.log(`🔵 RIGHT GESTURE: ${rightHandMovement} (frame ${rightMovementFrameCountRef.current})`);

            if (rightMovementFrameCountRef.current >= 2) {
                // Gesture confirmed - increment counter
                setHandMovementsCount(prev => {
                    const newCount = prev + 1;
                    console.log(`✅ RIGHT GESTURE COUNTED: Total = ${newCount}`);
                    return newCount;
                });
                lastRightMovementRef.current = rightHandMovement;
                rightMovementFrameCountRef.current = 0; // Reset counter
            }
        } else if (!rightHandMovement) {
            // Reset frame counter when no movement
            rightMovementFrameCountRef.current = 0;
            lastRightMovementRef.current = null;
        }
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
        setHandMovementsCount(0); // Reset hand movement counter
        setIsScriptVisible(true);

        clearTimeout(hideScriptTimeoutRef.current);

        transcriptRef.current = "";
        wordsSpokenRef.current = [];
        fillerTimelineRef.current = [];
        volumeHistoryRef.current = [];

        lastAnalysisTimeRef.current = Date.now();
        lastWordCountRef.current = 0;
        startTimeRef.current = Date.now();

        // Reset gesture tracking
        lastLeftMovementRef.current = null;
        lastRightMovementRef.current = null;
        leftMovementFrameCountRef.current = 0;
        rightMovementFrameCountRef.current = 0;

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
            console.log("🎤 Speech Recognition STARTED - Listening now");
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

        // START RECOGNITION IMMEDIATELY - NO DELAY
        console.log("🎤 Starting speech recognition immediately...");
        recognition.start();
        recognitionRef.current = recognition;
        
        // Ensure it starts right away by checking after short delay
        setTimeout(() => {
            if (recognitionRef.current) {
                console.log("✅ Speech recognition confirmed active");
            }
        }, 100);

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
        // Stop animation frames and timers
        cancelAnimationFrame(animationRef.current);
        clearInterval(timerRef.current);
        clearTimeout(hideScriptTimeoutRef.current);

        // Call camera cleanup from HandTracker and wait for it to complete
        if (cameraCleanupRef.current) {
            await cameraCleanupRef.current();
        }

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
        results.summary.handMovementsCount = handMovementsCount; // Add hand movements to results

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

                            <div className="metric-card">
                                <span className="metric-label">
                                    <i className="bi bi-hand-thumbs-up"></i> Hand Movements
                                </span>
                                <strong className="metric-value">{handMovementsCount}</strong>
                                <small className="metric-sub">Gestures detected</small>
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
                        <HandTracker 
                            onTrackingUpdate={handleTrackingUpdate}
                            onCleanup={(cleanup) => { cameraCleanupRef.current = cleanup; }} 
                        />
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