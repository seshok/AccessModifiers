import os
import json
import re

from flask import Flask, render_template, request, jsonify
from anthropic import Anthropic, APIError

app = Flask(__name__)

# The client picks up ANTHROPIC_API_KEY from the environment automatically.
# Set it before running: export ANTHROPIC_API_KEY="sk-ant-..."
client = Anthropic()

MODEL = "claude-sonnet-5"
MAX_CODE_CHARS = 20000  # simple guardrail against oversized pastes

SUPPORTED_LANGUAGES = [
    "auto", "python", "javascript", "typescript", "java", "c", "cpp",
    "csharp", "go", "rust", "ruby", "php", "swift", "kotlin", "sql", "html", "css",
]

SYSTEM_PROMPT = """You are a senior software engineer performing a rigorous code review.

You will be given a source code snippet and (optionally) its language. Analyze it for:
- correctness bugs and edge cases
- security vulnerabilities
- performance problems
- readability / maintainability
- style and convention issues
- missing error handling

Respond with ONLY a single JSON object, no markdown fences, no commentary before or after it.
The JSON must have exactly this shape:

{
  "language_detected": "string, the language you identified",
  "score": integer from 0 to 100 representing overall code quality,
  "summary": "2-3 sentence plain-language overview of the code's health",
  "strengths": ["short bullet strings of what the code does well"],
  "issues": [
    {
      "line": integer or null if not line-specific,
      "severity": "critical" | "warning" | "info" | "nit",
      "category": "bug" | "security" | "performance" | "maintainability" | "style" | "error_handling",
      "message": "what is wrong, specific and concise",
      "suggestion": "concrete fix or improvement, concise"
    }
  ]
}

Rules:
- Line numbers refer to the 1-indexed line in the exact code given.
- Order issues by severity, most severe first.
- Be specific and actionable; avoid vague praise or vague criticism.
- If the code is short/trivial and has no real issues, return an empty issues array and a high score.
- Never include any text outside the JSON object.
"""


def extract_json(text: str) -> dict:
    """Best-effort extraction of a JSON object from the model's reply."""
    text = text.strip()
    # Strip accidental markdown fences if the model adds them anyway.
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start:end + 1])


@app.route("/")
def index():
    return render_template("index.html", languages=SUPPORTED_LANGUAGES)


@app.route("/api/review", methods=["POST"])
def review():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    language = (data.get("language") or "auto").strip()

    if not code:
        return jsonify({"error": "No code provided."}), 400
    if len(code) > MAX_CODE_CHARS:
        return jsonify({
            "error": f"Code is too long ({len(code)} chars). Limit is {MAX_CODE_CHARS}."
        }), 400

    language_hint = "" if language == "auto" else f"The language is {language}."
    user_message = f"{language_hint}\n\nReview this code:\n\n{code}"

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except APIError as exc:
        return jsonify({"error": f"Claude API error: {exc}"}), 502
    except Exception as exc:  # noqa: BLE001 - surface any unexpected failure to the UI
        return jsonify({"error": f"Unexpected error: {exc}"}), 500

    raw_text = "".join(
        block.text for block in response.content if getattr(block, "type", "") == "text"
    )

    try:
        result = extract_json(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        return jsonify({
            "error": f"Could not parse review from model output: {exc}",
            "raw": raw_text,
        }), 502

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
