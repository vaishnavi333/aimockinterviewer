import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Interview.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/* Pick a supported mime type for MediaRecorder */
const pickMime = () => {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return ""; // let browser choose
};

export default function Interview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session_id, question: initialQuestion } = location.state || {};

  const [sessionId] = useState(session_id);
  const [currentQuestion, setCurrentQuestion] = useState(initialQuestion || "");
  const [userAnswer, setUserAnswer] = useState("");
  const [chatHistory, setChatHistory] = useState([]); // [{question, answer, feedback, score?}]
  const [loading, setLoading] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);

  // ---- Voice On (auto-record) ----
  const [voiceOn, setVoiceOn] = useState(false); // OFF by default

  // ---- Recorder ----
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState("");

  useEffect(() => {
    if (!session_id || !initialQuestion) navigate("/");
  }, [session_id, initialQuestion, navigate]);

  // Auto-start recording whenever a new question appears (if Voice On)
  useEffect(() => {
    if (!currentQuestion) return;
    if (!voiceOn) return;
    const id = setTimeout(() => {
      if (recording) stopRecording(true);
      startRecording();
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, voiceOn]);

  // If user turns Voice Off, stop any active recording
  useEffect(() => {
    if (!voiceOn && recording) stopRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  // ---- Voice recording -> Whisper translate-to-English -> text box ----
  const startRecording = async () => {
    setRecError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onerror = (e) => setRecError(`Recorder error: ${e.error?.message || e.name}`);
      rec.onstop = async () => {
        try {
          const blobType = (rec.mimeType || mimeType || "audio/webm").split(";")[0];
          const blob = new Blob(chunksRef.current, { type: blobType || "audio/webm" });
          chunksRef.current = [];

          const fd = new FormData();
          const ext =
            blobType.includes("ogg") ? "ogg" :
            blobType.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `answer.${ext}`);

          const r = await fetch(`${API}/audio/transcribe?force_english=1`, {
            method: "POST",
            body: fd,
          });
          if (!r.ok) throw new Error(await r.text());
          const j = await r.json();
          const t = (j?.text || "").trim();
          if (t) setUserAnswer((prev) => (prev ? prev + " " + t : t));
        } catch (err) {
          console.error(err);
          setRecError("Transcription failed. Check /audio/transcribe & OPENAI_API_KEY.");
        }
      };
      rec.start();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setRecError("Mic not available or permission denied. Try Chrome on localhost.");
      setVoiceOn(false);
    }
  };

  const stopRecording = (forceQuiet = false) => {
    const rec = mediaRecRef.current;
    if (!rec) return;
    try {
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    setRecording(false);
    if (!forceQuiet) setVoiceOn(false);
  };

  // ---- Submit answer ----
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;
    setLoading(true);

    if (recording) stopRecording(true);

    try {
      const res = await axios.post(`${API}/interview/answer`, {
        session_id: sessionId,
        text: userAnswer,
      });

      const { feedback, question: nextQ, score } = res.data;

      setChatHistory((h) => [
        ...h,
        { question: currentQuestion, answer: userAnswer, feedback, score },
      ]);
      setUserAnswer("");
      setShowNextPrompt(true);
      setCurrentQuestion(nextQ);

      requestAnimationFrame(() => {
        const el = document.querySelector(".chat-box");
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (err) {
      console.error("Error submitting answer:", err);
      alert("Could not submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => setShowNextPrompt(false);

  // compute overall average (ignore null/undefined scores)
  const overallScore = (() => {
    const nums = chatHistory
      .map((t) => (typeof t.score === "number" ? t.score : null))
      .filter((x) => x !== null);
    if (!nums.length) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return Math.round((sum / nums.length) * 10) / 10;
  })();

  const handleEndInterview = async () => {
    if (recording) stopRecording(true);
    try {
      await axios.post(`${API}/interview/session/${sessionId}/score`, {
        scores: chatHistory.map((row, i) => ({
          index: i, // matches how we store "index" in DB
          question: row.question,
       	  score: typeof row.score === "number" ? row.score : null,
        })),
        overall: overallScore,
      });
    } catch (err) {
      console.warn("Saving score is non-blocking:", err?.response?.data || err.message);
    }
    // ⬇️ only change: go to dashboard instead of home
    navigate("/dashboard", { state: { session_id: sessionId } });
  };

  return (
    <div className="interview-container">
      <div className="toolbar">
        <h1 className="interview-title">AI Mock Interview</h1>
        <div className="toolbar-right">
          <button className="chip" onClick={() => setVoiceOn((v) => !v)}>
            {voiceOn ? "🎙️ Voice On" : "🎙️ Voice Off"}
          </button>
          <button className="chip danger" onClick={handleEndInterview}>
            End
          </button>
        </div>
      </div>

      <div className="chat-box">
        {chatHistory.map((item, idx) => (
          <div key={idx} className="chat-block">
            <div className="row"><strong>Question {idx + 1}:</strong> {item.question}</div>
            <div className="row"><strong>You:</strong> {item.answer}</div>
            <div className="row"><strong>Feedback:</strong> {item.feedback}</div>
            {typeof item.score === "number" && (
              <div className="row score-line"><strong>Score:</strong> {item.score}/10</div>
            )}
          </div>
        ))}

        {!showNextPrompt && currentQuestion && (
          <div className="chat-block current">
            <div className="pill">Current Question</div>
            <div className="q row">{currentQuestion}</div>

            <textarea
              rows="4"
              className="answer-box"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer, or press the mic and speak…"
            />

            <div className="composer-row">
              <button
                type="button"
                className={`mic-btn ${recording ? "rec" : ""}`}
                onClick={recording ? () => stopRecording(true) : startRecording}
                title={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? "■ Stop" : "🎤 Speak"}
              </button>

              <button
                onClick={handleSubmitAnswer}
                disabled={loading || !userAnswer.trim()}
                className="submit-btn"
              >
                {loading ? "Submitting..." : "Submit Answer"}
              </button>
            </div>

            {recError && (
              <div className="rec-error" role="alert">
                {recError}
              </div>
            )}
          </div>
        )}

        {showNextPrompt && (
          <div className="next-prompt">
            <p>Would you like to continue to the next question?</p>
            <div className="next-buttons">
              <button onClick={handleNextQuestion} disabled={loading} className="next-btn">
                Yes, next question
              </button>
              <button onClick={handleEndInterview} className="next-btn">
                No, end interview
              </button>
            </div>

            {overallScore !== null && (
              <p style={{ marginTop: 12, fontWeight: 600 }}>
                Session score so far: {overallScore}/10
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
