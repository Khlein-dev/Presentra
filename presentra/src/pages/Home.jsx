import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();
    const [script, setScript] = useState("");

    const startSession = () => {
        if (!script.trim()) {
            alert("Please enter your speech script first.");
            return;
        }

        navigate("/session", {
            state: { script },
        });
    };

    return (
        <div style={{ fontFamily: "Arial, sans-serif", color: "#1e293b" }}>
            {/* HERO SECTION */}
            <section
                style={{
                    padding: "80px 20px",
                    textAlign: "center",
                    background: "linear-gradient(135deg, #6C63FF, #4F46E5)",
                    color: "white",
                }}
            >
                <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>
                    🚀 Presentra
                </h1>
                <h2 style={{ fontWeight: "400", marginBottom: "20px" }}>
                    Hack Your Fear. Own The Stage.
                </h2>
                <p style={{ maxWidth: "700px", margin: "0 auto", fontSize: "18px" }}>
                    Presentra is an AI-powered public speaking training platform designed
                    to help students improve confidence, clarity, and pacing through
                    real-time speech analysis and smart performance feedback.
                </p>

                <button
                    onClick={() =>
                        document
                            .getElementById("start-section")
                            .scrollIntoView({ behavior: "smooth" })
                    }
                    style={{
                        marginTop: "30px",
                        padding: "12px 24px",
                        fontSize: "16px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "white",
                        color: "#4F46E5",
                        fontWeight: "bold",
                    }}
                >
                    Start Practicing
                </button>
            </section>

            {/* FEATURES SECTION */}
            <section
                style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    background: "#f8fafc",
                }}
            >
                <h2 style={{ marginBottom: "40px" }}>Why Presentra?</h2>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "40px",
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ maxWidth: "250px" }}>
                        <h3>🎤 Live Speech Detection</h3>
                        <p>
                            Real-time voice recognition tracks your speech and provides
                            accurate transcript analysis.
                        </p>
                    </div>

                    <div style={{ maxWidth: "250px" }}>
                        <h3>📊 Performance Analytics</h3>
                        <p>
                            Get detailed insights on pacing, filler words, and overall
                            speaking confidence.
                        </p>
                    </div>

                    <div style={{ maxWidth: "250px" }}>
                        <h3>🧠 Smart Feedback</h3>
                        <p>
                            Receive personalized improvement tips to level up your
                            presentation skills.
                        </p>
                    </div>
                </div>
            </section>

            {/* SCRIPT INPUT SECTION */}
            <section
                id="start-section"
                style={{
                    padding: "60px 20px",
                    textAlign: "center",
                }}
            >
                <h2>Start Your Practice Session</h2>
                <p style={{ marginBottom: "20px" }}>
                    Paste your speech script below and begin your training session.
                </p>

                <textarea
                    rows="10"
                    style={{
                        width: "80%",
                        maxWidth: "700px",
                        padding: "15px",
                        fontSize: "16px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        resize: "none",
                    }}
                    placeholder="Paste your speech here..."
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                />

                <br />

                <button
                    onClick={startSession}
                    style={{
                        marginTop: "20px",
                        padding: "12px 28px",
                        fontSize: "16px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "#6C63FF",
                        color: "white",
                        fontWeight: "bold",
                    }}
                >
                    Start Session
                </button>
            </section>

            {/* FOOTER */}
            <footer
                style={{
                    padding: "30px 20px",
                    textAlign: "center",
                    background: "#1e293b",
                    color: "white",
                    marginTop: "40px",
                }}
            >
                <h3 style={{ marginBottom: "10px" }}>Presentra</h3>
                <p style={{ fontSize: "14px", marginBottom: "10px" }}>
                    AI-powered public speaking training for the next generation.
                </p>
                <p style={{ fontSize: "12px", opacity: "0.8" }}>
                    © {new Date().getFullYear()} Presentra. All rights reserved.
                </p>
            </footer>
        </div>
    );
}

export default Home;