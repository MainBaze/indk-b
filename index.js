// Storage keys
const LS_KEY = "shoppingList.v1";

// State
let items = [];

// Helpers
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const nowISO = () => new Date().toISOString();
const fmtDate = iso => new Date(iso).toLocaleDateString();

// Load from localStorage or URL share
function loadInitial() {
  // URL fragment import: #data=<base64>
  const frag = new URL(location.href).hash;
  if (frag.startsWith("#data=")) {
    try {
      const b64 = frag.slice(6);
      const json = decodeURIComponent(escape(atob(b64)));
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        items = parsed;
        save(); // persist locally
        // clean hash to avoid oversized URLs on further navigation
        history.replaceState(null, "", location.pathname);
        return;
      }
    } catch { /* ignore */ }
  }

  const raw = localStorage.getItem(LS_KEY);
  items = raw ? JSON.parse(raw) : [];
}

// Save to localStorage
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ID
const uid = () => Math.random().toString(36).slice(2, 10);

// DOM refs
const listEl = $("#list");
const tpl = $("#item-template");

// Render
function render() {
  const filter = $('input[name="filter"]:checked')?.value || "all";
  listEl.innerHTML = "";

  const filtered = items.filter(it => {
    if (filter === "active") return !it.purchasedAt;
    if (filter === "purchased") return !!it.purchasedAt;
    return true;
  });

  filtered.forEach(it => listEl.appendChild(renderItem(it)));
}

function renderItem(it) {
  const node = tpl.content.firstElementChild.cloneNode(true);

  const checkbox = $(".toggle", node);
  const name = $(".name", node);
  const notes = $(".notes", node);
  const added = $(".meta .added", node);
  const purchased = $(".meta .purchased", node);
  const removeBtn = $(".remove", node);

  checkbox.checked = !!it.purchasedAt;
  name.textContent = it.name;
  notes.textContent = it.notes || "";
  name.classList.toggle("purchased", !!it.purchasedAt);

  added.textContent = `Added: ${fmtDate(it.addedAt)}`;
  if (it.purchasedAt) {
    purchased.hidden = false;
    purchased.textContent = `Purchased: ${fmtDate(it.purchasedAt)}`;
  } else {
    purchased.hidden = true;
  }

  // Events
  checkbox.addEventListener("change", () => {
    it.purchasedAt = checkbox.checked ? nowISO() : null;
    save(); render();
  });

  const commitEdit = () => {
    const newName = name.textContent.trim();
    const newNotes = notes.textContent.trim();
    if (!newName) {
      // If name cleared, remove the item
      items = items.filter(x => x.id !== it.id);
    } else {
      it.name = newName;
      it.notes = newNotes;
    }
    save(); render();
  };

  name.addEventListener("blur", commitEdit);
  notes.addEventListener("blur", commitEdit);
  name.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
  notes.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); notes.blur(); } });

  removeBtn.addEventListener("click", () => {
    items = items.filter(x => x.id !== it.id);
    save(); render();
  });

  return node;
}

// Add item
$("#add-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#item-name");
  const notes = $("#item-notes");

  const nm = name.value.trim();
  const nt = notes.value.trim();

  if (!nm) return;

  items.unshift({
    id: uid(),
    name: nm,
    notes: nt || "",
    addedAt: nowISO(),
    purchasedAt: null
  });

  name.value = "";
  notes.value = "";
  save(); render();
});

// Filters
$$('.filters input[name="filter"]').forEach(r =>
  r.addEventListener("change", render)
);

// Export JSON
$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopping-list-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Import JSON (file)
const fileInput = $("#file-input");
$("#btn-import").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid format");
    items = data;
    save(); render();
  } catch {
    alert("Import failed. Provide a valid JSON exported by this page.");
  } finally {
    fileInput.value = "";
  }
});

// Share URL with embedded data (base64)
$("#btn-share").addEventListener("click", async () => {
  try {
    const json = JSON.stringify(items);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `${location.origin}${location.pathname}#data=${b64}`;
    await navigator.clipboard.writeText(url);
    alert("Link copied. Anyone with the link can load this list.");
  } catch {
    alert("Copy failed. Manually copy from the address bar after clicking Share.");
    // Fallback: push to URL for manual copy
    const json = JSON.stringify(items);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    location.hash = `data=${b64}`;
  }
});

// Init
loadInitial();
render();
