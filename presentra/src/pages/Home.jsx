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
        <div className="text-dark" style={{ fontFamily: "Arial, sans-serif" }}>

            {/* HERO SECTION */}
            <section className="py-5 text-center text-white"
                style={{
                    background: "linear-gradient(135deg, #6C63FF, #4F46E5)",
                }}
            >
                <div className="container">
                    <h1 className="display-4 fw-bold mb-3">🚀 Presentra</h1>
                    <h2 className="fw-light mb-3">
                        Hack Your Fear. Own The Stage.
                    </h2>
                    <p className="lead mx-auto" style={{ maxWidth: "700px" }}>
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
                        className="btn btn-light btn-lg mt-4 fw-bold text-primary"
                    >
                        Start Practicing
                    </button>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="py-5 bg-light text-center">
                <div className="container">
                    <h2 className="mb-5">Why Presentra?</h2>

                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="p-4 shadow-sm bg-white rounded">
                                <h4>🎤 Live Speech Detection</h4>
                                <p>
                                    Real-time voice recognition tracks your speech and provides
                                    accurate transcript analysis.
                                </p>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <div className="p-4 shadow-sm bg-white rounded">
                                <h4>📊 Performance Analytics</h4>
                                <p>
                                    Get detailed insights on pacing, filler words, and overall
                                    speaking confidence.
                                </p>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <div className="p-4 shadow-sm bg-white rounded">
                                <h4>🧠 Smart Feedback</h4>
                                <p>
                                    Receive personalized improvement tips to level up your
                                    presentation skills.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SCRIPT INPUT SECTION */}
            <section id="start-section" className="py-5 text-center">
                <div className="container">
                    <h2>Start Your Practice Session</h2>
                    <p className="mb-4">
                        Paste your speech script below and begin your training session.
                    </p>

                    <div className="row justify-content-center">
                        <div className="col-md-8">
                            <textarea
                                rows="8"
                                className="form-control mb-3"
                                placeholder="Paste your speech here..."
                                value={script}
                                onChange={(e) => setScript(e.target.value)}
                            />

                            <button
                                onClick={startSession}
                                className="btn btn-primary btn-lg fw-bold"
                            >
                                Start Session
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-dark text-white text-center py-4 mt-5">
                <div className="container">
                    <h5 className="mb-2">Presentra</h5>
                    <p className="mb-1 small">
                        AI-powered public speaking training for the next generation.
                    </p>
                    <p className="small opacity-75">
                        © {new Date().getFullYear()} Presentra. All rights reserved.
                    </p>
                </div>
            </footer>

        </div>
    );
}

export default Home;