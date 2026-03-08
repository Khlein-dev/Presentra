import React, { useEffect, useRef } from "react";
import { Hands } from "@mediapipe/hands";
import * as cam from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import Webcam from "react-webcam";

const HandTracker = () =>{
    const webcamRef=useRef(null);
    const canvasRef=useRef(null);

    useEffect(()=>{
        //Initialize MediaPipe Hands model
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands:2,
            modelComplexity:1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);

        //Setup Cam

        if(
            typeof webcamRef.current !=="undefined" &&
            webcamRef.current !==null

        ){
            const camera=new cam.Camera(webcamRef.current.video, {
                onFrame:async () => {
                    await hands.send({ image: webcamRef.current.video});
                },
                width:1280,
                height:720,
            });
            camera.start();
    }
}, []);

const onResults = (results)=>{
    //setup canvas dimensions for video
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;
    canvasRef.current.width = videoHeight;
    canvasRef.current.height = videoHeight;

    const canvasCtx=canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(0,0,videoWidth,videoHeight);

    canvasCtx.drawImage(
        results.image,
        0,
        0,
        videoWidth,
        videoHeight
    );

    if (results.multiHandLandmarks){
        for (const landmarks of results.multiHandLandmarks) {
            //connectors
            drawConnectors(canvasCtx,landmarks,"HAND_CONNECTIONS",{
                color:"#00FF00",
                lineWidth: 5,

            });
            //21 individual points
            drawLandmarks(canvasCtx,landmarks, {
                color: "#FF0000",
                lineWidth:2,
            });
        }
    }
    canvasCtx.restore();
};

return (
    <div style={StyleSheet.container}>
        {/* The hidden webcam feed */}
        <Webcam
            ref={webcamRef}
            mirrored={true}
            style={StyleSheet.webcam}
        />
        {/*visible canvas*/}
        <canvas
            ref={canvasRef}
            style={StyleSheet.canvas}
        />
        <div style={StyleSheet.label}>Presentra: Hand Detection Active</div>
    </div>
    );
};

const styles = {
    container: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#1e1e1e",

    },
    webcam: {
        position: "absolute",
        marginLeft: "auto",
        marginRight: "auto",
        left: 0,
        right: 0,
        textAlign: "center",
        zIndex: 9,
        width: 640,
        height: 480,
        opacity: 0,
    },
    canvas: {
        position: "absolute",
        marginLeft: "auto",
        marginRight: "auto",
        left: 0,
        right: 0,
        textAlign: "center",
        zIndex: 9,
        width: 640,
        height: 480,
        transform: "scaleX(-1)",
    },
    label: {
        position: "absolute",
        bottom: "20px",
        color: "white",
        fontSize: "20px",
        fontFamily: "sans-serif"
    }
};

export default HandTracker;