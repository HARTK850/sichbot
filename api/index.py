"""
shichabot — Vercel serverless backend.
Identical API to main.py but without tkinter / pywebview / AppData.
Storage falls back to the frontend's localStorage.
"""

import os, logging, json, traceback
import requests, urllib3
from flask import Flask, request, jsonify
from flask_cors import CORS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(level=logging.WARNING)

# ── Constants ──────────────────────────────────────────────────
HF_CHAT_URL    = "https://router.huggingface.co/v1/chat/completions"
HF_WHOAMI      = "https://huggingface.co/api/whoami-v2"
GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"
MAX_TOKENS     = int(os.getenv("MAX_NEW_TOKENS", 2048))
TEMPERATURE    = float(os.getenv("TEMPERATURE", 0.85))
TIMEOUT_SEC    = int(os.getenv("REQUEST_TIMEOUT", 90))
FIXED_HF_KEY   = os.getenv("HF_API_KEY", "")   # optional: bake key into Vercel env vars

GEMINI_HDRS = {
    "Content-Type":    "application/json",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    "Origin":          "https://aistudio.google.com",
    "Referer":         "https://aistudio.google.com/",
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

def log_error(ctx, exc=None, extra=''):
    """Lightweight logger for Vercel (prints to stdout → visible in Vercel logs)."""
    tb = traceback.format_exc() if exc else ''
    msg = f"[shichabot ERROR] {ctx}"
    if exc:
        msg += f" | {type(exc).__name__}: {exc}"
    if extra:
        msg += f" | {extra}"
    if tb and tb.strip() != 'NoneType: None':
        msg += f"\n{tb.strip()}"
    print(msg)

# ── Flask app ──────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.errorhandler(Exception)
def handle_exception(e):
    log_error(f'Flask route error: {request.path}', e)
    return jsonify({'error': str(e)}), 500

# ── Health ─────────────────────────────────────────────────────
@app.route('/api/health')
@app.route('/health')
def health():
    return jsonify({"status": "ok", "mode": "web"})

# ── HF key validation ──────────────────────────────────────────
@app.route('/api/validate', methods=['POST'])
def validate_key():
    data    = request.get_json(silent=True) or {}
    api_key = FIXED_HF_KEY or data.get("api_key", "")
    if not api_key:
        return jsonify({"valid": False, "error": "No API key"}), 400
    try:
        r = requests.get(
            HF_WHOAMI,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10, verify=False
        )
        if r.status_code in (401, 403):
            return jsonify({"valid": False, "error": "Invalid key"}), 401
        info = r.json() if r.ok else {}
        return jsonify({"valid": True,
                        "username": info.get("name", ""),
                        "email":    info.get("email", "")})
    except Exception as e:
        log_error("validate_key", e)
        return jsonify({"valid": False, "error": str(e)}), 502

# ── Gemini key validation ──────────────────────────────────────
@app.route('/api/validate-gemini', methods=['POST'])
def validate_gemini():
    data    = request.get_json(silent=True) or {}
    api_key = data.get("api_key", "").strip()
    if not api_key:
        return jsonify({"valid": False, "error": "No Gemini API key"}), 400
    hdrs = {**GEMINI_HDRS, "x-goog-api-key": api_key}
    try:
        r = requests.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            headers=hdrs, timeout=10, verify=False
        )
        if r.status_code in (400, 401, 403):
            try:   err_msg = r.json().get("error", {}).get("message", "מפתח לא תקין")
            except: err_msg = f"HTTP {r.status_code}"
            return jsonify({"valid": False, "error": err_msg}), 401
        if not r.ok:
            return jsonify({"valid": False, "error": f"HTTP {r.status_code}"}), r.status_code
        return jsonify({"valid": True})
    except Exception as e:
        log_error("validate_gemini", e)
        return jsonify({"valid": False, "error": str(e)}), 502

# ── Storage: web version uses localStorage → these are no-ops ──
@app.route('/api/storage/get')
def storage_get():
    # On Vercel there is no persistent file system — frontend uses localStorage
    return jsonify({'value': None})

@app.route('/api/storage/set', methods=['POST'])
def storage_set():
    return jsonify({'ok': True})   # silently succeed — frontend saves to localStorage

# ── Save-file: not available in web mode ──────────────────────
@app.route('/api/save-file', methods=['POST'])
def save_file():
    # Tkinter dialogs are not available on the server.
    # The JS download() function falls back to browser download automatically.
    return jsonify({'ok': False, 'error': 'web_mode'}), 200

