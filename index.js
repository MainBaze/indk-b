// index.js — dansk, Firestore, ingen “ny liste”/“del”
import {
  db, doc, setDoc, getDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, updateDoc, deleteDoc
} from "./firebase.js";

// ---------- Helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const getListId = () => params.get("id");
const setListId = (id) => {
  const p = new URLSearchParams(location.search);
  p.set("id", id);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);
};

// Fejlbadge
const statusEl = document.createElement("div");
statusEl.style.cssText = "position:fixed;left:12px;bottom:12px;background:#2a1115;color:#ffd6db;border:1px solid #3a1f23;padding:8px 10px;border-radius:10px;display:none;z-index:9999;";
document.body.appendChild(statusEl);
const showError = (m) => { statusEl.textContent = m; statusEl.style.display = "block"; };
const hideError  = () => { statusEl.style.display = "none"; };

// DOM refs
const listEl = $("#list");
const tpl = $("#item-template");

// Datoformat
const fmtDate = (ts) => {
  if (!ts) return "";
  try {
    const dt = ts.toDate ? ts.toDate() : new Date(ts);
    return dt.toLocaleDateString("da-DK");
  } catch { return ""; }
};

// ---------- Data-layer ----------
let unsubscribe = null;

async function ensureList() {
  let id = getListId();
  try {
    if (!id) {
      const listRef = doc(collection(db, "lists"));
      await setDoc(listRef, { createdAt: serverTimestamp(), title: "Indkøbsliste" });
      id = listRef.id;
      setListId(id);
    } else {
      // hvis nogen manuelt har slettet listen, genskab den
      const snap = await getDoc(doc(db, "lists", id));
      if (!snap.exists()) {
        await setDoc(doc(db, "lists", id), { createdAt: serverTimestamp(), title: "Indkøbsliste" });
      }
    }
    hideError();
    return id;
  } catch (err) {
    console.error("ensureList:", err);
    const msg = err && (err.code || err.message) ? `Årsag: ${err.code || err.message}` : "ukendt";
    showError(`Listen er ikke klar. ${msg}. Tjek Firestore Rules og klik Publish.`);
    return null;
  }
}

function renderItem(id, data) {
  const node = tpl.content.firstElementChild.cloneNode(true);

  const checkbox  = $(".toggle", node);
  const nameEl    = $(".name", node);
  const notesEl   = $(".notes", node);
  const addedEl   = $(".meta .added", node);
  const purchEl   = $(".meta .purchased", node);
  const removeBtn = $(".remove", node);

  nameEl.textContent  = data.name  || "";
  notesEl.textContent = data.notes || "";
  checkbox.checked    = !!data.purchasedAt;
  nameEl.classList.toggle("purchased", !!data.purchasedAt);

  if (data.addedAt)    addedEl.textContent = `Tilføjet: ${fmtDate(data.addedAt)}`;
  if (data.purchasedAt) {
    purchEl.hidden = false;
    purchEl.textContent = `Købt: ${fmtDate(data.purchasedAt)}`;
  } else {
    purchEl.hidden = true;
  }

  // Købt/ikke købt
  checkbox.addEventListener("change", async () => {
    const listId = getListId();
    if (!listId) return showError("Listen er ikke klar. Genindlæs siden.");
    try {
      await updateDoc(doc(db, "lists", listId, "items", id), {
        purchasedAt: checkbox.checked ? serverTimestamp() : null
      });
      hideError();
    } catch (err) {
      console.error("update purchasedAt:", err);
      showError("Kunne ikke opdatere. Tjek Firestore Rules.");
      checkbox.checked = !checkbox.checked; // rollback
    }
  });

  // Redigér navn/notes
  const commitEdit = async () => {
    const listId = getListId();
    if (!listId) return showError("Listen er ikke klar. Genindlæs siden.");
    const nm = nameEl.textContent.trim();
    const nt = notesEl.textContent.trim();
    try {
      if (!nm) {
        await deleteDoc(doc(db, "lists", listId, "items", id));
      } else {
        await updateDoc(doc(db, "lists", listId, "items", id), { name: nm, notes: nt });
      }
      hideError();
    } catch (err) {
      console.error("commitEdit:", err);
      showError("Kunne ikke gemme ændringer. Tjek Firestore Rules.");
    }
  };
  nameEl.addEventListener("blur",   commitEdit);
  notesEl.addEventListener("blur",  commitEdit);
  nameEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); } });
  notesEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); notesEl.blur(); } });

  // Fjern
  removeBtn.addEventListener("click", async () => {
    const listId = getListId();
    if (!listId) return showError("Listen er ikke klar. Genindlæs siden.");
    try {
      await deleteDoc(doc(db, "lists", listId, "items", id));
      hideError();
    } catch (err) {
      console.error("delete:", err);
      showError("Kunne ikke fjerne varen. Tjek Firestore Rules.");
    }
  });

  return node;
}

function renderList(snapshot) {
  listEl.innerHTML = "";
  const filter = $('input[name="filter"]:checked')?.value || "all";
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (filter === "active"    && data.purchasedAt)  return;
    if (filter === "purchased" && !data.purchasedAt) return;
    listEl.appendChild(renderItem(docSnap.id, data));
  });
}

async function startLiveQuery() {
  const id = await ensureList();
  if (!id) return;

  try {
    if (typeof unsubscribe === "function") unsubscribe();
    const itemsCol = collection(db, "lists", id, "items");
    const qy = query(itemsCol, orderBy("addedAt", "desc"));
    unsubscribe = onSnapshot(qy, (snap) => {
      hideError();
      renderList(snap);
    }, (err) => {
      console.error("onSnapshot:", err);
      showError(`Live-opdatering fejlede: ${err.code || err.message}`);
    });
  } catch (err) {
    console.error("startLiveQuery:", err);
    showError(`Kunne ikke starte live-query: ${err.code || err.message}`);
  }
}

// ---------- UI handlers ----------
$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nameIn  = $("#item-name");
  const notesIn = $("#item-notes");
  const nm = nameIn.value.trim();
  const nt = notesIn.value.trim();
  if (!nm) return;

  const listId = getListId();
  if (!listId) { showError("Listen er ikke klar. Tjek Firestore Rules og genindlæs."); return; }

  try {
    await addDoc(collection(db, "lists", listId, "items"), {
      name: nm,
      notes: nt || "",
      addedAt: serverTimestamp(),
      purchasedAt: null
    });
    nameIn.value = "";
    notesIn.value = "";
    hideError();
  } catch (err) {
    console.error("addDoc:", err);
    showError("Kunne ikke tilføje. Tjek Firestore Rules og Publish.");
  }
});

// Filtre
$$('.filters input[name="filter"]').forEach(r =>
  r.addEventListener("change", () => startLiveQuery())
);

// ---------- Init ----------
startLiveQuery();
