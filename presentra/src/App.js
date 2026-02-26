import { useState, useRef } from "react";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [timer, setTimer] = useState(0);
  const [results, setResults] = useState(null);

  const recognitionRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const startRecording = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

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

    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );
      setTimer(elapsed);
    }, 1000);

    setTranscript("");
    setResults(null);
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current.stop();
    clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    analyzeSpeech();
  };

  const analyzeSpeech = () => {
    const totalTimeSeconds = timer;
    const words = transcript.trim().split(/\s+/);
    const totalWords = words.length;

    const minutes = totalTimeSeconds / 60;
    const wpm = Math.round(totalWords / minutes);

    const fillers = ["um", "uh", "like", "ah", "so"];
    let fillerCount = 0;

    const lowerTranscript = transcript.toLowerCase();

    fillers.forEach((word) => {
      const regex = new RegExp("\\b" + word + "\\b", "g");
      const matches = lowerTranscript.match(regex);
      if (matches) fillerCount += matches.length;
    });

    let score = 100;
    score -= fillerCount * 2;
    if (wpm > 180) score -= 10;
    if (wpm < 100) score -= 10;
    if (score < 0) score = 0;

    let feedback = "";

    if (fillerCount > 10) {
      feedback += "Reduce filler words. Pause instead of saying 'um'. ";
    }

    if (wpm > 180) {
      feedback += "You're speaking too fast. Slow down. ";
    } else if (wpm < 100) {
      feedback += "You're speaking slightly slow. Increase pace. ";
    } else {
      feedback += "Good pacing! ";
    }

    setResults({
      score,
      wpm,
      fillerCount,
      feedback,
    });
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>🚀 Presentra</h1>
      <h3>Hack your fear. Own the stage.</h3>

      <button onClick={startRecording} disabled={isRecording}>
        Start
      </button>

      <button onClick={stopRecording} disabled={!isRecording}>
        Stop
      </button>

      <p>⏱ Time: {timer}s</p>

      <h3>Transcript:</h3>
      <p>{transcript}</p>

      {results && (
        <div>
          <h3>📊 Results</h3>
          <p>Confidence Score: {results.score}/100</p>
          <p>Words Per Minute: {results.wpm}</p>
          <p>Filler Words: {results.fillerCount}</p>
          <p>Feedback: {results.feedback}</p>
        </div>
      )}
    </div>
  );
}

export default App;