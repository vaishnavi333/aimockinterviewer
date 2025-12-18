// Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// --- helpers ---
const fmtDateTime = (dt) => {
  try { return new Date(dt).toLocaleString(); } catch { return ""; }
};
const cap1 = (s) => (typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s);
const to1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);

// neutral greys for charts
const GREY = "#6b7280";
const GREY_LIGHT = "#94a3b8";
// keep your original grey palette
const PIE_GREYS = ["#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6"];

/**
 * Evenly sample across PIE_GREYS, but avoid the two palest tones so nothing
 * looks white on a white background.
 */
const pickFromGreys = (i, n) => {
  const minIdx = 0;
  const maxIdx = Math.max(PIE_GREYS.length - 3, 0);
  const denom = Math.max(n - 1, 1);
  const pos = Math.round(minIdx + ((maxIdx - minIdx) * i) / denom);
  return PIE_GREYS[pos];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const initialSessionId = state?.session_id || null;

  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(initialSessionId); // null => summary view
  const [turns, setTurns] = useState([]);       // turns for active session
  const [allTurns, setAllTurns] = useState([]); // turns across all sessions (for summary)
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // logout -> clear and go to Welcome ("/")
  const handleLogout = () => {
    try {
      localStorage.removeItem("email");
      localStorage.removeItem("userId");
      localStorage.removeItem("token");
      localStorage.removeItem("session_id");
    } catch {}
    navigate("/", { replace: true });
  };

  // --- load & normalize session list (for the current user only) ---
  useEffect(() => {
    (async () => {
      // identity
      const storedUserId = (localStorage.getItem("userId") || "").trim();
      const storedEmail  = (localStorage.getItem("email") || "").trim().toLowerCase();

      if (!storedUserId && !storedEmail) {
        // no identity -> go back to Welcome/Login
        navigate("/", { replace: true });
        return;
      }

      const qp = storedUserId
        ? `userId=${encodeURIComponent(storedUserId)}`
        : `email=${encodeURIComponent(storedEmail)}`;
      const url = `${API}/session/list?${qp}`;

      let raw = [];
      try {
        const r = await axios.get(url);
        raw = r.data || [];
      } catch (e) {
        console.error("Failed to load sessions:", e);
      }

      // de-dupe by sessionId and pick most recent createdAt/startedAt
      const map = new Map();
      for (const s of raw) {
        const sessionId = s.sessionId;
        if (!sessionId) continue;
        const item = {
          sessionId,
          createdAt: s.createdAt || s.startedAt,
          company: cap1(s.company || "—"),
          role: s.role || "",
          level: s.level || "",
          overallScore: s.overallScore ?? null,
        };
        const prev = map.get(sessionId);
        if (
          !prev ||
          (item.createdAt &&
            prev.createdAt &&
            new Date(item.createdAt) > new Date(prev.createdAt))
        ) {
          map.set(sessionId, item);
        }
      }

      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setSessions(list);

      // default to summary if no explicit session_id was passed
      if (!initialSessionId) setActiveId(null);
    })();
  }, [initialSessionId, navigate]);

  // --- load turns for the active session ---
  useEffect(() => {
    if (!activeId) { setTurns([]); return; }
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/session/${activeId}/summary`);
        const t = (r.data?.turns || []).map((x) => ({
          sessionId: activeId,
          index: x.index,
          question: x.question,
          userAnswer: x.userAnswer,
          feedback: x.feedback,
          score: typeof x.score === "number" ? x.score : null,
          createdAt: x.createdAt,
          // NEW: metrics (may be undefined for older sessions)
          metrics: x.metrics || null,
        }));
        setTurns(t);
      } catch (e) {
        console.error("Failed to load session summary:", e);
        setTurns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeId]);

  // --- load ALL turns (for summary view) once sessions are known ---
  useEffect(() => {
    if (!sessions.length) { setAllTurns([]); return; }
    (async () => {
      setLoadingSummary(true);
      try {
        const results = await Promise.allSettled(
          sessions.map((s) => axios.get(`${API}/session/${s.sessionId}/summary`))
        );
        const merged = [];
        results.forEach((res, i) => {
          const sess = sessions[i];
          if (res.status === "fulfilled") {
            (res.value.data?.turns || []).forEach((t) => {
              merged.push({
                sessionId: sess.sessionId,
                index: t.index,
                score: typeof t.score === "number" ? t.score : null,
                createdAt: t.createdAt,
                // NEW: carry metrics for global summary
                metrics: t.metrics || null,
              });
            });
          }
        });
        setAllTurns(merged);
      } catch (e) {
        console.error("Failed loading all summaries:", e);
        setAllTurns([]);
      } finally {
        setLoadingSummary(false);
      }
    })();
  }, [sessions]);

  // single declaration (prevents "Identifier 'active'..." error)
  const activeSession = useMemo(
    () => (activeId ? sessions.find((s) => s.sessionId === activeId) || null : null),
    [sessions, activeId]
  );

  // --- overall (session) ---
  const overall = useMemo(() => {
    if (!activeId) return null;
    if (activeSession?.overallScore != null) return activeSession.overallScore;
    const nums = turns.map((t) => t.score).filter((n) => typeof n === "number");
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Math.round(avg * 10) / 10;
  }, [activeId, activeSession, turns]);

  // --- charts (per-session) ---
  const barData = turns.map((t) => ({ name: `Q${t.index + 1}`, score: t.score ?? 0 }));
  const radarData = barData.length ? barData : [{ name: "Q1", score: 0 }];

  const buckets = { low: 0, mid: 0, high: 0 };
  turns.forEach((t) => {
    if (typeof t.score !== "number") return;
    if (t.score <= 4) buckets.low += 1;
    else if (t.score <= 7) buckets.mid += 1;
    else buckets.high += 1;
  });
  const pieData = [
    { name: "0–4", value: buckets.low },
    { name: "5–7", value: buckets.mid },
    { name: "8–10", value: buckets.high },
  ];

  // ---- NEW: per-session metric averages (current session only) ----
  const sessionMetricAvg = useMemo(() => {
    const vals = { tech: [], comp: [], clar: [], tone: [] };
    turns.forEach((t) => {
      const m = t.metrics;
      if (!m) return;
      if (typeof m.technical_correctness === "number") vals.tech.push(m.technical_correctness);
      if (typeof m.completeness === "number") vals.comp.push(m.completeness);
      if (typeof m.clarity === "number") vals.clar.push(m.clarity);
      if (typeof m.tone === "number") vals.tone.push(m.tone);
    });
    const avg = (arr) => (arr.length ? to1(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    return {
      technical_correctness: avg(vals.tech),
      completeness: avg(vals.comp),
      clarity: avg(vals.clar),
      tone: avg(vals.tone),
    };
  }, [turns]);

  // --- summary metrics (all sessions) ---
  const summary = useMemo(() => {
    const setCompanies = new Set(sessions.map((s) => s.company).filter(Boolean));
    const setRoles = new Set(sessions.map((s) => s.role).filter(Boolean));
    const setLevels = new Set(sessions.map((s) => s.level).filter(Boolean));

    const scores = allTurns.map((t) => t.score).filter((n) => typeof n === "number");
    const avgAll = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    // per-session aggregates (avg score, questions, date, labels)
    const perSession = sessions.map((s) => {
      const ts = allTurns.filter((t) => t.sessionId === s.sessionId && typeof t.score === "number");
      const avg = ts.length ? Math.round((ts.reduce((a, b) => a + b.score, 0) / ts.length) * 10) / 10 : 0;
      const dateObj = s.createdAt ? new Date(s.createdAt) : null;
      const dateLabel = dateObj ? dateObj.toLocaleDateString() : "";
      return {
        name: s.company,
        abbrev: `${(s.company || "—").slice(0, 8)}${(s.company || "").length > 8 ? "…" : ""}`,
        score: avg,
        date: dateObj,
        dateLabel,
        questions: ts.length,
      };
    });

    // line: score over time (by session date)
    const lineSeries = perSession
      .filter((x) => x.date)
      .sort((a, b) => a.date - b.date)
      .map((x) => ({ x: x.date, y: x.score, name: x.abbrev }));

    // pie: roles distribution
    const roleCounts = {};
    sessions.forEach((s) => {
      const key = s.role || "—";
      roleCounts[key] = (roleCounts[key] || 0) + 1;
    });
    const rolePie = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

    // bar: companies practiced (count)
    const companyCounts = {};
    sessions.forEach((s) => {
      const key = s.company || "—";
      companyCounts[key] = (companyCounts[key] || 0) + 1;
    });
    const companyBar = Object.entries(companyCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // keep around for other uses
    const scoreBySession = perSession
      .filter((x) => x.date)
      .sort((a, b) => a.date - b.date)
      .map((x) => ({
        label: `${x.name} • ${x.dateLabel}`,
        score: x.score,
      }));

    // average score by company across ALL sessions
    const companyScoreAgg = {};
    sessions.forEach((s) => {
      const key = s.company || "—";
      const ts = allTurns.filter((t) => t.sessionId === s.sessionId && typeof t.score === "number");
      if (!ts.length) return;
      const avg = ts.reduce((a, b) => a + b.score, 0) / ts.length;
      if (!companyScoreAgg[key]) companyScoreAgg[key] = { sum: 0, n: 0 };
      companyScoreAgg[key].sum += avg;
      companyScoreAgg[key].n += 1;
    });
    const avgByCompany = Object.entries(companyScoreAgg)
      .map(([name, { sum, n }]) => ({ name, score: Math.round((sum / n) * 10) / 10 }))
      .sort((a, b) => b.score - a.score);

    // recent list for text cards
    const recent = sessions
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((s) => {
        const ts = allTurns.filter(
          (t) => t.sessionId === s.sessionId && typeof t.score === "number"
        );
        const score = ts.length
          ? (ts.reduce((a, b) => a + b.score, 0) / ts.length).toFixed(1)
          : "—";
        return {
          company: s.company,
          level: s.level || "—",
          role: s.role || "—",
          score,
          date: s.createdAt,
        };
      });

    // ---- NEW: overall metrics across ALL questions in ALL sessions ----
    const mVals = { tech: [], comp: [], clar: [], tone: [] };
    allTurns.forEach((t) => {
      const m = t.metrics;
      if (!m) return;
      if (typeof m.technical_correctness === "number") mVals.tech.push(m.technical_correctness);
      if (typeof m.completeness === "number") mVals.comp.push(m.completeness);
      if (typeof m.clarity === "number") mVals.clar.push(m.clarity);
      if (typeof m.tone === "number") mVals.tone.push(m.tone);
    });
    const avg = (arr) => (arr.length ? to1(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    const overallMetrics = {
      technical_correctness: avg(mVals.tech),
      completeness: avg(mVals.comp),
      clarity: avg(mVals.clar),
      tone: avg(mVals.tone),
    };

    return {
      totalSessions: sessions.length,
      totalQuestions: allTurns.length,
      companies: setCompanies.size,
      roles: setRoles.size,
      levels: setLevels.size,
      avgAll,
      perSession,
      lineSeries,
      rolePie,
      companyBar,
      scoreBySession,
      avgByCompany,
      recent,
      overallMetrics, // NEW
    };
  }, [sessions, allTurns]);

  const heading =
    activeId && activeSession
      ? `${activeSession.company} — ${activeSession.role || "Interview"}${activeSession.level ? ` (${activeSession.level})` : ""}`
      : "All Interviews";

  return (
    <div className="dash-wrap">
      {/* LEFT: history */}
      <aside className="dash-left">
        <div className="dash-header">
          <h2>Sessions</h2>
          <button className="new-btn" onClick={() => navigate("/select-role")}>New</button>
        </div>

        <ul className="session-list">
          {/* Summary item */}
          <li
            className={`session-item ${!activeId ? "active" : ""}`}
            onClick={() => setActiveId(null)}
            title="Summary of all interviews"
          >
            <div className="item-title">All Sessions</div>
            <div className="item-sub">Overview</div>
            <div className="item-meta">
              <span>{summary.totalSessions} sessions</span>
              <span className="dot">•</span>
              <span>{summary.totalQuestions} questions</span>
            </div>
          </li>

          {sessions.map((s) => (
            <li
              key={s.sessionId}
              className={`session-item ${activeId === s.sessionId ? "active" : ""}`}
              onClick={() => setActiveId(s.sessionId)}
            >
              <div className="item-title">{s.company}</div>
              <div className="item-sub">
                {s.role || "—"} {s.level ? ` — ${s.level}` : ""}
              </div>
              <div className="item-meta">
                <span>{fmtDateTime(s.createdAt)}</span>
                {s.overallScore != null && (
                  <>
                    <span className="dot">•</span>
                    <span className="meta-score">Overall {s.overallScore}/10</span>
                  </>
                )}
              </div>
            </li>
          ))}
          {!sessions.length && <li className="empty">No sessions yet.</li>}
        </ul>
      </aside>

      {/* RIGHT: dashboard */}
      <main className="dash-main">
        <div className="topbar">
          <div className="title-block">
            <h1>{heading}</h1>
            {activeId && activeSession?.createdAt && (
              <div className="subtitle">Interviewed on: {fmtDateTime(activeSession.createdAt)}</div>
            )}
          </div>

          <div className="actions">
            <button className="ghost-btn" onClick={() => navigate("/select-role")}>
              Try another interview
            </button>
            <button className="ghost-btn" onClick={handleLogout}>Log out</button>
          </div>

          {activeId && overall != null && (
            <div className="overall-pill">Overall: {overall}/10</div>
          )}
          {!activeId && summary.avgAll != null && (
            <div className="overall-pill">Average: {summary.avgAll}/10</div>
          )}
        </div>

        {/* SUMMARY VIEW */}
        {!activeId ? (
          loadingSummary ? (
            <div className="loader">Loading summary…</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat"><div className="k">{summary.totalSessions}</div><div className="l">Sessions</div></div>
                <div className="stat"><div className="k">{summary.totalQuestions}</div><div className="l">Questions Answered</div></div>
                <div className="stat"><div className="k">{summary.companies}</div><div className="l">Companies Practiced</div></div>
                <div className="stat"><div className="k">{summary.roles}</div><div className="l">Roles Practiced</div></div>
                <div className="stat"><div className="k">{summary.levels}</div><div className="l">Levels Practiced</div></div>
              </div>

              <div className="cards-grid">
                {/* Average Score by Company */}
                <div className="card">
                  <div className="card-title">Average Score by Company</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summary.avgByCompany}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0,10]} ticks={[0,2,4,6,8,10]} />
                        <Tooltip />
                        <Bar dataKey="score" fill={GREY} stroke={GREY} radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Roles Practiced — pie */}
                <div className="card">
                  <div className="card-title">Roles Practiced</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={summary.rolePie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {summary.rolePie.map((_, i, arr) => (
                            <Cell key={i} fill={pickFromGreys(i, arr.length)} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Companies Practiced (count) */}
                <div className="card">
                  <div className="card-title">Companies Practiced</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summary.companyBar}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill={GREY} stroke={GREY} radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Combined: LEFT pie, RIGHT line over time */}
                <div className="card">
                  <div className="card-title">Roles & Score Over Time</div>
                  <div className="dual-chart">
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={summary.rolePie}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {summary.rolePie.map((_, i, arr) => (
                              <Cell key={i} fill={pickFromGreys(i, arr.length)} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={summary.lineSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="x"
                            tickFormatter={(v) => new Date(v).toLocaleDateString()}
                          />
                          <YAxis domain={[0, 10]} ticks={[0,2,4,6,8,10]} />
                          <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                          <Line type="monotone" dataKey="y" stroke={GREY} strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW: Overall Skill Metrics (half-left, half-right) */}
              <div className="cards-grid">
                <div className="card">
                  <div className="card-title">Overall Skill Metrics (All Sessions)</div>
                  <div className="stats-grid" style={{gridTemplateColumns: "1fr 1fr"}}>
                    <div className="stat">
                      <div className="k">{summary.overallMetrics.technical_correctness ?? "—"}</div>
                      <div className="l">Technical Correctness</div>
                    </div>
                    <div className="stat">
                      <div className="k">{summary.overallMetrics.completeness ?? "—"}</div>
                      <div className="l">Completeness</div>
                    </div>
                    <div className="stat">
                      <div className="k">{summary.overallMetrics.clarity ?? "—"}</div>
                      <div className="l">Clarity</div>
                    </div>
                    <div className="stat">
                      <div className="k">{summary.overallMetrics.tone ?? "—"}</div>
                      <div className="l">Tone</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed feedback list */}
              <div className="detail-list">
                <div className="detail-title">Detailed Feedback (by session)</div>
                <div className="detail-grid">
                  {summary.recent.map((r, idx) => (
                    <div key={idx} className="detail-item">
                      <div className="d-head">
                        <span className="d-company">{r.company}</span>
                        <span className="d-score">Overall {r.score}/10</span>
                      </div>
                      <div className="d-sub">{r.role} — {r.level}</div>
                      <div className="d-date">{fmtDateTime(r.date)}</div>
                    </div>
                  ))}
                  {!summary.recent.length && <div className="empty">No sessions.</div>}
                </div>
              </div>
            </>
          )
        ) : (
          // SESSION VIEW
          loading ? (
            <div className="loader">Loading…</div>
          ) : (
            <>
              <div className="cards-grid">
                <div className="card">
                  <div className="card-title">Evaluation Scores (per question)</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={barData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 10]} ticks={[0,2,4,6,8,10]} />
                        <Tooltip />
                        <Bar dataKey="score" fill={GREY} stroke={GREY} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Consistency Across Questions</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tickCount={6} />
                        <Radar name="Score" dataKey="score" stroke={GREY} fill={GREY_LIGHT} fillOpacity={0.35} />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Score Distribution</div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {pieData.map((_, i, arr) => (
                            <Cell key={i} fill={pickFromGreys(i, arr.length)} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* NEW: Session averages for metrics */}
              <div className="cards-grid">
                <div className="card">
                  <div className="card-title">Session Averages (Metrics)</div>
                  <div className="stats-grid" style={{gridTemplateColumns: "1fr 1fr"}}>
                    <div className="stat">
                      <div className="k">{sessionMetricAvg.technical_correctness ?? "—"}</div>
                      <div className="l">Technical Correctness</div>
                    </div>
                    <div className="stat">
                      <div className="k">{sessionMetricAvg.completeness ?? "—"}</div>
                      <div className="l">Completeness</div>
                    </div>
                    <div className="stat">
                      <div className="k">{sessionMetricAvg.clarity ?? "—"}</div>
                      <div className="l">Clarity</div>
                    </div>
                    <div className="stat">
                      <div className="k">{sessionMetricAvg.tone ?? "—"}</div>
                      <div className="l">Tone</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="turns">
                {turns.map((t) => {
                  const m = t.metrics || {};
                  const flags = m.flags || {};
                  return (
                    <div key={t.index} className="turn-card">
                      <div className="row"><strong>Question {t.index + 1}:</strong> {t.question}</div>
                      <div className="row"><strong>You:</strong> {t.userAnswer}</div>
                      <div className="row"><strong>Feedback:</strong> {t.feedback}</div>

                      {/* NEW: per-question metrics */}
                      {t.metrics ? (
                        <div className="row">
                          <div style={{display:"flex", flexWrap:"wrap", gap:"8px"}}>
                            <span className="meta-score">Tech: {to1(m.technical_correctness) ?? "—"}/10</span>
                            <span className="meta-score">Complete: {to1(m.completeness) ?? "—"}/10</span>
                            <span className="meta-score">Clarity: {to1(m.clarity) ?? "—"}/10</span>
                            <span className="meta-score">Tone: {to1(m.tone) ?? "—"}/10</span>
                            {(flags.gibberish || flags.off_topic || flags.dont_know || flags.policy_violation) && (
                              <span className="meta-score" style={{color:"#b91c1c"}}>
                                Flags: {[
                                  flags.gibberish && "gibberish",
                                  flags.off_topic && "off-topic",
                                  flags.dont_know && "don’t-know",
                                  flags.policy_violation && "policy",
                                ].filter(Boolean).join(", ")}
                              </span>
                            )}
                            {m.notes && <span className="meta-score">Note: {m.notes}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="row"><em>Metrics not available for this turn.</em></div>
                      )}

                      {typeof t.score === "number" && (
                        <div className="row score-line"><strong>Score:</strong> {t.score}/10</div>
                      )}
                    </div>
                  );
                })}
                {!turns.length && <div className="empty">No turns recorded.</div>}
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
