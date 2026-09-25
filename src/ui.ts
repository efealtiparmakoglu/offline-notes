/* DOM layer: sidebar list, editor, live markdown preview, import/export,
 * delete. Uses openStore() — IndexedDB in the browser. */

import {
  createNote,
  exportNotes,
  importNotes,
  markdownToHtml,
  newId,
  noteTitle,
  searchNotes,
  type Note,
} from "./core.ts";
import { openStore, type NoteStore } from "./store.ts";

let store: NoteStore;
let notes: Note[] = [];
let activeId: string | null = null;
let filter = "";

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

async function refreshList(): Promise<void> {
  notes = await store.getAll();
  notes.sort((a, b) => b.updated - a.updated);
  const listEl = $("list");
  listEl.innerHTML = "";
  for (const note of searchNotes(notes, filter)) {
    const item = document.createElement("button");
    item.className = "note-item" + (note.id === activeId ? " active" : "");
    item.innerHTML = `<strong></strong><small></small>`;
    (item.querySelector("strong") as HTMLElement).textContent = noteTitle(note);
    (item.querySelector("small") as HTMLElement).textContent = new Date(
      note.updated,
    ).toLocaleString();
    item.addEventListener("click", () => selectNote(note.id));
    listEl.appendChild(item);
  }
  $("count").textContent = `${notes.length} note(s)`;
}

function selectNote(id: string): void {
  activeId = id;
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  ($("title") as HTMLInputElement).value = note.title;
  ($("body") as HTMLTextAreaElement).value = note.body;
  updatePreview();
  void refreshList();
}

function updatePreview(): void {
  const body = ($("body") as HTMLTextAreaElement).value;
  $("preview").innerHTML = markdownToHtml(body);
  $("preview-title").textContent =
    ($("title") as HTMLInputElement).value || noteTitle({
      ...(notes[0] ?? createNote(0)),
      id: activeId ?? "0",
      title: ($("title") as HTMLInputElement).value,
      body,
    } as Note);
}

async function saveActive(): Promise<void> {
  if (!activeId) return;
  const note = notes.find((n) => n.id === activeId);
  if (!note) return;
  note.title = ($("title") as HTMLInputElement).value;
  note.body = ($("body") as HTMLTextAreaElement).value;
  note.updated = Date.now();
  await store.put(note);
  await refreshList();
}

function newNote(): void {
  const note = createNote(Date.now(), "", "");
  notes.push(note);
  store.put(note).then(() => {
    activeId = note.id;
    ($("title") as HTMLInputElement).value = "";
    ($("body") as HTMLTextAreaElement).value = "";
    void refreshList();
    ($("title") as HTMLInputElement).focus();
  });
}

async function deleteActive(): Promise<void> {
  if (!activeId) return;
  await store.delete(activeId);
  activeId = null;
  ($("title") as HTMLInputElement).value = "";
  ($("body") as HTMLTextAreaElement).value = "";
  updatePreview();
  await refreshList();
}

function downloadExport(): void {
  const envelope = exportNotes(notes);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function importClick(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const { notes: imported, imported: count, skipped } = importNotes(text, notes);
      for (const note of imported) await store.put(note);
      await refreshList();
      $("import-status").textContent =
        `imported ${count}, skipped ${skipped} (older/invalid)`;
    } catch (error) {
      $("import-status").textContent = `error: ${String(error)}`;
    }
  });
  input.click();
}

async function setup(): Promise<void> {
  store = await openStore();
  notes = await store.getAll();
  notes.sort((a, b) => b.updated - a.updated);
  if (notes.length === 0) {
    const welcome = createNote(
      Date.now(),
      "Welcome",
      "# offline notes\n\n- everything is stored **locally** (IndexedDB)\n- write **markdown**, see the preview\n- export/import as JSON from the toolbar\n\nstart typing…",
    );
    await store.put(welcome);
    notes.push(welcome);
  }
  activeId = notes[0]?.id ?? null;
  selectNote(activeId as string);

  $("new-note").addEventListener("click", newNote);
  $("delete").addEventListener("click", deleteActive);
  $("export").addEventListener("click", downloadExport);
  $("import").addEventListener("click", importClick);
  $("search").addEventListener("input", (event) => {
    filter = (event.target as HTMLInputElement).value;
    void refreshList();
  });
  ($("title") as HTMLInputElement).addEventListener("input", () => {
    void saveActive();
    updatePreview();
  });
  ($("body") as HTMLTextAreaElement).addEventListener("input", () => {
    void saveActive();
    updatePreview();
  });
  setInterval(() => {
    void refreshList();
  }, 15000);
}

setup();
