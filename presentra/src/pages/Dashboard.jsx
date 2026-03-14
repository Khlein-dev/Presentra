import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ---- FLUENCY ANALYZER COMPONENT ----
function FluencyAnalyzer({ fluency, summary }) {
    const [hoveredDot, setHoveredDot] = useState(null);

    if (!fluency) return null;

    const { fillerRate, fillerBreakdown, fluencyScore, fillerTimeline, sessionDuration, excludedFillers } = fluency;

    const scoreColor = fluencyScore >= 80 ? "#22c55e" : fluencyScore >= 50 ? "#f59e0b" : "#ef4444";

    // Always exactly 10 buckets
    const TOTAL_BUCKETS = 10;
    const bucketSize = Math.max(1, Math.ceil((sessionDuration || 60) / TOTAL_BUCKETS));
    const buckets = Array(TOTAL_BUCKETS).fill(0);

    (fillerTimeline || []).forEach(entry => {
        const bucketIndex = Math.min(Math.floor(entry.secondsElapsed / bucketSize), TOTAL_BUCKETS - 1);
        buckets[bucketIndex]++;
    });

    const maxBucket = Math.max(...buckets, 1);

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
                            <p style={{ fontSize: "24px", fontWeight: "bold", color: "white", margin: 0 }}>{fluency.fillerCount}</p>
                        </div>
                        <div>
                            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" }}>Filler Rate</p>
                            <p style={{ fontSize: "24px", fontWeight: "bold", color: "white", margin: 0 }}>{fillerRate}%</p>
                            <p style={{ color: "#64748b", fontSize: "11px", margin: 0 }}>of total words spoken</p>
                        </div>
                        <div>
                            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" }}>Rating</p>
                            <p style={{ fontSize: "18px", fontWeight: "bold", margin: 0, color: scoreColor }}>
                                {fluency.fillerCount === 0 ? "🏆 Flawless" : fluency.fillerCount <= 5 ? "✅ Great" : fluency.fillerCount <= 10 ? "⚠️ Fair" : "❌ Needs Work"}
                            </p>
                        </div>
                    </div>

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
                                const pct = Math.round((count / fluency.fillerCount) * 100);
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

            {/* Timeline — always 10 buckets */}
            {fillerTimeline && fillerTimeline.length > 0 && (
                <div style={{ ...cardStyle, marginTop: "16px" }}>
                    <h4 style={{ color: "white", marginTop: 0, marginBottom: "6px" }}>Filler Word Timeline</h4>
                    <p style={{ color: "#64748b", fontSize: "12px", marginTop: 0, marginBottom: "16px" }}>
                        Session split into 10 equal segments. Height shows filler density per segment.
                    </p>

                    {(() => {
                        const svgW = 1000, svgH = 160;
                        const padL = 32, padR = 16, padT = 16, padB = 28;
                        const chartW = svgW - padL - padR;
                        const chartH = svgH - padT - padB;
                        const n = TOTAL_BUCKETS; // always 10

                        const xPos = (i) => padL + (i / (n - 1)) * chartW;
                        const yPos = (v) => padT + chartH - (v / maxBucket) * chartH;

                        // Smooth cubic bezier path
                        const smoothLinePath = () => {
                            let d = `M ${xPos(0)},${yPos(buckets[0])}`;
                            for (let i = 0; i < n - 1; i++) {
                                const x0 = xPos(i),     y0 = yPos(buckets[i]);
                                const x1 = xPos(i + 1), y1 = yPos(buckets[i + 1]);
                                const cpx = (x1 - x0) * 0.4;
                                d += ` C ${x0 + cpx},${y0} ${x1 - cpx},${y1} ${x1},${y1}`;
                            }
                            return d;
                        };

                        const linePath = smoothLinePath();
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

                                    {/* Y-axis gridlines */}
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

                                    {/* Vertical segment dividers */}
                                    {Array.from({ length: n - 1 }, (_, i) => (
                                        <line
                                            key={i}
                                            x1={xPos(i + 1)} y1={padT}
                                            x2={xPos(i + 1)} y2={padT + chartH}
                                            stroke="rgba(255,255,255,0.05)"
                                            strokeWidth="1"
                                        />
                                    ))}

                                    {/* Area fill */}
                                    <path d={areaPath} fill="url(#lineAreaGrad)" />

                                    {/* Glow line */}
                                    <path d={linePath} fill="none"
                                        stroke="#818cf8" strokeWidth="4" strokeLinecap="round"
                                        filter="url(#glowFilter)" opacity="0.5" />

                                    {/* Main line */}
                                    <path d={linePath} fill="none"
                                        stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

                                    {/* Dots */}
                                    {buckets.map((v, i) => {
                                        const dotColor = v === 0 ? "rgba(255,255,255,0.15)" : v >= 3 ? "#ef4444" : v === 2 ? "#f59e0b" : "#22c55e";
                                        const r = v === 0 ? 3 : 5;
                                        const isHovered = hoveredDot?.bucketIndex === i;

                                        const bucketEntries = (fillerTimeline || []).filter(e =>
                                            Math.min(Math.floor(e.secondsElapsed / bucketSize), TOTAL_BUCKETS - 1) === i
                                        );

                                        return (
                                            <g key={i}
                                                onMouseEnter={(e) => {
                                                    if (v > 0) {
                                                        const svgEl = e.currentTarget.closest("svg");
                                                        const svgPt = svgEl.createSVGPoint();
                                                        svgPt.x = e.clientX;
                                                        svgPt.y = e.clientY;
                                                        const pt = svgPt.matrixTransform(svgEl.getScreenCTM().inverse());
                                                        setHoveredDot({
                                                            bucketIndex: i,
                                                            xPct: (pt.x / svgW) * 100,
                                                            yPct: (pt.y / svgH) * 100,
                                                            entries: bucketEntries,
                                                            count: v
                                                        });
                                                    }
                                                }}
                                                onMouseLeave={() => setHoveredDot(null)}
                                                style={{ cursor: v > 0 ? "pointer" : "default" }}
                                            >
                                                <circle cx={xPos(i)} cy={yPos(v)} r="12" fill="transparent" />
                                                {isHovered && (
                                                    <circle cx={xPos(i)} cy={yPos(v)} r={r + 5}
                                                        fill="none" stroke={dotColor} strokeWidth="1.5" opacity="0.5" />
                                                )}
                                                <circle cx={xPos(i)} cy={yPos(v)} r={isHovered ? r + 2 : r}
                                                    fill={dotColor} stroke="#0f172a" strokeWidth="1.5" />
                                            </g>
                                        );
                                    })}

                                    {/* X-axis: all 10 segment labels */}
                                    {buckets.map((_, i) => (
                                        <text key={i} x={xPos(i)} y={svgH - 6} textAnchor="middle"
                                            fill="#64748b" fontSize="10">
                                            {formatTime(i * bucketSize)}
                                        </text>
                                    ))}
                                </svg>

                                {/* Hover tooltip */}
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
                                        <div style={{
                                            position: "absolute", bottom: "-7px", left: "50%",
                                            transform: "translateX(-50%)", width: 0, height: 0,
                                            borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
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


// ---- VOLUME GRAPH COMPONENT — Fluid smooth waveform ----
function VolumeGraph({ volume }) {
    if (!volume || !volume.history || volume.history.length < 2) return null;

    const quietThreshold = 35;
    const loudThreshold  = 90;
    const { history, sessionDuration } = volume;

    // Downsample to ~120 points — enough detail, smooth enough to bezier nicely
    const MAX_PTS = 120;
    const step = Math.max(1, Math.floor(history.length / MAX_PTS));
    const pts = [];
    for (let i = 0; i < history.length; i += step) {
        pts.push(history[i]);
    }

    // Apply a simple moving-average smoothing pass (window = 5)
    const smooth = (arr, w = 5) => arr.map((_, i) => {
        const slice = arr.slice(Math.max(0, i - w), i + w + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
    const smoothed = smooth(pts);
    const n = smoothed.length;

    // Stats (calculated from the same smoothed+downsampled data as the waveform)
    const avg      = Math.round(smoothed.reduce((a, b) => a + b, 0) / n);
    const quietPct = Math.round((smoothed.filter(v => v < quietThreshold).length / n) * 100);
    const loudPct  = Math.round((smoothed.filter(v => v > loudThreshold).length  / n) * 100);
    const goodPct  = 100 - quietPct - loudPct;

    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    // SVG layout
    const svgW = 1000, svgH = 200;
    const padL = 8, padR = 8, padT = 16, padB = 28;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;
    const midY   = padT + chartH / 2;
    const halfMax = chartH / 2;

    // Map a volume value to a half-amplitude in SVG units
    const amp = (v) => Math.max(1, (v / 100) * halfMax);

    // X position for point i
    const xAt = (i) => padL + (i / (n - 1)) * chartW;

    // Top envelope: left to right, above midY
    const topPts    = smoothed.map((v, i) => ({ x: xAt(i), y: midY - amp(v) }));
    // Bottom envelope: left to right, below midY
    const bottomPts = smoothed.map((v, i) => ({ x: xAt(i), y: midY + amp(v) }));

    // Build a smooth cubic bezier open path through an array of {x,y} points
    const bezierPath = (pts) => {
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cpx = (pts[i + 1].x - pts[i].x) * 0.45;
            d += ` C ${pts[i].x + cpx},${pts[i].y} ${pts[i + 1].x - cpx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
        }
        return d;
    };

    // Closed filled shape:
    // 1. Draw top envelope left→right
    // 2. Line to bottom-right corner of bottom envelope
    // 3. Draw bottom envelope right→left (reversed)
    // 4. Close back to top-left
    const topPath       = bezierPath(topPts);
    const bottomPathStr = bezierPath(bottomPts);
    const bottomPtsRev  = [...bottomPts].reverse();
    const bottomRevPath = bezierPath(bottomPtsRev); // right→left bottom path

    // fullPath: top curve + drop to bottom-right + bottom curve right→left + close
    const fullPath = topPath
        + ` L ${bottomPts[n - 1].x},${bottomPts[n - 1].y}`
        + bottomRevPath.substring(bottomRevPath.indexOf(" "))  // strip leading "M x,y", keep " C ..."
        + " Z";

    // Threshold lines use the same amp() function as the waveform
    // so they sit exactly where a bar of that volume value would reach
    const yLoudOff  = amp(loudThreshold);
    const yQuietOff = amp(quietThreshold);

    // X-axis labels at 5 positions
    const xLabelIdxs    = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
    const secondsPerPt  = (sessionDuration / history.length) * step;

    // Waveform matches fluency graph color — indigo #6366f1
    const waveColor = "#6366f1";
    const waveGlow  = "rgba(99,102,241,0.15)";

    // Stats row color still reflects avg zone
    const dominantColor = avg < quietThreshold ? "#f59e0b" : avg > loudThreshold ? "#ef4444" : "#22c55e";

    return (
        <div style={{ marginTop: "40px" }}>
            <h2 style={{ color: "white" }}>🔊 Volume Analysis</h2>

            {/* Stats row — unchanged */}
            <div style={{ display: "flex", gap: "12px", marginTop: "15px", flexWrap: "wrap" }}>
                {[
                    { label: "Avg Volume", value: avg,            color: dominantColor },
                    { label: "Too Quiet",  value: `${quietPct}%`, color: "#f59e0b" },
                    { label: "Good Volume",value: `${goodPct}%`,  color: "#22c55e" },
                    { label: "Too Loud",   value: `${loudPct}%`,  color: "#ef4444" },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ ...cardStyle, flex: 1, textAlign: "center", minWidth: "100px", padding: "16px" }}>
                        <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "26px", fontWeight: "bold", color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Waveform */}
            <div style={{ ...cardStyle, marginTop: "16px" }}>
                <h4 style={{ color: "white", marginTop: 0, marginBottom: "6px" }}>Volume Over Time</h4>
                <p style={{ color: "#64748b", fontSize: "12px", marginTop: 0, marginBottom: "12px" }}>
                    Fluid waveform — grows symmetrically from the center axis. Color reflects average volume zone.
                </p>

                <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    style={{ width: "100%", height: "200px", display: "block" }}
                    preserveAspectRatio="none"
                >
                    <defs>
                        {/* Vertical gradient: very translucent indigo fill */}
                        <linearGradient id="waveBodyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={waveColor} stopOpacity="0.02" />
                            <stop offset="40%"  stopColor={waveColor} stopOpacity="0.12" />
                            <stop offset="50%"  stopColor={waveColor} stopOpacity="0.15" />
                            <stop offset="60%"  stopColor={waveColor} stopOpacity="0.12" />
                            <stop offset="100%" stopColor={waveColor} stopOpacity="0.02" />
                        </linearGradient>
                        <filter id="waveGlow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Too Loud zone — above loud threshold line, top and bottom */}
                    <rect x={padL} y={padT}
                        width={chartW} height={Math.max(0, midY - yLoudOff - padT)}
                        fill="rgba(239,68,68,0.06)" />
                    <rect x={padL} y={midY + yLoudOff}
                        width={chartW} height={Math.max(0, padT + chartH - (midY + yLoudOff))}
                        fill="rgba(239,68,68,0.06)" />

                    {/* Center axis */}
                    <line x1={padL} y1={midY} x2={svgW - padR} y2={midY}
                        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                    {/* Loud threshold lines */}
                    <line x1={padL} y1={midY - yLoudOff} x2={svgW - padR} y2={midY - yLoudOff}
                        stroke="rgba(239,68,68,0.8)" strokeWidth="1" strokeDasharray="6 3" />
                    <line x1={padL} y1={midY + yLoudOff} x2={svgW - padR} y2={midY + yLoudOff}
                        stroke="rgba(239,68,68,0.8)" strokeWidth="1" strokeDasharray="6 3" />

                    {/* Quiet threshold lines */}
                    <line x1={padL} y1={midY - yQuietOff} x2={svgW - padR} y2={midY - yQuietOff}
                        stroke="rgba(245,158,11,0.8)" strokeWidth="1" strokeDasharray="6 3" />
                    <line x1={padL} y1={midY + yQuietOff} x2={svgW - padR} y2={midY + yQuietOff}
                        stroke="rgba(245,158,11,0.8)" strokeWidth="1" strokeDasharray="6 3" />

                    {/* Threshold labels — right edge, above their respective lines */}
                    <text x={svgW - padR - 4} y={midY - yLoudOff - 5} textAnchor="end"
                        fill="rgba(239,68,68,0.9)" fontSize="9" fontWeight="600">Too Loud ({loudThreshold})</text>
                    <text x={svgW - padR - 4} y={midY - yQuietOff - 5} textAnchor="end"
                        fill="rgba(245,158,11,0.9)" fontSize="9" fontWeight="600">Too Quiet ({quietThreshold})</text>

                    {/* Glow layer */}
                    <path d={fullPath} fill={waveGlow} filter="url(#waveGlow)" opacity="0.5" />

                    {/* Main filled waveform body — translucent */}
                    <path d={fullPath} fill="url(#waveBodyGrad)" />

                    {/* Top + bottom edge strokes */}
                    <path d={topPath} fill="none"
                        stroke={waveColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
                    <path d={bottomPathStr} fill="none"
                        stroke={waveColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />

                    {/* X-axis labels */}
                    {xLabelIdxs.map((i) => (
                        <text key={i}
                            x={xAt(Math.min(i, n - 1))}
                            y={svgH - 6}
                            textAnchor="middle" fill="#64748b" fontSize="10">
                            {formatTime(Math.round(i * secondsPerPt))}
                        </text>
                    ))}
                </svg>

                {/* Zone legend */}
                <div style={{ display: "flex", gap: "20px", marginTop: "10px", flexWrap: "wrap" }}>
                    {[
                        ["rgba(239,68,68,0.7)",  "#fca5a5", `Too Loud (> ${loudThreshold})`],
                        ["rgba(34,197,94,0.7)",  "#86efac", `Good Volume (${quietThreshold}–${loudThreshold})`],
                        ["rgba(245,158,11,0.7)", "#fcd34d", `Too Quiet (< ${quietThreshold})`],
                    ].map(([bg, text, label]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", background: bg, borderRadius: "3px" }} />
                            <span style={{ color: text, fontSize: "12px" }}>{label}</span>
                        </div>
                    ))}
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
                    <p>Ideal Range: 90-160 WPM</p>
                    <p>Pace Score: {pacing?.paceScore}</p>
                </div>
            </div>

            {/* FLUENCY ANALYZER */}
            <FluencyAnalyzer fluency={fluency} summary={summary} />

            {/* VOLUME ANALYSIS */}
            <VolumeGraph volume={volume} />

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