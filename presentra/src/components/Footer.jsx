import React from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";
import presentraLogo from "../assets/presentra.png";

function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="row footer-grid">

                    {/* Brand */}
                    <div className="col-md-4 footer-brand">
                        <img src={presentraLogo} alt="Presentra Logo" style={{width: "40px", marginBottom: "10px"}} />
                        <h3 className="footer-logo">Presentra</h3>
                        <p>
                            Presentra is an AI-powered public speaking assistant
                            that improves fluency, pacing, and confidence through
                            real-time speech analytics.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="col-md-2 footer-links">
                        <h6>Quick Links</h6>
                        <ul>
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/session">Session</Link></li>
                            <li><Link to="/dashboard">Analytics</Link></li>
                        </ul>
                    </div>

                    {/* Features */}
                    <div className="col-md-3 footer-links">
                        <h6>Features</h6>
                        <ul>
                            <li>AI Speech Recognition</li>
                            <li>Filler Word Detection</li>
                            <li>Real-Time Teleprompter</li>
                            <li>Performance Scoring</li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="col-md-3 footer-contact">
                        <h6>Contact</h6>

                        <p>kierjerymiepascua@gmail.com</p>
                        <p>Philippines</p>

                        <div className="footer-socials">
                            <a href="https://github.com/Khlein-dev/Presentra" target="_blank" rel="noopener noreferrer"><i className="bi bi-github"></i></a>
                            <a href="https://www.facebook.com/presentra" target="_blank" rel="noopener noreferrer"><i className="bi bi-facebook"></i></a>
                            <a href="https://www.linkedin.com/in/kier-jerymie-pascua-3026493b7/" target="_blank" rel="noopener noreferrer"><i className="bi bi-linkedin"></i></a>
                        </div>
                    </div>

                </div>

                <div className="footer-bottom">
                    © {new Date().getFullYear()} Presentra. All rights reserved.
                </div>
            </div>
        </footer>
    );
}

export default Footer;
