import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Home.css";
import heroImage from "../assets/hero-section.jpg";

function Home() {
    const navigate = useNavigate();
    const [script, setScript] = useState("");

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        const revealElements = document.querySelectorAll(".reveal");

        if (prefersReducedMotion) {
            revealElements.forEach((element) => {
                element.classList.add("revealed");
            });
            return;
        }

        const observer = new IntersectionObserver(
            (entries, currentObserver) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                        currentObserver.unobserve(entry.target);
                    }
                });
            },
            {
                root: null,
                threshold: 0.16,
                rootMargin: "0px 0px -10% 0px",
            }
        );

        revealElements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
    }, []);

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
        <div className="home-page">
            <section
                className="hero-section"
                style={{ backgroundImage: `url(${heroImage})` }}
            >
                <div className="hero-overlay" />

                <div className="container hero-content reveal revealed">
                    <span className="hero-badge">AI-Powered Public Speaking Coach</span>
                    
                    <br/>

                    <h1 className="hero-title" aria-label="Presentra">
                        {"PRESENTRA".split("").map((letter, index) => (
                            <span
                                key={`${letter}-${index}`}
                                className="hero-letter"
                                style={{ "--letter-delay": `${index * 0.08}s` }}
                            >
                                {letter}
                            </span>
                        ))}
                    </h1>


                    <h2 className="hero-subtitle">
                        Hack Your Fear. Own The Stage.
                    </h2>

                    <p className="hero-description">
                        Presentra is an AI-powered public speaking training platform
                        designed to help students improve confidence, clarity, and pacing
                        through real-time speech analysis and smart performance feedback.
                    </p>

                    <div className="hero-actions">
                        <button
                            onClick={() =>
                                document
                                    .getElementById("start-section")
                                    .scrollIntoView({ behavior: "smooth" })
                            }
                            className="primary-btn"
                        >
                            Start Practicing
                        </button>

                        <a href="#features" className="secondary-btn">
                            Explore Features
                        </a>
                    </div>
                </div>

                <div className="hero-glow hero-glow-1" />
                <div className="hero-glow hero-glow-2" />
            </section>

            <section id="features" className="features-section">
                <div className="container">
                    <div className="section-heading reveal">
                        <span className="section-tag">Why Presentra</span>
                        <h2>Train smarter. Speak better.</h2>
                        <p>
                            Built to help you practice with more confidence, better pacing,
                            and clearer delivery.
                        </p>
                    </div>

                    <div className="row g-4">
                        <div className="col-md-4 reveal reveal-delay-1">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-mic-fill"></i>
                                </div>
                                <h4>Live Speech Detection</h4>
                                <p>
                                    Real-time voice recognition tracks your speech and
                                    provides accurate transcript analysis.
                                </p>
                            </div>
                        </div>

                        <div className="col-md-4 reveal reveal-delay-2">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-graph-up-arrow"></i>
                                </div>
                                <h4>Performance Analytics</h4>
                                <p>
                                    Get detailed insights on pacing, filler words, and
                                    overall speaking confidence.
                                </p>
                            </div>
                        </div>

                        <div className="col-md-4 reveal reveal-delay-3">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-lightbulb-fill"></i>
                                </div>
                                <h4>Smart Feedback</h4>
                                <p>
                                    Receive personalized improvement tips to level up your
                                    presentation skills.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="start-section" className="practice-section">
                <div className="container">
                    <div className="practice-card reveal">
                        <div className="section-heading left">
                            <span className="section-tag">Start Your Session</span>
                            <h2>Practice with your script</h2>
                            <p>
                                Paste your speech below and begin your guided training
                                session.
                            </p>
                        </div>

                        <textarea
                            rows="9"
                            className="script-input"
                            placeholder="Paste your speech here..."
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                        />

                        <div className="practice-actions">
                            <button onClick={startSession} className="primary-btn">
                                Start Session
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;
