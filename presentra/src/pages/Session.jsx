import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Holistic } from "@mediapipe/holistic";
import * as cam from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import "../styles/Session.css";

// --- HOLISTIC TRACKER COMPONENT (Hands + Body + Face) ---
const HandTracker = ({ onTrackingUpdate }) => {
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

    // Comprehensive facial reference points based on MediaPipe standards
    const FACIAL_REFERENCE_POINTS = {
        // Mouth reference points
        mouth: {
            // Corners (61, 291), top (13), bottom (14)
            // For smile: corners rise, mouth opens slightly
            smileCornerRise: 0.015, // Corners should be above center by this amount
            smileMouthOpen: { min: 0.02, max: 0.08 }, // Mouth openness range
            smileMouthWidth: 0.15, // Minimum mouth width for smile
            
            // For frown: corners drop, mouth slightly open
            frownCornerDrop: -0.015, // Corners should be below center
            frownMouthOpen: { min: 0.01, max: 0.06 },
            
            // For neutral: closed mouth, no corner movement
            neutralMouthOpen: { max: 0.02 },
        },

        // Eyebrow reference points
        eyebrows: {
            // Inner points (105 left, 334 right), outer points (107 left, 336 right)
            // For angry/mad: eyebrows down, angled inward
            madAngleRange: { min: -70, max: 0 }, // Downward slant
            madDistance: 0.2, // Inner points close together
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
            eyeContactThreshold: 0.2, // ±20% tolerance
            
            // Eye width landmarks (33, 362 outer; 133, 263 inner)
            eyeOpenness: { min: 0.08, max: 0.4 }, // Eye height range
            eyeSymmetry: 0.1, // Max difference between left and right
            
            // For looking left/right, eyes move horizontally
            eyeLookLeftThreshold: 0.35, // Left iris X position
            eyeLookRightThreshold: 0.65, // Right iris X position
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

        // Compare against reference points
        const refs = FACIAL_REFERENCE_POINTS.mouth;

        // SMILE detection
        if (mouthOpenness >= refs.smileMouthOpen.min &&
            mouthOpenness <= refs.smileMouthOpen.max &&
            mouthWidth >= refs.smileMouthWidth &&
            avgCornerRise > refs.smileCornerRise) {
            console.log("✓ SMILE:", { mouthOpenness: mouthOpenness.toFixed(3), mouthWidth: mouthWidth.toFixed(3), cornerRise: avgCornerRise.toFixed(3) });
            return "smile";
        }

        // FROWN detection
        if (mouthOpenness >= refs.frownMouthOpen.min &&
            mouthOpenness <= refs.frownMouthOpen.max &&
            avgCornerRise < refs.frownCornerDrop) {
            console.log("✓ FROWN:", { mouthOpenness: mouthOpenness.toFixed(3), cornerDrop: avgCornerRise.toFixed(3) });
            return "frown";
        }

        console.log("Mouth metrics:", { mouthOpenness: mouthOpenness.toFixed(3), mouthWidth: mouthWidth.toFixed(3), cornerRise: avgCornerRise.toFixed(3) });
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
            
            // Store current finger spread for reference
            lastHandPos.currentFingerSpread = fingerSpread;

            // Initialize finger spread on first detection
            if (lastHandPos.fingerSpread === null) {
                lastHandPos.fingerSpread = fingerSpread;
            } else {
                // Check against reference points
                // Open Hand: fingers spread > 0.25 units apart
                if (fingerSpread >= HAND_GESTURE_REFERENCES.openHand.fingerSpreadMin) {
                    movement = "openHand";
                    lastHandPos.fingerSpread = fingerSpread;
                }
                // Close Hand: fingers close together < 0.08 units apart
                else if (fingerSpread <= HAND_GESTURE_REFERENCES.closeHand.fingerSpreadMax) {
                    movement = "closeHand";
                    lastHandPos.fingerSpread = fingerSpread;
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

    // Cleanup on unmount
    useEffect(() => {
        const camera = cameraRef.current;
        const holistic = holisticRef.current;
        const webcam = webcamRef.current;

        return () => {
            console.log("Cleaning up camera and holistic...");
            
            // Stop camera
            if (camera) {
                try {
                    camera.stop?.();
                    console.log("Camera stopped");
                } catch (err) {
                    console.error("Error stopping camera:", err);
                }
            }

            // Close holistic
            if (holistic) {
                try {
                    holistic.close?.();
                    console.log("Holistic closed");
                } catch (err) {
                    console.error("Error closing holistic:", err);
                }
            }

            // Stop webcam tracks
            if (webcam?.video?.srcObject) {
                const tracks = webcam.video.srcObject.getTracks();
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

                    // Draw iris centers for eye tracking visualization
                    const leftIrisCenter = faceLandmarks[468];
                    const rightIrisCenter = faceLandmarks[473];
                    
                    if (leftIrisCenter && rightIrisCenter) {
                        // Draw iris circles
                        canvasCtx.strokeStyle = "#00FFFF";
                        canvasCtx.lineWidth = 2;
                        canvasCtx.beginPath();
                        canvasCtx.arc(leftIrisCenter.x * videoWidth, leftIrisCenter.y * videoHeight, 8, 0, 2 * Math.PI);
                        canvasCtx.stroke();
                        
                        canvasCtx.beginPath();
                        canvasCtx.arc(rightIrisCenter.x * videoWidth, rightIrisCenter.y * videoHeight, 8, 0, 2 * Math.PI);
                        canvasCtx.stroke();

                        // Draw center reference line for eye contact
                        canvasCtx.strokeStyle = "#00FF00";
                        canvasCtx.lineWidth = 1;
                        canvasCtx.setLineDash([5, 5]);
                        const eyeCenterY = (leftIrisCenter.y + rightIrisCenter.y) / 2;
                        canvasCtx.beginPath();
                        canvasCtx.moveTo(0, eyeCenterY * videoHeight);
                        canvasCtx.lineTo(videoWidth, eyeCenterY * videoHeight);
                        canvasCtx.stroke();
                        canvasCtx.setLineDash([]);
                    }

                    // Draw mouth reference points
                    const mouthLeft = faceLandmarks[61];
                    const mouthRight = faceLandmarks[291];
                    if (mouthLeft && mouthRight) {
                        canvasCtx.fillStyle = "#FF00FF";
                        canvasCtx.beginPath();
                        canvasCtx.arc(mouthLeft.x * videoWidth, mouthLeft.y * videoHeight, 3, 0, 2 * Math.PI);
                        canvasCtx.fill();
                        
                        canvasCtx.beginPath();
                        canvasCtx.arc(mouthRight.x * videoWidth, mouthRight.y * videoHeight, 3, 0, 2 * Math.PI);
                        canvasCtx.fill();
                    }

                    // Draw eyebrow inner points for mad detection
                    const leftEyebrowInner = faceLandmarks[105];
                    const rightEyebrowInner = faceLandmarks[334];
                    if (leftEyebrowInner && rightEyebrowInner) {
                        canvasCtx.fillStyle = "#00FFFF";
                        canvasCtx.beginPath();
                        canvasCtx.arc(leftEyebrowInner.x * videoWidth, leftEyebrowInner.y * videoHeight, 2, 0, 2 * Math.PI);
                        canvasCtx.fill();
                        
                        canvasCtx.beginPath();
                        canvasCtx.arc(rightEyebrowInner.x * videoWidth, rightEyebrowInner.y * videoHeight, 2, 0, 2 * Math.PI);
                        canvasCtx.fill();
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
    const [eyeContact, setEyeContact] = useState(0);
    const [facialExpressions, setFacialExpressions] = useState({
        smile: 0,
        frown: 0,
        neutral: 0,
        mad: 0
    });
    const [handMovements, setHandMovements] = useState({
        handMoved: 0,
        openHand: 0,
        closeHand: 0,
        sidewaysRight: 0,
        sidewaysLeft: 0
    });

    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const startTimeRef = useRef(null);
    const gestureDebounceRef = useRef({
        leftLastMovement: null,
        rightLastMovement: null
    });
    const trackingDataRef = useRef({
        eyeContactFrames: 0,
        totalFrames: 0,
        facialExpressions: { smile: 0, frown: 0, neutral: 0, mad: 0 },
        handMovements: { handMoved: 0, openHand: 0, closeHand: 0, sidewaysRight: 0, sidewaysLeft: 0 }
    });

    // Handle tracking data from HandTracker
    const handleTrackingUpdate = (trackingData) => {
        if (!trackingDataRef.current) return;

        trackingDataRef.current.totalFrames++;

        // Track eye contact
        if (trackingData.eyeContact) {
            trackingDataRef.current.eyeContactFrames++;
        }

        // Track facial expressions
        if (trackingData.facialExpression) {
            trackingDataRef.current.facialExpressions[trackingData.facialExpression]++;
        }

        // Track hand movements - count each movement once when it happens
        if (trackingData.leftHandMovement && trackingData.leftHandMovement !== gestureDebounceRef.current.leftLastMovement) {
            // Movement detected on left hand, count it
            if (trackingDataRef.current.handMovements[trackingData.leftHandMovement] !== undefined) {
                trackingDataRef.current.handMovements[trackingData.leftHandMovement]++;
                // Update UI immediately
                setHandMovements({ ...trackingDataRef.current.handMovements });
            }
            gestureDebounceRef.current.leftLastMovement = trackingData.leftHandMovement;
            console.log("Left movement:", trackingData.leftHandMovement, "Total movements:", Object.values(trackingDataRef.current.handMovements).reduce((a, b) => a + b, 0));
        } else if (!trackingData.leftHandMovement) {
            gestureDebounceRef.current.leftLastMovement = null;
        }

        if (trackingData.rightHandMovement && trackingData.rightHandMovement !== gestureDebounceRef.current.rightLastMovement) {
            // Movement detected on right hand, count it
            if (trackingDataRef.current.handMovements[trackingData.rightHandMovement] !== undefined) {
                trackingDataRef.current.handMovements[trackingData.rightHandMovement]++;
                // Update UI immediately
                setHandMovements({ ...trackingDataRef.current.handMovements });
            }
            gestureDebounceRef.current.rightLastMovement = trackingData.rightHandMovement;
            console.log("Right movement:", trackingData.rightHandMovement, "Total movements:", Object.values(trackingDataRef.current.handMovements).reduce((a, b) => a + b, 0));
        } else if (!trackingData.rightHandMovement) {
            gestureDebounceRef.current.rightLastMovement = null;
        }

        // Update UI state periodically (every 30 frames) for other metrics
        if (trackingDataRef.current.totalFrames % 30 === 0) {
            const eyeContactPercentage = Math.round(
                (trackingDataRef.current.eyeContactFrames / trackingDataRef.current.totalFrames) * 100
            );
            setEyeContact(eyeContactPercentage);
            setFacialExpressions({ ...trackingDataRef.current.facialExpressions });
        }
    };
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

            eyeContact: {
                percentage: eyeContact,
                score: eyeContact >= 70 ? 100 : eyeContact >= 50 ? 75 : 50,
                feedback: eyeContact >= 70 
                    ? "Great eye contact maintained throughout!" 
                    : eyeContact >= 50 
                    ? "Good eye contact, but could look at camera more."
                    : "Work on maintaining more eye contact with the camera."
            },

            facialExpressions: {
                smile: facialExpressions.smile,
                neutral: facialExpressions.neutral,
                serious: facialExpressions.serious,
                dominantExpression: Object.keys(facialExpressions).reduce((a, b) => 
                    facialExpressions[a] > facialExpressions[b] ? a : b
                ),
                feedback: facialExpressions.smile > (facialExpressions.neutral + facialExpressions.serious) / 2
                    ? "Good use of facial expressions! Keep smiling to engage your audience."
                    : "Try to incorporate more facial expressions to keep your presentation engaging."
            },

            handMovements: {
                handMoved: handMovements.handMoved,
                openHand: handMovements.openHand,
                closeHand: handMovements.closeHand,
                totalMovements: Object.values(handMovements).reduce((a, b) => a + b, 0),
                feedback: Object.values(handMovements).reduce((a, b) => a + b, 0) > 10
                    ? "Excellent hand movement and gesticulation throughout your presentation!"
                    : Object.values(handMovements).reduce((a, b) => a + b, 0) > 5
                    ? "Good use of hand movements. You could use more to emphasize key points."
                    : "Consider using more hand movements to emphasize important points."
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
                            <HandTracker onTrackingUpdate={handleTrackingUpdate} />
                            
                            {/* Facial Expressions & Gestures Indicator */}
                            <div className="mt-3" style={{ fontSize: "12px", color: "#aaa" }}>
                                <div>👁️ Eye Contact: {eyeContact}%</div>
                                <div>😊 Expression: {Object.keys(facialExpressions).reduce((a, b) => 
                                    facialExpressions[a] > facialExpressions[b] ? a : b
                                )}</div>
                                <div>👆 Hand Movements: {Object.values(handMovements).reduce((a, b) => a + b, 0)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: TELEPROMPTER */}
                <div className="col-lg-8">
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
