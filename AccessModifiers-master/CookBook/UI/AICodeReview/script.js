const codeInput = document.getElementById("code-input");
const gutter = document.getElementById("gutter");
const lineFlags = document.getElementById("line-flags");
const reviewBtn = document.getElementById("review-btn");
const statusLine = document.getElementById("status-line");
const languageSelect = document.getElementById("language");
const fileInput = document.getElementById("file-input");

const stamp = document.getElementById("stamp");
const stampScore = document.getElementById("stamp-score");
const editorsNote = document.getElementById("editors-note");
const summaryText = document.getElementById("summary-text");
const strengthsList = document.getElementById("strengths-list");
const annotationsEl = document.getElementById("annotations");
const emptyState = document.getElementById("empty-state");

function updateGutter() {
  const lineCount = codeInput.value.split("\n").length;
  const lines = [];
  for (let i = 1; i <= lineCount; i++) lines.push(i);
  gutter.textContent = lines.join("\n");
  gutter.scrollTop = codeInput.scrollTop;
}

codeInput.addEventListener("input", updateGutter);
codeInput.addEventListener("scroll", () => {
  gutter.scrollTop = codeInput.scrollTop;
  lineFlags.style.transform = `translateY(-${codeInput.scrollTop}px)`;
});
updateGutter();

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const text = await file.text();
  codeInput.value = text;
  updateGutter();

  const ext = file.name.split(".").pop().toLowerCase();
  const extMap = {
    py: "python", js: "javascript", ts: "typescript", java: "java",
    c: "c", cpp: "cpp", cc: "cpp", cs: "csharp", go: "go", rs: "rust",
    rb: "ruby", php: "php", swift: "swift", kt: "kotlin", sql: "sql",
    html: "html", css: "css",
  };
  if (extMap[ext]) languageSelect.value = extMap[ext];
});

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", isError);
}

function severityRank(sev) {
  return { critical: 0, warning: 1, info: 2, nit: 3 }[sev] ?? 4;
}

function renderFlags(issues) {
  lineFlags.innerHTML = "";
  const lineHeight = 1.65 * 0.85 * 16; // matches CSS line-height * font-size(px)
  const topPad = 17.6; // matches .code-input padding-top (1.1rem)
  issues
    .filter((i) => typeof i.line === "number" && i.line > 0)
    .forEach((issue) => {
      const flag = document.createElement("div");
      flag.className = `line-flag line-flag--${issue.severity}`;
      flag.style.top = `${topPad + (issue.line - 1) * lineHeight}px`;
      lineFlags.appendChild(flag);
    });
}

function renderResult(result) {
  emptyState.classList.add("hidden");

  stamp.classList.remove("hidden");
  stampScore.textContent = `${result.score}`;

  editorsNote.classList.remove("hidden");
  summaryText.textContent = result.summary || "";
  strengthsList.innerHTML = "";
  (result.strengths || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    strengthsList.appendChild(li);
  });

  const issues = [...(result.issues || [])].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );

  annotationsEl.innerHTML = "";
  if (issues.length === 0) {
    const note = document.createElement("p");
    note.className = "editors-note-text";
    note.style.marginTop = "0";
    note.textContent = "No notes in the margins — this manuscript reads clean.";
    annotationsEl.appendChild(note);
  }

  issues.forEach((issue) => {
    const card = document.createElement("div");
    card.className = `annotation annotation--${issue.severity || "nit"}`;

    const head = document.createElement("div");
    head.className = "annotation-head";

    if (typeof issue.line === "number") {
      const lineBadge = document.createElement("span");
      lineBadge.className = "annotation-line";
      lineBadge.textContent = `L${issue.line}`;
      head.appendChild(lineBadge);
    }

    const sev = document.createElement("span");
    sev.className = "annotation-severity";
    sev.textContent = issue.severity || "nit";
    head.appendChild(sev);

    const cat = document.createElement("span");
    cat.className = "annotation-category";
    cat.textContent = (issue.category || "").replace("_", " ");
    head.appendChild(cat);

    const message = document.createElement("p");
    message.className = "annotation-message";
    message.textContent = issue.message || "";

    card.appendChild(head);
    card.appendChild(message);

    if (issue.suggestion) {
      const suggestion = document.createElement("p");
      suggestion.className = "annotation-suggestion";
      suggestion.textContent = issue.suggestion;
      card.appendChild(suggestion);
    }

    annotationsEl.appendChild(card);
  });

  renderFlags(issues);
}

async function submitReview() {
  const code = codeInput.value.trim();
  if (!code) {
    setStatus("Nothing to review yet — paste or upload some code first.", true);
    return;
  }

  reviewBtn.disabled = true;
  setStatus("Reading through your manuscript...");

  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language: languageSelect.value }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Something went wrong.", true);
      return;
    }

    renderResult(data);
    setStatus(`Reviewed as ${data.language_detected || languageSelect.value}.`);
  } catch (err) {
    setStatus(`Network error: ${err.message}`, true);
  } finally {
    reviewBtn.disabled = false;
  }
}

reviewBtn.addEventListener("click", submitReview);
