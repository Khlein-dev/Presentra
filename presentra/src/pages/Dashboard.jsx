import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ---- FLUENCY ANALYZER COMPONENT ----
function FluencyAnalyzer({ fluency, summary }) {
    const [hoveredDot, setHoveredDot] = useState(null); // { bucketIndex, xPct, yPct, entries, count }

    if (!fluency) return null;

    const { fillerCount, fillerRate, fillerBreakdown, fluencyScore, fillerTimeline, sessionDuration, excludedFillers } = fluency;

    // Color for fluency score
    const scoreColor = fluencyScore >= 80 ? "#22c55e" : fluencyScore >= 50 ? "#f59e0b" : "#ef4444";

    // Generate timeline bar: divide session into buckets of ~10s each
    const bucketSize = 10; // seconds
    const totalBuckets = Math.max(1, Math.ceil((sessionDuration || 60) / bucketSize));
    const buckets = Array(totalBuckets).fill(0);

    (fillerTimeline || []).forEach(entry => {
        const bucketIndex = Math.min(Math.floor(entry.secondsElapsed / bucketSize), totalBuckets - 1);
        buckets[bucketIndex]++;
    });

    const maxBucket = Math.max(...buckets, 1);

    // Format seconds as mm:ss
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div style={{ marginTop: "40px" }}>
            <h2 style={{ color: "white" }}>
                🗣️ Fluency Analyzer
            </h2>

            {/* Score + Stats Row */}
            <div style={{ display: "flex", gap: "16px", marginTop: "15px", flexWrap: "wrap" }}>

                {/* Fluency Score */}
                <div style={{ ...cardStyle, flex: "0 0 160px", textAlign: "center" }}>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>Fluency Score</p>
                    <div style={{ fontSize: "52px", fontWeight: "bold", color: scoreColor, lineHeight: 1.1 }}>
                        {fluencyScore}
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>out of 100</p>
                </div>

                {/* Filler Stats */}
                <div style={{ ...cardStyle, flex: 1 }}>
                    <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                        <div>
                            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" }}>Total Filler Words</p>
                            <p style={{ fontSize: "24px", fontWeight: "bold", color: "white", margin: 0 }}>{fillerCount}</p>
                        </div>
                        <div>
                            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" }}>Filler Rate</p>
                            <p style={{ fontSize: "24px", fontWeight: "bold", color: "white", margin: 0 }}>{fillerRate}%</p>
                            <p style={{ color: "#64748b", fontSize: "11px", margin: 0 }}>of total words spoken</p>
                        </div>
                        <div>
                            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" }}>Rating</p>
                            <p style={{ fontSize: "18px", fontWeight: "bold", margin: 0, color: scoreColor }}>
                                {fillerCount === 0 ? "🏆 Flawless" : fillerCount <= 3 ? "✅ Great" : fillerCount <= 8 ? "⚠️ Fair" : "❌ Needs Work"}
                            </p>
                        </div>
                    </div>

                    {/* Excluded fillers note */}
                    {excludedFillers && excludedFillers.length > 0 && (
                        <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(99,102,241,0.1)", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.3)" }}>
                            <p style={{ fontSize: "12px", color: "#a5b4fc", margin: 0 }}>
                                ℹ️ Not flagged (appear in your script): <strong>{excludedFillers.join(", ")}</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Filler Breakdown */}
            {fillerBreakdown && Object.keys(fillerBreakdown).length > 0 && (
                <div style={{ ...cardStyle, marginTop: "16px" }}>
                    <h4 style={{ color: "white", marginTop: 0, marginBottom: "16px" }}>Filler Word Breakdown</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {Object.entries(fillerBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .map(([word, count]) => {
                                const pct = Math.round((count / fillerCount) * 100);
                                return (
                                    <div key={word} style={{
                                        background: "rgba(239,68,68,0.15)",
                                        border: "1px solid rgba(239,68,68,0.4)",
                                        borderRadius: "8px",
                                        padding: "10px 16px",
                                        minWidth: "100px",
                                        textAlign: "center"
                                    }}>
                                        <div style={{ color: "#fca5a5", fontWeight: "bold", fontSize: "16px" }}>"{word}"</div>
                                        <div style={{ color: "white", fontSize: "22px", fontWeight: "bold" }}>{count}×</div>
                                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>{pct}% of fillers</div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {fillerBreakdown && Object.keys(fillerBreakdown).length === 0 && (
                <div style={{ ...cardStyle, marginTop: "16px", textAlign: "center" }}>
                    <p style={{ fontSize: "18px", margin: 0 }}>🎉 No filler words detected. Excellent delivery!</p>
                </div>
            )}

            {/* Timeline */}
            {fillerTimeline && fillerTimeline.length > 0 && (
                <div style={{ ...cardStyle, marginTop: "16px" }}>
                    <h4 style={{ color: "white", marginTop: 0, marginBottom: "6px" }}>Filler Word Timeline</h4>
                    <p style={{ color: "#64748b", fontSize: "12px", marginTop: 0, marginBottom: "16px" }}>
                        Each point = {bucketSize}s window. Height shows filler density.
                    </p>

                    {/* Line graph */}
                    {(() => {
                        const svgW = 1000, svgH = 160;
                        const padL = 32, padR = 16, padT = 16, padB = 28;
                        const chartW = svgW - padL - padR;
                        const chartH = svgH - padT - padB;
                        const n = buckets.length;

                        const xPos = (i) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
                        const yPos = (v) => padT + chartH - (v / maxBucket) * chartH;

                        // Build smooth cubic bezier path through all points
                        const smoothLinePath = () => {
                            if (n === 1) return `M ${xPos(0)},${yPos(buckets[0])}`;
                            let d = `M ${xPos(0)},${yPos(buckets[0])}`;
                            for (let i = 0; i < n - 1; i++) {
                                const x0 = xPos(i),     y0 = yPos(buckets[i]);
                                const x1 = xPos(i + 1), y1 = yPos(buckets[i + 1]);
                                // Control points: pull horizontally 1/3 of segment width
                                const cpx = (x1 - x0) * 0.4;
                                d += ` C ${x0 + cpx},${y0} ${x1 - cpx},${y1} ${x1},${y1}`;
                            }
                            return d;
                        };

                        const linePath = smoothLinePath();

                        // Area path: drop down from first point, follow the smooth line, close at baseline
                        const areaPath = `M ${xPos(0)},${padT + chartH} L ${xPos(0)},${yPos(buckets[0])} ${linePath.slice(linePath.indexOf("C"))} L ${xPos(n - 1)},${padT + chartH} Z`;

                        const yTicks = [0, Math.ceil(maxBucket / 2), maxBucket];

                        return (
                            <div style={{ position: "relative" }}>
                            <svg
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                style={{ width: "100%", height: "180px", display: "block", marginBottom: "4px" }}
                                preserveAspectRatio="none"
                                onMouseLeave={() => setHoveredDot(null)}
                            >
                                <defs>
                                    <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                                    </linearGradient>
                                    <filter id="glowFilter">
                                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                                        <feMerge>
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>

                                {/* Y-axis gridlines + labels */}
                                {yTicks.map(tick => {
                                    const y = yPos(tick);
                                    return (
                                        <g key={tick}>
                                            <line x1={padL} y1={y} x2={svgW - padR} y2={y}
                                                stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4 4" />
                                            <text x={padL - 6} y={y + 4} textAnchor="end"
                                                fill="#64748b" fontSize="11">{tick}</text>
                                        </g>
                                    );
                                })}

                                {/* Area fill */}
                                <path d={areaPath} fill="url(#lineAreaGrad)" />

                                {/* Glow line (thicker, blurred) */}
                                <path d={linePath} fill="none"
                                    stroke="#818cf8" strokeWidth="4" strokeLinecap="round"
                                    filter="url(#glowFilter)" opacity="0.5" />

                                {/* Main line */}
                                <path d={linePath} fill="none"
                                    stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

                                {/* Dots — interactive hover targets */}
                                {buckets.map((v, i) => {
                                    const dotColor = v === 0 ? "rgba(255,255,255,0.15)" : v >= 3 ? "#ef4444" : v === 2 ? "#f59e0b" : "#22c55e";
                                    const r = v === 0 ? 3 : 5;
                                    const isHovered = hoveredDot?.bucketIndex === i;

                                    // Find filler entries that fall in this bucket
                                    const bucketEntries = (fillerTimeline || []).filter(e =>
                                        Math.min(Math.floor(e.secondsElapsed / bucketSize), totalBuckets - 1) === i
                                    );

                                    return (
                                        <g key={i}
                                            onMouseEnter={(e) => {
                                                if (v > 0) {
                                                    const svgEl = e.currentTarget.closest("svg");
                                                    const rect = svgEl.getBoundingClientRect();
                                                    const svgPt = svgEl.createSVGPoint();
                                                    svgPt.x = e.clientX;
                                                    svgPt.y = e.clientY;
                                                    const pt = svgPt.matrixTransform(svgEl.getScreenCTM().inverse());
                                                    // Convert SVG coords to % for positioning the HTML tooltip
                                                    const xPct = (pt.x / svgW) * 100;
                                                    const yPct = (pt.y / svgH) * 100;
                                                    setHoveredDot({ bucketIndex: i, xPct, yPct, entries: bucketEntries, count: v });
                                                }
                                            }}
                                            onMouseLeave={() => setHoveredDot(null)}
                                            style={{ cursor: v > 0 ? "pointer" : "default" }}
                                        >
                                            {/* Larger invisible hit area */}
                                            <circle cx={xPos(i)} cy={yPos(v)} r="12" fill="transparent" />
                                            {/* Outer ring on hover */}
                                            {isHovered && (
                                                <circle cx={xPos(i)} cy={yPos(v)} r={r + 5}
                                                    fill="none" stroke={dotColor} strokeWidth="1.5" opacity="0.5" />
                                            )}
                                            {/* Main dot */}
                                            <circle cx={xPos(i)} cy={yPos(v)} r={isHovered ? r + 2 : r}
                                                fill={dotColor} stroke="#0f172a" strokeWidth="1.5" />
                                        </g>
                                    );
                                })}

                                {/* X-axis labels: start, mid, end */}
                                {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
                                    <text key={i} x={xPos(i)} y={svgH - 6} textAnchor="middle"
                                        fill="#64748b" fontSize="11">{formatTime(i * bucketSize)}</text>
                                ))}
                            </svg>

                            {/* Hover tooltip — rendered as HTML overlay above the SVG */}
                            {hoveredDot && (
                                <div style={{
                                    position: "absolute",
                                    left: `clamp(0px, calc(${hoveredDot.xPct}% - 110px), calc(100% - 240px))`,
                                    top: `calc(${hoveredDot.yPct}% - 10px)`,
                                    transform: "translateY(-100%)",
                                    width: "240px",
                                    background: "#1e293b",
                                    border: "1px solid rgba(99,102,241,0.5)",
                                    borderRadius: "10px",
                                    padding: "10px 14px",
                                    pointerEvents: "none",
                                    zIndex: 10,
                                    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                                }}>
                                    {/* Arrow */}
                                    <div style={{
                                        position: "absolute",
                                        bottom: "-7px",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: 0, height: 0,
                                        borderLeft: "7px solid transparent",
                                        borderRight: "7px solid transparent",
                                        borderTop: "7px solid rgba(99,102,241,0.5)",
                                    }} />
                                    <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px" }}>
                                        {formatTime(hoveredDot.bucketIndex * bucketSize)}–{formatTime((hoveredDot.bucketIndex + 1) * bucketSize)}
                                        &nbsp;·&nbsp;{hoveredDot.count} filler{hoveredDot.count !== 1 ? "s" : ""}
                                    </div>
                                    {hoveredDot.entries.map((entry, i) => (
                                        <div key={i} style={{ marginBottom: i < hoveredDot.entries.length - 1 ? "8px" : 0 }}>
                                            <span style={{
                                                display: "inline-block",
                                                background: "rgba(239,68,68,0.2)",
                                                border: "1px solid rgba(239,68,68,0.4)",
                                                borderRadius: "4px",
                                                padding: "1px 6px",
                                                fontSize: "11px",
                                                color: "#fca5a5",
                                                marginBottom: "3px",
                                            }}>"{entry.word}" @ {formatTime(entry.secondsElapsed)}</span>
                                            {entry.snippet && (
                                                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
                                                    {/* Render snippet with filler word highlighted */}
                                                    {entry.snippet.split(" ").map((w, wi) => {
                                                        const isFillerWord = w.startsWith("__") && w.endsWith("__");
                                                        const display = w.replace(/^__|__$/g, "");
                                                        return isFillerWord ? (
                                                            <span key={wi} style={{ color: "#fbbf24", fontWeight: "bold" }}>{display} </span>
                                                        ) : (
                                                            <span key={wi}>{display} </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        );
                    })()}

                    {/* Legend */}
                    <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap" }}>
                        {[["#22c55e", "1 filler"], ["#f59e0b", "2 fillers"], ["#ef4444", "3+ fillers"], ["rgba(255,255,255,0.2)", "None"]].map(([color, label]) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <div style={{ width: "10px", height: "10px", background: color, borderRadius: "50%" }} />
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>{label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Occurrence list */}
                    <div style={{ marginTop: "16px" }}>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>All occurrences:</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {fillerTimeline.map((entry, i) => (
                                <span key={i} style={{
                                    background: "rgba(239,68,68,0.12)",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                    borderRadius: "4px",
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                    color: "#fca5a5"
                                }}>
                                    "{entry.word}" @ {formatTime(entry.secondsElapsed)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}




// ---- VOLUME GRAPH COMPONENT ----
function VolumeGraph({ volume }) {
    if (!volume || !volume.history || volume.history.length < 2) return null;

    const { history, quietThreshold, loudThreshold, sessionDuration } = volume;

    // Downsample to at most 300 points so the graph isn't overwhelmingly dense
    const MAX_PTS = 300;
    const step = Math.max(1, Math.floor(history.length / MAX_PTS));
    const pts = [];
    for (let i = 0; i < history.length; i += step) {
        pts.push(history[i]);
    }
    const n = pts.length;

    // Stats
    const avg = Math.round(pts.reduce((a, b) => a + b, 0) / n);
    const quietPct = Math.round((history.filter(v => v < quietThreshold).length / history.length) * 100);
    const loudPct  = Math.round((history.filter(v => v > loudThreshold).length  / history.length) * 100);
    const goodPct  = 100 - quietPct - loudPct;

    // Format seconds as mm:ss
    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    // SVG layout — normal volume (50) sits exactly at the vertical midpoint
    const svgW = 1000, svgH = 180;
    const padL = 36, padR = 16, padT = 16, padB = 28;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    // y=0 (volume 0) maps to bottom; y=100 (max volume) maps to top
    const xPos = (i) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
    const yPos = (v) => padT + chartH - (v / 100) * chartH;

    // Key reference lines in SVG coords
    const yMid    = yPos(50);               // "normal" volume line
    const yQuiet  = yPos(quietThreshold);   // Too Quiet threshold
    const yLoud   = yPos(loudThreshold);    // Too Loud threshold
    const yBottom = padT + chartH;
    const yTop    = padT;

    // Smooth cubic bezier path
    let linePath = `M ${xPos(0)},${yPos(pts[0])}`;
    for (let i = 0; i < n - 1; i++) {
        const cpx = (xPos(i + 1) - xPos(i)) * 0.4;
        linePath += ` C ${xPos(i) + cpx},${yPos(pts[i])} ${xPos(i + 1) - cpx},${yPos(pts[i + 1])} ${xPos(i + 1)},${yPos(pts[i + 1])}`;
    }

    // Area under line
    const areaPath = `M ${xPos(0)},${yBottom} L ${xPos(0)},${yPos(pts[0])} ${linePath.slice(linePath.indexOf("C"))} L ${xPos(n - 1)},${yBottom} Z`;

    // Y-axis ticks: 0, quiet threshold, 50 (normal), loud threshold, 100
    const yTicks = [
        { v: 0,               label: "0" },
        { v: quietThreshold,  label: `${quietThreshold} quiet` },
        { v: 50,              label: "50 normal" },
        { v: loudThreshold,   label: `${loudThreshold} loud` },
        { v: 100,             label: "100" },
    ];

    // X-axis labels: start, quarter, mid, three-quarter, end
    const xLabelIdxs = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
    const secondsPerSample = sessionDuration / history.length * step;

    return (
        <div style={{ marginTop: "40px" }}>
            <h2 style={{ color: "white" }}>🔊 Volume Analysis</h2>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "12px", marginTop: "15px", flexWrap: "wrap" }}>
                {[
                    { label: "Avg Volume", value: avg, color: avg < quietThreshold ? "#f59e0b" : avg > loudThreshold ? "#ef4444" : "#22c55e" },
                    { label: "Too Quiet", value: `${quietPct}%`, color: "#f59e0b" },
                    { label: "Good Volume", value: `${goodPct}%`, color: "#22c55e" },
                    { label: "Too Loud", value: `${loudPct}%`, color: "#ef4444" },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ ...cardStyle, flex: 1, textAlign: "center", minWidth: "100px", padding: "16px" }}>
                        <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "26px", fontWeight: "bold", color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Line graph */}
            <div style={{ ...cardStyle, marginTop: "16px" }}>
                <h4 style={{ color: "white", marginTop: 0, marginBottom: "6px" }}>Volume Over Time</h4>
                <p style={{ color: "#64748b", fontSize: "12px", marginTop: 0, marginBottom: "12px" }}>
                    Normal volume sits at the midline (50). Dashed lines mark quiet and loud thresholds.
                </p>

                <svg viewBox={`0 0 ${svgW} ${svgH}`}
                    style={{ width: "100%", height: "200px", display: "block" }}
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="volAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                        </linearGradient>
                        <filter id="volGlow">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    {/* Coloured zone bands */}
                    {/* Too Quiet zone — below quietThreshold */}
                    <rect x={padL} y={yQuiet} width={chartW} height={yBottom - yQuiet}
                        fill="rgba(245,158,11,0.06)" />
                    {/* Good zone — between quietThreshold and loudThreshold */}
                    <rect x={padL} y={yLoud} width={chartW} height={yQuiet - yLoud}
                        fill="rgba(34,197,94,0.05)" />
                    {/* Too Loud zone — above loudThreshold */}
                    <rect x={padL} y={yTop} width={chartW} height={yLoud - yTop}
                        fill="rgba(239,68,68,0.06)" />

                    {/* Y-axis gridlines + labels */}
                    {yTicks.map(({ v, label }) => {
                        const y = yPos(v);
                        const isMid      = v === 50;
                        const isThreshold = v === quietThreshold || v === loudThreshold;
                        return (
                            <g key={v}>
                                <line x1={padL} y1={y} x2={svgW - padR} y2={y}
                                    stroke={isMid ? "rgba(255,255,255,0.25)" : isThreshold ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
                                    strokeWidth={isMid ? 1.5 : 1}
                                    strokeDasharray={isMid ? "6 3" : isThreshold ? "3 3" : "2 4"} />
                                <text x={padL - 6} y={y + 4} textAnchor="end"
                                    fill={isMid ? "#94a3b8" : "#4b5563"} fontSize="10">{label}</text>
                            </g>
                        );
                    })}

                    {/* Area fill */}
                    <path d={areaPath} fill="url(#volAreaGrad)" />

                    {/* Glow line */}
                    <path d={linePath} fill="none" stroke="#818cf8" strokeWidth="4"
                        strokeLinecap="round" filter="url(#volGlow)" opacity="0.45" />

                    {/* Main line */}
                    <path d={linePath} fill="none" stroke="#6366f1"
                        strokeWidth="2.5" strokeLinecap="round" />

                    {/* Normal midline label */}
                    <text x={svgW - padR - 2} y={yMid - 4} textAnchor="end"
                        fill="rgba(255,255,255,0.35)" fontSize="9">normal</text>

                    {/* X-axis labels */}
                    {xLabelIdxs.map((i) => (
                        <text key={i} x={xPos(Math.min(i, n - 1))} y={svgH - 6}
                            textAnchor="middle" fill="#64748b" fontSize="10">
                            {formatTime(Math.round(i * secondsPerSample))}
                        </text>
                    ))}
                </svg>

                {/* Zone legend */}
                <div style={{ display: "flex", gap: "20px", marginTop: "10px", flexWrap: "wrap" }}>
                    {[
                        ["rgba(239,68,68,0.3)",  "#fca5a5", "Too Loud"],
                        ["rgba(34,197,94,0.2)",  "#86efac", "Good Volume"],
                        ["rgba(245,158,11,0.3)", "#fcd34d", "Too Quiet"],
                    ].map(([bg, text, label]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", background: bg, borderRadius: "3px" }} />
                            <span style={{ color: text, fontSize: "12px" }}>{label}</span>
                        </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "20px", height: "2px", background: "rgba(255,255,255,0.25)", borderTop: "1.5px dashed rgba(255,255,255,0.25)" }} />
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Normal midline (50)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---- MAIN DASHBOARD ----
function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();

    const data = location.state;

    if (!data) {
        return (
            <div style={{ padding: "60px", textAlign: "center" }}>
                <h2>No session data found.</h2>
                <button onClick={() => navigate("/")}>Back Home</button>
            </div>
        );
    }

    const { summary, fluency, pacing, overall, feedback, volume } = data;

    return (
        <div style={{ padding: "60px", background: "#0f172a", minHeight: "100vh", color: "white", fontFamily: "Arial" }}>
            <h1 style={{ textAlign: "center", color: "#86858e" }}>Session Analytics</h1>

            {/* OVERALL SCORE */}
            <div style={{ textAlign: "center", marginTop: "40px", padding: "30px", borderRadius: "12px", background: "rgba(255,255,255,0.05)" }}>
                <h2>Overall Score</h2>
                <h1 style={{ fontSize: "60px", color: "#ffffff" }}>{overall?.overallScore}</h1>
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

            {/* FLUENCY ANALYZER */}
            <FluencyAnalyzer fluency={fluency} summary={summary} />

            {/* VOLUME ANALYSIS */}
            <VolumeGraph volume={volume} />

            {/* PACING */}
            <div style={{ marginTop: "40px" }}>
                <h2>Pacing Analysis</h2>
                <div style={cardStyle}>
                    <p>Speaking Speed: {pacing?.wpm} WPM</p>
                    <p>Ideal Range: 90-160 WPM</p>
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
                    style={{ padding: "15px 30px", fontSize: "16px", background: "#6C63FF", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
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