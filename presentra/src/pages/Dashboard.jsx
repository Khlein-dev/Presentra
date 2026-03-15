import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

function formatTime(seconds = 0) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function getScoreTone(score = 0) {
    if (score >= 85) return "good";
    if (score >= 65) return "warn";
    return "bad";
}

function getPaceTone(label = "") {
    if (label === "Good Pace") return "good";
    if (label === "Too Slow") return "warn";
    if (label === "Too Fast") return "bad";
    return "neutral";
}

function tokenizeText(text = "") {
    return text.match(/\S+/g) || [];
}

function normalizeToken(token = "") {
    return token.toLowerCase().replace(/[^\w']/g, "");
}

function buildWordDiff(script = "", transcript = "") {
    const scriptTokens = tokenizeText(script);
    const transcriptTokens = tokenizeText(transcript);

    const a = scriptTokens.map(normalizeToken);
    const b = transcriptTokens.map(normalizeToken);

    const dp = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            if (a[i] && b[j] && a[i] === b[j]) {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const scriptDisplay = [];
    const transcriptDisplay = [];

    let i = 0;
    let j = 0;
    let matched = 0;
    let missing = 0;
    let extra = 0;

    while (i < a.length && j < b.length) {
        if (a[i] && b[j] && a[i] === b[j]) {
            scriptDisplay.push({ text: scriptTokens[i], type: "match" });
            transcriptDisplay.push({ text: transcriptTokens[j], type: "match" });
            matched++;
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            scriptDisplay.push({ text: scriptTokens[i], type: "missing" });
            missing++;
            i++;
        } else {
            transcriptDisplay.push({ text: transcriptTokens[j], type: "extra" });
            extra++;
            j++;
        }
    }

    while (i < a.length) {
        scriptDisplay.push({ text: scriptTokens[i], type: "missing" });
        missing++;
        i++;
    }

    while (j < b.length) {
        transcriptDisplay.push({ text: transcriptTokens[j], type: "extra" });
        extra++;
        j++;
    }

    const scriptTotal = scriptTokens.length || 1;
    const transcriptTotal = transcriptTokens.length || 1;
    const matchRate = Math.round((matched / scriptTotal) * 100);
    const omissionRate = Math.round((missing / scriptTotal) * 100);
    const extraRate = Math.round((extra / transcriptTotal) * 100);

    return {
        scriptDisplay,
        transcriptDisplay,
        matched,
        missing,
        extra,
        matchRate,
        omissionRate,
        extraRate,
    };
}

function StatCard({ icon, label, value, sub, tone = "neutral" }) {
    return (
        <div className={`dash-stat-card tone-${tone}`}>
            <div className="dash-stat-top">
                <div className="dash-stat-icon">
                    <i className={`bi ${icon}`}></i>
                </div>
                <span className="dash-stat-label">{label}</span>
            </div>
            <div className="dash-stat-value">{value}</div>
            {sub ? <div className="dash-stat-sub">{sub}</div> : null}
        </div>
    );
}

function SectionTitle({ icon, title, subtitle }) {
    return (
        <div className="dash-section-title">
            <div className="dash-section-badge">
                <i className={`bi ${icon}`}></i>
                <span>{title}</span>
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
        </div>
    );
}

function SummaryPanel({ summary, pacing, overall }) {
    const scoreTone = getScoreTone(overall?.overallScore);

    return (
        <div className="dash-panel">
            <SectionTitle
                icon="bi-speedometer2"
                title="Session Summary"
                subtitle="A quick overview of your speaking performance."
            />

            <div className="dash-summary-grid">
                <StatCard
                    icon="bi-trophy-fill"
                    label="Overall Score"
                    value={overall?.overallScore ?? 0}
                    sub={overall?.performanceLevel || "—"}
                    tone={scoreTone}
                />
                <StatCard
                    icon="bi-clock-history"
                    label="Duration"
                    value={summary?.durationFormatted || "0m 00s"}
                    sub="Total speaking time"
                />
                <StatCard
                    icon="bi-chat-left-text-fill"
                    label="Total Words"
                    value={summary?.totalWords ?? 0}
                    sub="Recognized spoken words"
                />
                <StatCard
                    icon="bi-activity"
                    label="Average WPM"
                    value={summary?.averageWPM || summary?.wpm || 0}
                    sub={pacing?.idealRange || "90–160 WPM"}
                    tone={getScoreTone(pacing?.paceScore)}
                />
            </div>
        </div>
    );
}

function FluencyAnalyzer({ fluency }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!fluency) return null;

    const {
        fillerRate,
        fillerBreakdown = {},
        fluencyScore = 0,
        fillerTimeline = [],
        sessionDuration = 0,
        excludedFillers = [],
        fillerCount = 0,
    } = fluency;

    const scoreTone = getScoreTone(fluencyScore);
    const bucketCount = 12;
    const bucketSize = Math.max(1, Math.ceil((sessionDuration || 60) / bucketCount));
    const buckets = Array(bucketCount).fill(0);

    fillerTimeline.forEach((entry) => {
        const index = Math.min(
            Math.floor((entry.secondsElapsed || 0) / bucketSize),
            bucketCount - 1
        );
        buckets[index]++;
    });

    const maxBucket = Math.max(...buckets, 1);
    const svgW = 1000;
    const svgH = 210;
    const padL = 24;
    const padR = 24;
    const padT = 18;
    const padB = 34;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    const x = (i) => padL + (i / (bucketCount - 1)) * chartW;
    const y = (v) => padT + chartH - (v / maxBucket) * chartH;

    const makeSmoothPath = (values) => {
        let d = `M ${x(0)},${y(values[0])}`;
        for (let i = 0; i < values.length - 1; i++) {
            const x0 = x(i);
            const y0 = y(values[i]);
            const x1 = x(i + 1);
            const y1 = y(values[i + 1]);
            const cp = (x1 - x0) * 0.42;
            d += ` C ${x0 + cp},${y0} ${x1 - cp},${y1} ${x1},${y1}`;
        }
        return d;
    };

    const linePath = makeSmoothPath(buckets);
    const areaPath = `${linePath} L ${x(bucketCount - 1)},${padT + chartH} L ${x(
        0
    )},${padT + chartH} Z`;

    const breakdownEntries = Object.entries(fillerBreakdown).sort((a, b) => b[1] - a[1]);

    return (
        <div className="dash-panel">
            <SectionTitle
                icon="bi-chat-quote-fill"
                title="Fluency Analysis"
                subtitle="Tracks filler density, repetition patterns, and clarity."
            />

            <div className="dash-summary-grid fluency-top-grid">
                <StatCard
                    icon="bi-stars"
                    label="Fluency Score"
                    value={fluencyScore}
                    sub="Out of 100"
                    tone={scoreTone}
                />
                <StatCard
                    icon="bi-exclamation-diamond-fill"
                    label="Total Fillers"
                    value={fillerCount}
                    sub="Detected filler words"
                    tone={fillerCount <= 5 ? "good" : fillerCount <= 10 ? "warn" : "bad"}
                />
                <StatCard
                    icon="bi-percent"
                    label="Filler Rate"
                    value={`${fillerRate}%`}
                    sub="Of total spoken words"
                    tone={Number(fillerRate) <= 3 ? "good" : Number(fillerRate) <= 7 ? "warn" : "bad"}
                />
            </div>

            {excludedFillers.length > 0 && (
                <div className="dash-inline-note">
                    <i className="bi bi-info-circle-fill"></i>
                    <span>
                        Not flagged because they appear in your script:{" "}
                        <strong>{excludedFillers.join(", ")}</strong>
                    </span>
                </div>
            )}

            <div className="dash-chart-panel">
                <div className="dash-chart-header">
                    <h4>Filler Density Timeline</h4>
                    <span>{bucketCount} speaking segments</span>
                </div>

                <div className="dash-chart-wrap">
                    <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="dash-svg-chart"
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="fluencyArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.04" />
                            </linearGradient>
                            <filter id="fluencyGlow">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {[0, Math.ceil(maxBucket / 2), maxBucket].map((tick) => (
                            <g key={tick}>
                                <line
                                    x1={padL}
                                    y1={y(tick)}
                                    x2={svgW - padR}
                                    y2={y(tick)}
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={padL - 6}
                                    y={y(tick) + 4}
                                    textAnchor="end"
                                    fill="#7f6ca8"
                                    fontSize="11"
                                >
                                    {tick}
                                </text>
                            </g>
                        ))}

                        <path d={areaPath} fill="url(#fluencyArea)" />
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="4"
                            opacity="0.35"
                            filter="url(#fluencyGlow)"
                        />
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />

                        {buckets.map((value, index) => {
                            const hasValue = value > 0;
                            const active = hoveredIndex === index;
                            const tone =
                                value >= 3 ? "#fb7185" : value === 2 ? "#f59e0b" : "#34d399";

                            return (
                                <g
                                    key={index}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <circle
                                        cx={x(index)}
                                        cy={y(value)}
                                        r={12}
                                        fill="transparent"
                                    />
                                    {active ? (
                                        <circle
                                            cx={x(index)}
                                            cy={y(value)}
                                            r={8}
                                            fill="none"
                                            stroke={hasValue ? tone : "#7f6ca8"}
                                            opacity="0.45"
                                        />
                                    ) : null}
                                    <circle
                                        cx={x(index)}
                                        cy={y(value)}
                                        r={hasValue ? 5 : 3}
                                        fill={hasValue ? tone : "rgba(255,255,255,0.18)"}
                                        stroke="#140d22"
                                        strokeWidth="1.5"
                                    />
                                </g>
                            );
                        })}

                        {buckets.map((_, index) => (
                            <text
                                key={index}
                                x={x(index)}
                                y={svgH - 8}
                                textAnchor="middle"
                                fill="#7f6ca8"
                                fontSize="10"
                            >
                                {formatTime(index * bucketSize)}
                            </text>
                        ))}
                    </svg>

                    {hoveredIndex !== null && (
                        <div className="dash-chart-tooltip">
                            <div className="dash-tooltip-title">
                                {formatTime(hoveredIndex * bucketSize)} –{" "}
                                {formatTime((hoveredIndex + 1) * bucketSize)}
                            </div>
                            <div className="dash-tooltip-line">
                                Fillers in segment: <strong>{buckets[hoveredIndex]}</strong>
                            </div>
                        </div>
                    )}
                </div>

                <div className="dash-legend">
                    <span><i className="bi bi-circle-fill good"></i> 1 filler</span>
                    <span><i className="bi bi-circle-fill warn"></i> 2 fillers</span>
                    <span><i className="bi bi-circle-fill bad"></i> 3+ fillers</span>
                    <span><i className="bi bi-circle-fill neutral"></i> none</span>
                </div>
            </div>

            <div className="dash-breakdown-grid">
                <div className="dash-subpanel">
                    <div className="dash-subpanel-header">
                        <h4>Filler Breakdown</h4>
                    </div>

                    {breakdownEntries.length > 0 ? (
                        <div className="dash-chip-grid">
                            {breakdownEntries.map(([word, count]) => (
                                <div className="dash-chip-card" key={word}>
                                    <span className="dash-chip-label">“{word}”</span>
                                    <strong>{count}×</strong>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="dash-empty-state">
                            <i className="bi bi-patch-check-fill"></i>
                            <span>No filler words detected.</span>
                        </div>
                    )}
                </div>

                <div className="dash-subpanel">
                    <div className="dash-subpanel-header">
                        <h4>Fluency Interpretation</h4>
                    </div>
                    <ul className="dash-insight-list">
                        <li>
                            Lower filler density usually means stronger pacing and more intentional pauses.
                        </li>
                        <li>
                            Repeated filler clusters often happen during transitions between ideas.
                        </li>
                        <li>
                            If fillers rise late in the speech, memorization or fatigue may be affecting delivery.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function VolumeGraph({ volume }) {
    if (!volume || !volume.history || volume.history.length < 2) return null;

    const quietThreshold = volume.quietThreshold ?? 35;
    const loudThreshold = volume.loudThreshold ?? 90;
    const { history, sessionDuration = 0 } = volume;

    const MAX_POINTS = 140;
    const step = Math.max(1, Math.floor(history.length / MAX_POINTS));
    const points = [];

    for (let i = 0; i < history.length; i += step) {
        points.push(history[i]);
    }

    const smooth = (arr, win = 4) =>
        arr.map((_, i) => {
            const slice = arr.slice(Math.max(0, i - win), i + win + 1);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
        });

    const smoothed = smooth(points);
    const avg = Math.round(smoothed.reduce((a, b) => a + b, 0) / smoothed.length);
    const quietPct = Math.round(
        (smoothed.filter((v) => v < quietThreshold).length / smoothed.length) * 100
    );
    const loudPct = Math.round(
        (smoothed.filter((v) => v > loudThreshold).length / smoothed.length) * 100
    );
    const goodPct = 100 - quietPct - loudPct;

    const svgW = 1000;
    const svgH = 220;
    const padL = 18;
    const padR = 18;
    const padT = 18;
    const padB = 36;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    const xAt = (i) => padL + (i / (smoothed.length - 1)) * chartW;
    const yAt = (v) => padT + chartH - (v / 100) * chartH;

    const topPoints = smoothed.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

    const makeSmoothPath = (pts) => {
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cp = (pts[i + 1].x - pts[i].x) * 0.42;
            d += ` C ${pts[i].x + cp},${pts[i].y} ${pts[i + 1].x - cp},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
        }
        return d;
    };

    const linePath = makeSmoothPath(topPoints);
    const areaPath = `${linePath} L ${xAt(smoothed.length - 1)},${padT + chartH} L ${xAt(
        0
    )},${padT + chartH} Z`;

    const xLabelIndices = [
        0,
        Math.floor(smoothed.length * 0.25),
        Math.floor(smoothed.length * 0.5),
        Math.floor(smoothed.length * 0.75),
        smoothed.length - 1,
    ];

    const secondsPerPoint = (sessionDuration / history.length) * step;
    const avgTone = avg < quietThreshold ? "warn" : avg > loudThreshold ? "bad" : "good";

    return (
        <div className="dash-panel">
            <SectionTitle
                icon="bi-volume-up-fill"
                title="Volume Analysis"
                subtitle="Shows how steady and controlled your projection was across the session."
            />

            <div className="dash-summary-grid volume-top-grid">
                <StatCard
                    icon="bi-soundwave"
                    label="Average Volume"
                    value={avg}
                    sub="0–100 scale"
                    tone={avgTone}
                />
                <StatCard
                    icon="bi-volume-off-fill"
                    label="Too Quiet"
                    value={`${quietPct}%`}
                    sub={`Below ${quietThreshold}`}
                    tone={quietPct < 20 ? "good" : "warn"}
                />
                <StatCard
                    icon="bi-volume-down-fill"
                    label="Good Volume"
                    value={`${goodPct}%`}
                    sub={`${quietThreshold}–${loudThreshold}`}
                    tone="good"
                />
                <StatCard
                    icon="bi-volume-up-fill"
                    label="Too Loud"
                    value={`${loudPct}%`}
                    sub={`Above ${loudThreshold}`}
                    tone={loudPct < 15 ? "good" : "bad"}
                />
            </div>

            <div className="dash-chart-panel">
                <div className="dash-chart-header">
                    <h4>Volume Over Time</h4>
                    <span>Smoothed waveform</span>
                </div>

                <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="dash-svg-chart"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="volumeArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.04" />
                        </linearGradient>
                        <filter id="volumeGlow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <rect
                        x={padL}
                        y={padT}
                        width={chartW}
                        height={(100 - loudThreshold) / 100 * chartH}
                        fill="rgba(251,113,133,0.05)"
                    />
                    <rect
                        x={padL}
                        y={padT + ((100 - quietThreshold) / 100) * chartH}
                        width={chartW}
                        height={(quietThreshold / 100) * chartH}
                        fill="rgba(245,158,11,0.05)"
                    />

                    {[quietThreshold, loudThreshold].map((threshold, idx) => (
                        <line
                            key={threshold}
                            x1={padL}
                            y1={yAt(threshold)}
                            x2={svgW - padR}
                            y2={yAt(threshold)}
                            stroke={idx === 0 ? "rgba(245,158,11,0.85)" : "rgba(251,113,133,0.85)"}
                            strokeDasharray="6 4"
                        />
                    ))}

                    <path d={areaPath} fill="url(#volumeArea)" />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="4"
                        opacity="0.34"
                        filter="url(#volumeGlow)"
                    />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />

                    {xLabelIndices.map((i) => (
                        <text
                            key={i}
                            x={xAt(i)}
                            y={svgH - 10}
                            textAnchor="middle"
                            fill="#7f6ca8"
                            fontSize="10"
                        >
                            {formatTime(Math.round(i * secondsPerPoint))}
                        </text>
                    ))}
                </svg>

                <div className="dash-legend">
                    <span><i className="bi bi-square-fill bad"></i> Too loud zone</span>
                    <span><i className="bi bi-square-fill good"></i> Good zone</span>
                    <span><i className="bi bi-square-fill warn"></i> Too quiet zone</span>
                </div>
            </div>
        </div>
    );
}

function ScriptTranscriptDiff({ script = "", transcript = "" }) {
    const diff = useMemo(() => buildWordDiff(script, transcript), [script, transcript]);

    return (
        <div className="dash-panel">
            <SectionTitle
                icon="bi-files"
                title="Script vs Transcript"
                subtitle="Compares what was expected with what was actually spoken. Differences are highlighted in red."
            />

            <div className="dash-summary-grid diff-top-grid">
                <StatCard
                    icon="bi-check2-circle"
                    label="Matched Words"
                    value={diff.matched}
                    sub={`${diff.matchRate}% script match`}
                    tone={diff.matchRate >= 85 ? "good" : diff.matchRate >= 65 ? "warn" : "bad"}
                />
                <StatCard
                    icon="bi-x-circle"
                    label="Omitted Words"
                    value={diff.missing}
                    sub={`${diff.omissionRate}% omitted`}
                    tone={diff.missing <= 5 ? "good" : diff.missing <= 20 ? "warn" : "bad"}
                />
                <StatCard
                    icon="bi-plus-circle"
                    label="Extra Words"
                    value={diff.extra}
                    sub={`${diff.extraRate}% added`}
                    tone={diff.extra <= 5 ? "good" : diff.extra <= 20 ? "warn" : "bad"}
                />
            </div>

            <div className="dash-diff-grid">
                <div className="dash-subpanel">
                    <div className="dash-subpanel-header">
                        <h4>
                            <i className="bi bi-file-earmark-text"></i>
                            Expected Script
                        </h4>
                    </div>
                    <div className="dash-diff-block">
                        {diff.scriptDisplay.length ? (
                            diff.scriptDisplay.map((token, index) => (
                                <span
                                    key={`script-${index}`}
                                    className={`diff-token token-${token.type}`}
                                    title={token.type === "missing" ? "Not spoken" : "Matched"}
                                >
                                    {token.text}
                                </span>
                            ))
                        ) : (
                            <p className="dash-placeholder">No script found.</p>
                        )}
                    </div>
                </div>

                <div className="dash-subpanel">
                    <div className="dash-subpanel-header">
                        <h4>
                            <i className="bi bi-chat-left-text"></i>
                            Live Transcript
                        </h4>
                    </div>
                    <div className="dash-diff-block">
                        {diff.transcriptDisplay.length ? (
                            diff.transcriptDisplay.map((token, index) => (
                                <span
                                    key={`transcript-${index}`}
                                    className={`diff-token token-${token.type}`}
                                    title={token.type === "extra" ? "Different / extra spoken word" : "Matched"}
                                >
                                    {token.text}
                                </span>
                            ))
                        ) : (
                            <p className="dash-placeholder">No transcript captured.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="dash-inline-note danger-note">
                <i className="bi bi-exclamation-octagon-fill"></i>
                <span>
                    Red highlights show words that were missed from the script or spoken differently/extra in the transcript.
                </span>
            </div>
        </div>
    );
}

function FeedbackPanel({ feedback = [] }) {
    return (
        <div className="dash-panel">
            <SectionTitle
                icon="bi-lightbulb-fill"
                title="Coaching Feedback"
                subtitle="Key improvement points based on your session results."
            />

            <div className="dash-feedback-list">
                {feedback.map((item, index) => (
                    <div className="dash-feedback-item" key={index}>
                        <div className="dash-feedback-icon">
                            <i className="bi bi-arrow-up-right-circle-fill"></i>
                        </div>
                        <p>{item}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state;

    if (!data) {
        return (
            <div className="dash-empty-page">
                <div className="dash-empty-card">
                    <i className="bi bi-bar-chart-line-fill"></i>
                    <h2>No session data found</h2>
                    <p>Start a new practice session to generate analytics.</p>
                    <button className="dash-primary-btn" onClick={() => navigate("/")}>
                        <i className="bi bi-arrow-left"></i>
                        <span>Back Home</span>
                    </button>
                </div>
            </div>
        );
    }

    const { summary, fluency, pacing, overall, feedback, volume, transcript, script } = data;

    return (
        <div className="dashboard-page">
            <div className="dashboard-glow glow-1"></div>
            <div className="dashboard-glow glow-2"></div>

            <div className="container dashboard-shell">
                <div className="dashboard-hero">
                    <div className="dashboard-badge">
                        <i className="bi bi-bar-chart-fill"></i>
                        <span>Session Analytics</span>
                    </div>

                    <h1 className="dashboard-title">Performance Dashboard</h1>
                    <p className="dashboard-subtitle">
                        Review pacing, fluency, projection, and script accuracy from your latest public speaking session.
                    </p>
                </div>

                <SummaryPanel summary={summary} pacing={pacing} overall={overall} />
                <FluencyAnalyzer fluency={fluency} />
                <VolumeGraph volume={volume} />
                <ScriptTranscriptDiff script={script} transcript={transcript} />
                <FeedbackPanel feedback={feedback} />

                <div className="dashboard-footer-actions">
                    <button className="dash-primary-btn" onClick={() => navigate("/")}>
                        <i className="bi bi-arrow-repeat"></i>
                        <span>Start New Session</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