# ── HF Chat ───────────────────────────────────────────────────
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    model_id      = data.get("model_id", "").strip()
    system_prompt = data.get("system_prompt", "")
    history       = data.get("history", [])
    user_message  = data.get("user_message", "")
    file_context  = data.get("file_context", "")
    max_tokens    = int(data.get("max_tokens", MAX_TOKENS))
    temperature   = float(data.get("temperature", TEMPERATURE))
    api_key       = FIXED_HF_KEY or data.get("api_key", "")

    if not model_id:     return jsonify({"error": "model_id required"}), 400
    if not user_message: return jsonify({"error": "user_message required"}), 400
    if not api_key:      return jsonify({"error": "No HF API key"}), 401

    messages = []
    full_sys = system_prompt
    if file_context:
        full_sys += f"\n\n[FILE CONTEXT]\n{file_context}\n[/FILE CONTEXT]"
    if full_sys:
        messages.append({"role": "system", "content": full_sys})
    for i, m in enumerate(history):
        messages.append({"role": "user" if i % 2 == 0 else "assistant",
                         "content": m.get("text", "")})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model":       f"{model_id}:fastest",
        "messages":    messages,
        "max_tokens":  max_tokens,
        "temperature": temperature,
        "stream":      False,
    }
    try:
        r = requests.post(
            HF_CHAT_URL,
            headers={"Authorization": f"Bearer {api_key}",
                     "Content-Type": "application/json"},
            json=payload, timeout=TIMEOUT_SEC, verify=False
        )
    except requests.Timeout:
        return jsonify({"error": f"Timeout for {model_id}"}), 504
    except requests.RequestException as e:
        return jsonify({"error": f"Network error: {e}"}), 502

    if not r.ok:
        try:
            err = r.json().get("error", f"HTTP {r.status_code}")
            if isinstance(err, dict):
                err = err.get("message", str(err))
        except Exception:
            err = f"HTTP {r.status_code}"
        status_map = {
            401: "מפתח API לא תקין",
            403: f"גישה נדחתה ל-{model_id}",
            404: f"המודל '{model_id}' לא נמצא",
            429: "חריגה ממגבלת קריאות",
            503: f"המודל {model_id} בטעינה — נסה שוב",
        }
        return jsonify({"error": status_map.get(r.status_code, err),
                        "hf_error": err}), r.status_code

    try:
        text = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return jsonify({"error": "תשובה ריקה מהמודל"}), 500

    return jsonify({"generated_text": text, "model_id": model_id})

# ── Gemini Chat ────────────────────────────────────────────────
@app.route('/api/gemini-chat', methods=['POST'])
def gemini_chat():
    data          = request.get_json(silent=True) or {}
    model_id      = data.get("model_id", "").strip()
    system_prompt = data.get("system_prompt", "")
    history       = data.get("history", [])
    user_message  = data.get("user_message", "")
    file_context  = data.get("file_context", "")
    api_key       = data.get("gemini_key", "").strip()

    if not model_id:      return jsonify({"error": "model_id required"}), 400
    if not api_key:       return jsonify({"error": "Gemini API key required"}), 401
    if not user_message:  return jsonify({"error": "user_message required"}), 400

    contents = []
    for i, m in enumerate(history):
        role = "user" if i % 2 == 0 else "model"
        contents.append({"role": role, "parts": [{"text": m.get("text", "")}]})

    full_user = user_message
    if file_context:
        full_user = f"{user_message}\n\n[FILE CONTEXT]\n{file_context}\n[/FILE CONTEXT]"
    contents.append({"role": "user", "parts": [{"text": full_user}]})

    body = {"contents": contents,
            "generationConfig": {"maxOutputTokens": 2048, "temperature": 0.85}}
    if system_prompt:
        body["systemInstruction"] = {"parts": [{"text": system_prompt}]}

    url  = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    hdrs = {**GEMINI_HDRS, "x-goog-api-key": api_key}
    try:
        r = requests.post(url, headers=hdrs, json=body, timeout=90, verify=False)
        if not r.ok:
            try:   err = r.json().get("error", {}).get("message", f"HTTP {r.status_code}")
            except: err = f"HTTP {r.status_code}"
            if r.status_code in (400, 401, 403):
                return jsonify({"error": f"מפתח Gemini לא תקין: {err}"}), r.status_code
            return jsonify({"error": err}), r.status_code
        text = (r.json().get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")).strip()
        if not text:
            return jsonify({"error": "Gemini החזיר תשובה ריקה"}), 500
        return jsonify({"generated_text": text, "model_id": model_id})
    except requests.Timeout:
        return jsonify({"error": f"Timeout for {model_id}"}), 504
    except Exception as e:
        log_error(f"gemini_chat {model_id}", e)
        return jsonify({"error": str(e)}), 500

# ── Gemini TTS / Podcast ───────────────────────────────────────
@app.route('/api/podcast', methods=['POST'])
def podcast():
    data            = request.get_json(silent=True) or {}
    api_key         = data.get("gemini_key", "").strip()
    script          = data.get("script", "").strip()
    speaker_configs = data.get("speaker_configs", [])

    if not api_key: return jsonify({"error": "Gemini API key missing"}), 400
    if not script:  return jsonify({"error": "Empty script"}), 400

    body = {
        "contents": [{"parts": [{"text": script}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "multiSpeakerVoiceConfig": {"speakerVoiceConfigs": speaker_configs}
            },
        },
    }
    hdrs = {**GEMINI_HDRS,
            "Accept-Encoding": "gzip, deflate, br",
            "x-goog-api-key":  api_key}
    try:
        r = requests.post(GEMINI_TTS_URL, headers=hdrs, json=body,
                          timeout=180, verify=False)
        if not r.ok:
            try:   err = r.json().get("error", {}).get("message", f"HTTP {r.status_code}")
            except: err = f"HTTP {r.status_code}: {r.text[:200]}"
            log_error(f"Gemini TTS {r.status_code}", extra=err)
            return jsonify({"error": err}), r.status_code

        audio_part = None
        for part in (r.json().get("candidates", [{}])[0]
                              .get("content", {}).get("parts", [])):
            if "inlineData" in part:
                audio_part = part["inlineData"]
                break
        if not audio_part:
            return jsonify({"error": "Gemini did not return audio"}), 500
        return jsonify({"audio_b64": audio_part["data"],
                        "mime_type": audio_part.get("mimeType", "audio/pcm")})
    except requests.Timeout:
        return jsonify({"error": "Timeout generating podcast (>3 min) — try a shorter conversation"}), 504
    except Exception as e:
        log_error("podcast", e)
        return jsonify({"error": str(e)}), 500

# ── Vercel entry point ─────────────────────────────────────────
# Vercel calls the module-level `app` object directly.
# No app.run() needed.
