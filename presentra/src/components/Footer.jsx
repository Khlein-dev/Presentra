import React from "react";

function Footer() {
    return (
        <footer className="text-light pt-5 pb-3" style={{backgroundColor: "#151433"}}>
            <div className="container">
                <div className="row">

                    {/* Brand Section */}
                    <div className="col-md-4 mb-4">
                        <h4 className="fw-bold text-white">Presentra</h4>
                        <p className="text-secondary">
                            Presentra is an AI-powered public speaking assistant
                            that enhances fluency, pacing, and confidence through
                            real-time speech analytics.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="col-md-2 mb-4">
                        <h6 className="fw-bold">Quick Links</h6>
                        <ul className="list-unstyled">
                            <li><a href="/" className="text-secondary text-decoration-none">Home</a></li>
                            <li><a href="/session" className="text-secondary text-decoration-none">Session</a></li>
                            <li><a href="/dashboard" className="text-secondary text-decoration-none">Analytics</a></li>
                        </ul>
                    </div>

                    {/* Features */}
                    <div className="col-md-3 mb-4">
                        <h6 className="fw-bold">Features</h6>
                        <ul className="list-unstyled text-secondary">
                            <li>AI Speech Recognition</li>
                            <li>Filler Word Detection</li>
                            <li>Real-Time Teleprompter</li>
                            <li>Performance Scoring</li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="col-md-3 mb-4">
                        <h6 className="fw-bold">Contact</h6>
                        <p className="text-secondary mb-1">
                            📧 support@presentra.ai
                        </p>
                        <p className="text-secondary">
                            Philippines
                        </p>

                        <div className="d-flex gap-3 mt-2">
                            <a href="#" className="text-secondary fs-5">
                                <i className="bi bi-facebook"></i>
                            </a>
                            <a href="#" className="text-secondary fs-5">
                                <i className="bi bi-twitter"></i>
                            </a>
                            <a href="#" className="text-secondary fs-5">
                                <i className="bi bi-linkedin"></i>
                            </a>
                        </div>
                    </div>
                </div>

                <hr className="border-secondary" />

                <div className="text-center text-secondary">
                    © {new Date().getFullYear()} Presentra. All rights reserved.
                </div>
            </div>
        </footer>
    );
}

export default Footer;