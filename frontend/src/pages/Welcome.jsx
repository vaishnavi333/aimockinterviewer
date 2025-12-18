import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock } from "react-icons/fa";
import axios from "axios";
import image from "/public/2207.i101.025.F.m004.c9.machine learning deep learning isometric.jpg";
import "./Welcome.css";

const API = import.meta.env?.VITE_API_URL || "http://127.0.0.1:8000";

const Welcome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const email = e.target[0].value.trim().toLowerCase();
    const password = e.target[1].value;

    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });

      if (res.status === 200) {
        const { userId } = res.data || {};
        // persist identity for later pages/refresh
        try {
          localStorage.setItem("email", email);
          if (userId) localStorage.setItem("userId", userId);
        } catch {}
        // carry identity via route state too
        navigate("/select-role", { state: { email, userId } });
      }
    } catch (err) {
      console.error("Login failed:", err.response?.data || err.message);
      setError(
        err.response?.data?.detail ||
          "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-container">
      <div className="left-panel">
        <img src={image} alt="AI Visual" className="ai-image" />
        <p className="image-credit">
          Image by{" "}
          <a href="https://www.freepik.com" target="_blank" rel="noopener noreferrer">
            macrovector on Freepik
          </a>
        </p>
      </div>

      <div className="right-panel">
        <div className="login-card">
          <h2 className="login-title">AI Mock Interviewer</h2>
          <p className="login-subtitle">
            Start here to prepare for your next interview with AI assistance
          </p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <FaEnvelope className="input-icon" />
              <input type="email" placeholder="Enter your email" required />
            </div>

            <div className="input-group">
              <FaLock className="input-icon" />
              <input type="password" placeholder="Enter your password" required />
            </div>

            {error && <p style={{ color: "red" }}>{error}</p>}

            <div className="forgot-password">
              <a onClick={() => navigate("/forgot-password")} style={{ cursor: "pointer" }}>
                Forgot password?
              </a>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="signup-link">
              Don’t have an account?{" "}
              <a onClick={() => navigate("/signup")} style={{ cursor: "pointer" }}>
                Signup now
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
