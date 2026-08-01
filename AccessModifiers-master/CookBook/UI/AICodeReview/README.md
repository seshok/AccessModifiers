# Marginalia — AI Code Review Assistant

A small Flask web app that sends pasted or uploaded code to Claude and
renders the review as line-by-line margin notes, in the style of an
editor marking up a manuscript.

## Stack

- **Backend:** Python + Flask, calling the Claude API via the `anthropic` SDK
- **Frontend:** plain HTML/CSS/JS (no build step)
- **Model:** `claude-sonnet-5` (edit `MODEL` in `app.py` to change)

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Set your Anthropic API key as an environment variable:

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

   Get a key at https://console.anthropic.com if you don't have one.

3. Run the app:

   ```bash
   python app.py
   ```

4. Open http://127.0.0.1:5000 in your browser.

## How it works

- You paste code (or upload a file — the language dropdown auto-fills
  from the file extension) and click **Submit for review**.
- The frontend POSTs `{ code, language }` to `/api/review`.
- The backend prompts Claude with a strict instruction to return only a
  JSON object: an overall `score`, a short `summary`, a list of
  `strengths`, and a list of `issues`, each with a `line`, `severity`
  (`critical` / `warning` / `info` / `nit`), `category`, `message`, and
  `suggestion`.
- The frontend renders that JSON as: a rubber-stamp score, an editor's
  note (summary + strengths), colored dots next to flagged lines in the
  code, and a column of annotation cards sorted by severity.

## Extending it

Some natural next steps, left out to keep this a clean starting point:

- **Persistence:** store review history (e.g. SQLite) so past reviews
  can be revisited.
- **Diff mode:** accept a git diff instead of a full file, and only
  annotate changed lines.
- **Streaming:** use the Claude streaming API so the summary appears
  before the full issue list finishes generating.
- **Syntax highlighting:** swap the plain `<textarea>` for a proper
  editor (e.g. CodeMirror) if you want colored syntax while typing.
- **Auth / rate limiting:** needed before exposing this beyond local/dev use,
  since each review is a paid API call.

## Notes

- `MAX_CODE_CHARS` in `app.py` caps how much code is sent per request
  (default 20,000 characters) — raise it if you need to review larger files.
- If Claude's reply isn't valid JSON for some reason, the API returns a
  502 with the raw model output attached, so you can see what happened.
