import { useLocation, useNavigate } from "react-router-dom";

function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();

    const data = location.state;

    if (!data) {
        return (
            <div style={{ padding: "60px", textAlign: "center" }}>
                <h2>No session data found.</h2>
                <button onClick={() => navigate("/")}>
                    Back Home
                </button>
            </div>
        );
    }

    const { summary, fluency, pacing, overall, feedback } = data;

    return (
        <div
            style={{
                padding: "60px",
                background: "#0f172a",
                minHeight: "100vh",
                color: "white",
                fontFamily: "Arial"
            }}
        >
            <h1 style={{ textAlign: "center", color: "#86858e" }}>
                Session Analytics
            </h1>

            {/* OVERALL SCORE */}
            <div
                style={{
                    textAlign: "center",
                    marginTop: "40px",
                    padding: "30px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)"
                }}
            >
                <h2>Overall Score</h2>

                <h1 style={{ fontSize: "60px", color: "#ffffff" }}>
                    {overall?.overallScore}
                </h1>

                <h3>{overall?.performanceLevel}</h3>
            </div>

            {/* SUMMARY */}
            <div style={{ marginTop: "40px" }}>
                <h2>⏱ Speech Summary</h2>

                <div style={cardStyle}>
                    <p>Duration: {summary?.durationFormatted}</p>
                    <p>Total Words: {summary?.totalWords}</p>
                    <p>Average WPM: {summary?.averageWPM || summary?.wpm} WPM</p>
                </div>
            </div>

            {/* FLUENCY */}
            <div style={{ marginTop: "40px" }}>
                <h2>Fluency Analysis</h2>

                <div style={cardStyle}>
                    <p>Filler Words Used: {fluency?.fillerCount}</p>
                    <p>Filler Rate: {fluency?.fillerRate}%</p>
                    <p>Fluency Score: {fluency?.fluencyScore}</p>

                    {fluency?.fillerBreakdown && (
                        <div style={{ marginTop: "15px" }}>
                            <h4>Filler Breakdown</h4>
                            {Object.entries(fluency.fillerBreakdown).map(
                                ([word, count]) => (
                                    <p key={word}>
                                        {word}: {count}
                                    </p>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* PACING */}
            <div style={{ marginTop: "40px" }}>
                <h2>Pacing Analysis</h2>

                <div style={cardStyle}>
                    <p>Speaking Speed: {pacing?.wpm} WPM</p>
                    <p>Ideal Range: {pacing?.idealRange}</p>
                    <p>Pace Score: {pacing?.paceScore}</p>
                </div>
            </div>

            {/* FEEDBACK */}
            <div style={{ marginTop: "40px" }}>
                <h2>Improvement Feedback</h2>

                <div style={cardStyle}>
                    {feedback?.map((item, index) => (
                        <p key={index}>• {item}</p>
                    ))}
                </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "50px" }}>
                <button
                    onClick={() => navigate("/")}
                    style={{
                        padding: "15px 30px",
                        fontSize: "16px",
                        background: "#6C63FF",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer"
                    }}
                >
                    Start New Session
                </button>
            </div>
        </div>
    );
}

const cardStyle = {
    background: "rgba(255,255,255,0.05)",
    padding: "25px",
    borderRadius: "12px",
    marginTop: "15px",
    lineHeight: "1.8"
};

export default Dashboard;