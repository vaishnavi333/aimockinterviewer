// src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import image from "/public/2207.i101.025.F.m004.c9.machine learning deep learning isometric.jpg";
import "./Welcome.css"; // reuse same css

const API = import.meta.env?.VITE_API_URL || "http://127.0.0.1:8000";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/signup`, {
        email,
        password,
      });
      setSuccess(response.data.message || "Account created");
      // keep your existing flow: go back to login
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      if (err.response) setError(err.response.data.detail);
      else setError("Signup failed. Try again later.");
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
          <h2 className="login-title">Create an Account</h2>
          <p className="login-subtitle">Sign up to start practicing your mock interviews</p>

          <form onSubmit={handleSignup}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p style={{ color: "red" }}>{error}</p>}
            {success && <p style={{ color: "green" }}>{success}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Creating..." : "Sign Up"}
            </button>

            <div className="signup-link">
              already have an account?{" "}
              <a onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
                login here
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
