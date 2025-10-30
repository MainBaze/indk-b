// index.js
import {
  db, doc, setDoc, getDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, updateDoc, deleteDoc
} from "./firebase.js";

// URL-hjælpere
const params = new URLSearchParams(location.search);
const getListId = () => params.get("id");
const setListId = (id) => {
  const p = new URLSearchParams(location.search);
  p.set("id", id);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);
};

// DOM
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const listEl = $("#list");
const tpl = $("#item-template");

// Datoformat på dansk
const fmtDate = (ts) => {
  if (!ts) return "";
  try {
    const dt = ts.toDate ? ts.toDate() : new Date(ts);
    return dt.toLocaleDateString("da-DK");
  } catch { return ""; }
};

let unsubscribe = null;

// Sørg for at der findes én standard-liste
async function ensureList() {
  let id = getListId();
  if (!id) {
    const listRef = doc(collection(db, "lists"));
    await setDoc(listRef, { createdAt: serverTimestamp(), title: "Indkøbsliste" });
    id = listRef.id;
    setListId(id);
  }
  return id;
}

function renderItem(id, data) {
  const node = tpl.content.firstElementChild.cloneNode(true);

  const checkbox = $(".toggle", node);
  const name = $(".name", node);
  const notes = $(".notes", node);
  const added = $(".meta .added", node);
  const purchased = $(".meta .purchased", node);
  const removeBtn = $(".remove", node);

  name.textContent = data.name || "";
  notes.textContent = data.notes || "";
  checkbox.checked = !!data.purchasedAt;
  name.classList.toggle("purchased", !!data.purchasedAt);

  if (data.addedAt) added.textContent = `Tilføjet: ${fmtDate(data.addedAt)}`;
  if (data.purchasedAt) {
    purchased.hidden = false;
    purchased.textContent = `Købt: ${fmtDate(data.purchasedAt)}`;
  } else {
    purchased.hidden = true;
  }

  checkbox.addEventListener("change", async () => {
    const purchasedAt = checkbox.checked ? serverTimestamp() : null;
    await updateDoc(doc(db, "lists", getListId(), "items", id), { purchasedAt });
  });

  const commitEdit = async () => {
    const nm = name.textContent.trim();
    const nt = notes.textContent.trim();
    if (!nm) {
      await deleteDoc(doc(db, "lists", getListId(), "items", id));
      return;
    }
    await updateDoc(doc(db, "lists", getListId(), "items", id), { name: nm, notes: nt });
  };

  name.addEventListener("blur", commitEdit);
  notes.addEventListener("blur", commitEdit);
  name.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
  notes.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); notes.blur(); } });

  removeBtn.addEventListener("click", async () => {
    await deleteDoc(doc(db, "lists", getListId(), "items", id));
  });

  return node;
}

function renderList(snapshot) {
  listEl.innerHTML = "";
  const filter = $('input[name="filter"]:checked')?.value || "all";

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (filter === "active" && data.purchasedAt) return;
    if (filter === "purchased" && !data.purchasedAt) return;
    listEl.appendChild(renderItem(docSnap.id, data));
  });
}

async function startLiveQuery() {
  const id = await ensureList();
  if (unsubscribe) unsubscribe();

  const itemsCol = collection(db, "lists", id, "items");
  const q = query(itemsCol, orderBy("addedAt", "desc"));
  unsubscribe = onSnapshot(q, (snap) => renderList(snap));
}

// Tilføj vare
$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#item-name");
  const notes = $("#item-notes");
  const nm = name.value.trim();
  const nt = notes.value.trim();
  if (!nm) return;

  await addDoc(collection(db, "lists", getListId(), "items"), {
    name: nm,
    notes: nt || "",
    addedAt: serverTimestamp(),
    purchasedAt: null
  });

  name.value = "";
  notes.value = "";
});

// Filtre
$$('.filters input[name="filter"]').forEach(r =>
  r.addEventListener("change", () => startLiveQuery())
);

// Start app
startLiveQuery();
