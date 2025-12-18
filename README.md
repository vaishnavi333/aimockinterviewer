# 🚀 AiMockInterviewer — Setup & Troubleshooting

This guide covers full **Frontend (React + Vite)** and **Backend (FastAPI)** setup, plus all the **troubleshooting fixes** we used so teammates can get up and running quickly.

---

## 📦 Prerequisites

* **Node.js** ≥ 18 (check with `node -v`)
* **Python** 3.10+
* **Git**
* macOS / Linux / Windows (PowerShell)

---

## 🖥️ Frontend — React + Vite

### ▶️ Quick Start

```bash
# From repo root
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# If charts are used on Dashboard
npm install recharts

# Start dev server
npm run dev
# App: http://localhost:5173
```

### 🧹 Frontend Troubleshooting

**Issue: `Failed to resolve import "recharts"`**

```bash
cd frontend
npm install recharts
```

**Issue: general module/import errors after pulling**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run dev
```

---

## ⚙️ Backend — FastAPI

> ✅ Use a **single virtual environment at the repo root** (`.venv`).
> Avoid nested `backend/venv` — it causes reloader loops and path confusion.

### ▶️ Quick Start

```bash
# From repo root
python3 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt

# Start FastAPI
python -m uvicorn app.main:app \
  --app-dir backend \
  --port 8000 \
  --reload

# API Docs: http://127.0.0.1:8000/docs
```

---

## 🧩 Backend Troubleshooting (All the fixes we used)

### 1) ❌ Nested venv under `backend/venv` causing reload loops or permission errors

Remove it safely, then use only `.venv` at repo root:

```bash
# Stop any running uvicorn/watchfiles
pkill -f "uvicorn|watchfiles" 2>/dev/null || true
pkill -f "$(pwd)/backend/venv/bin/python" 2>/dev/null || true

# Unlock and remove backend/venv
chflags -R nouchg backend/venv 2>/dev/null || true
chmod -R u+w backend/venv 2>/dev/null || true
find backend/venv -mindepth 1 -exec rm -rf {} +
rmdir backend/venv 2>/dev/null || true

# Recreate clean env at the repo root
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -r requirements.txt
```

### 2) 🔁 Uvicorn keeps reloading due to changes in `.venv/lib/...`

You’ll see logs like:

```
WARNING: WatchFiles detected changes in '.venv/lib/python3.10/site-packages/...'
```

**Fix A (recommended):** Use default stat reloader by removing `watchfiles`.

```bash
pip uninstall -y watchfiles
```

**Fix B (target reload only to code):**

```bash
python -m uvicorn app.main:app \
  --app-dir backend \
  --port 8000 \
  --reload \
  --reload-dir backend/app \
  --reload-include "*.py"
```

### 3) 📨 `ImportError: email-validator is not installed` (even after installing)

This happens when uvicorn starts with **system Python** (pyenv) instead of your project `.venv`.

**Fix: ensure you’re using the right interpreter**

```bash
# Activate the project venv
source .venv/bin/activate

# Verify interpreter
which python
python -c "import sys; print(sys.executable)"
# Expect: .../AiMockInterviewer/.venv/bin/python

# Verify email_validator is importable from this env
python -c "import email_validator, sys; print('email_validator OK from', sys.executable)"

# Launch server using this venv’s python
python -m uvicorn app.main:app --app-dir backend --port 8000
```

### 4) ⌨️ `KeyboardInterrupt` / `asyncio.exceptions.CancelledError` on shutdown

These are normal when stopping the server with **Ctrl + C**. No action needed.

---

## ✅ Backend Health Checklist

* **Correct Python**:

  ```bash
  which python
  # → .../AiMockInterviewer/.venv/bin/python
  ```
* **Dependencies installed**:

  ```bash
  pip install -r requirements.txt
  ```
* **Email validator present**:

  ```bash
  python -c "import email_validator"
  ```
* **Server starts**:

  ```bash
  python -m uvicorn app.main:app --app-dir backend --port 8000
  ```
* **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🗂️ Project Tips

* Keep `.venv` in `.gitignore`
* Don’t keep a venv inside `backend/`
* Always `source .venv/bin/activate` before backend commands
* If things get weird: rebuild env

  ```bash
  rm -rf .venv
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```

---

## 🌐 Quick Links

* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧭 TL;DR

**Frontend**

```bash
cd frontend
npm install --legacy-peer-deps
npm install recharts        # if charts are used
npm run dev
```

**Backend**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -r requirements.txt
python -m uvicorn app.main:app --app-dir backend --port 8000 --reload
```

---
