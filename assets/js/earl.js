/* Ask Earl: the chat on /earl.
   The conversation is held in this page's memory only. Nothing is written to cookies,
   localStorage, or any server log; reloading the page clears it. */
const OPENER = "I'm Earl, an AI character made by Grid & Grain. I'm not a real person, but I know a good bit about power lines, chips, and data centers. What's on your mind?";
const ENDPOINT = "/api/earl";
const MAX_CHARS = 600;
const KEEP_TURNS = 8;

function start(root) {
  const log = root.querySelector("[data-earl-log]");
  const form = root.querySelector("[data-earl-form]");
  const input = root.querySelector("[data-earl-input]");
  const sendBtn = root.querySelector("[data-earl-send]");
  const count = root.querySelector("[data-earl-count]");
  const starters = root.querySelector("[data-earl-starters]");
  const reset = root.querySelector("[data-earl-reset]");
  const status = root.querySelector("[data-earl-status]");
  let history = [];
  let busy = false;

  add("earl", OPENER);
  root.classList.add("is-ready");

  /* Ask the server whether the chat is switched on. If not, leave the email route. */
  fetch(ENDPOINT, { method: "GET", headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : { on: false }))
    .then((j) => { if (!j.on) offline(); })
    .catch(offline);

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });
  input.addEventListener("input", () => {
    const left = MAX_CHARS - input.value.length;
    count.textContent = left <= 100 ? left + " characters left" : "";
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  });
  starters.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) ask(b.textContent);
  });
  reset.addEventListener("click", () => {
    if (busy) return;
    history = [];
    log.textContent = "";
    add("earl", OPENER);
    starters.hidden = false;
    reset.hidden = true;
    input.focus();
  });

  function offline() {
    root.classList.add("is-offline");
    input.disabled = true; sendBtn.disabled = true;
    for (const b of starters.querySelectorAll("button")) b.disabled = true;
    status.hidden = false;
  }

  async function ask(raw) {
    const text = String(raw || "").trim();
    if (!text || busy || input.disabled) return;
    if (text.length > MAX_CHARS) { count.textContent = "Please keep it under " + MAX_CHARS + " characters."; return; }
    busy = true; sendBtn.disabled = true;
    starters.hidden = true; reset.hidden = false;
    input.value = ""; input.style.height = "auto"; count.textContent = "";
    add("you", text);
    history.push({ role: "user", content: text });
    const bubble = add("earl", "", true);
    let answer = "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-KEEP_TURNS) }),
        signal: ctrl.signal
      });
      if (!r.ok) {
        let msg = "I can't reach my library right now. Try again in a minute.";
        try { msg = (await r.json()).message || msg; } catch (e) {}
        if (r.status === 503 && !history.some((m) => m.role === "assistant")) offline();
        throw new Error(msg);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += dec.decode(value, { stream: true });
        render(bubble, answer);
        log.scrollTop = log.scrollHeight;
      }
      answer = answer.trim();
      if (!answer) throw new Error("I lost my place there. Ask me again?");
      render(bubble, answer);
      history.push({ role: "assistant", content: answer });
    } catch (err) {
      history.pop(); /* the question got no answer; don't resend it as context */
      const msg = err && err.name === "AbortError" ? "That took too long. Ask me again?" : (err && err.message) || "Something went wrong. Ask me again?";
      render(bubble, answer ? answer + "\n\n" + msg : msg);
      bubble.parentElement.classList.add("is-error");
    } finally {
      clearTimeout(timer);
      bubble.parentElement.classList.remove("is-writing");
      bubble.parentElement.removeAttribute("aria-busy");
      busy = false; sendBtn.disabled = input.disabled;
      log.scrollTop = log.scrollHeight;
      if (!input.disabled) input.focus({ preventScroll: true });
    }
  }

  function add(who, text, writing) {
    const item = document.createElement("div");
    item.className = "chat__msg chat__msg--" + who + (writing ? " is-writing" : "");
    if (writing) item.setAttribute("aria-busy", "true");
    const label = document.createElement("span");
    label.className = "chat__who";
    label.textContent = who === "earl" ? "Earl · AI character" : "You";
    const body = document.createElement("div");
    body.className = "chat__text";
    item.append(label, body);
    render(body, text);
    log.append(item);
    log.scrollTop = log.scrollHeight;
    return body;
  }
}

/* Writes text into the bubble as plain text nodes: grades become tags, and addresses on
   this site become links. Nothing from the answer is ever inserted as HTML. */
const GRADES = { VERIFIED: "v", PLAUSIBLE: "p", SPECULATIVE: "s" };
const TOKEN = /\b(VERIFIED|PLAUSIBLE|SPECULATIVE)\b|((?:https?:\/\/)?(?:www\.)?getruralamericadone\.com(?:\/[A-Za-z0-9\-_\/#]*[A-Za-z0-9\-_\/])?)/g;
function render(el, text) {
  el.textContent = "";
  for (const para of String(text).split(/\n{2,}/)) {
    if (!para.trim() && text) continue;
    const p = document.createElement("p");
    let last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(para))) {
      if (m.index > last) p.append(para.slice(last, m.index));
      if (m[1]) {
        const g = document.createElement("span");
        g.className = "grade grade--" + GRADES[m[1]];
        g.append(document.createElement("i"), m[1]);
        p.append(g);
      } else {
        const a = document.createElement("a");
        const path = m[2].replace(/^(?:https?:\/\/)?(?:www\.)?getruralamericadone\.com/, "") || "/";
        a.href = path;
        a.textContent = m[2].replace(/^https?:\/\//, "");
        p.append(a);
      }
      last = m.index + m[0].length;
    }
    if (last < para.length) p.append(para.slice(last));
    el.append(p);
  }
}

const root = document.querySelector("[data-earl-chat]");
if (root) start(root);
