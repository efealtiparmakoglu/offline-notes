import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNote,
  exportNotes,
  importNotes,
  markdownToHtml,
  noteTitle,
  searchNotes,
  type Note,
} from "../src/core.ts";
import { memoryStore } from "../src/store.ts";

function note(id: string, title: string, body: string, updated = 1): Note {
  return { id, title, body, created: updated, updated };
}

test("noteTitle: explicit title wins; else first non-empty line", () => {
  assert.equal(noteTitle(note("1", "Title", "body")), "Title");
  assert.equal(noteTitle(note("1", "", "# Heading\nbody text")), "Heading");
  assert.equal(noteTitle(note("1", "", "")), "untitled");
});

test("searchNotes matches title and body, case-insensitive", () => {
  const notes = [
    note("1", "Grocery list", "milk eggs"),
    note("2", "Work", "finish the REPORT"),
    note("3", "random", "nothing"),
  ];
  assert.equal(searchNotes(notes, "report").length, 1);
  assert.equal(searchNotes(notes, "grocery").length, 1);
  assert.equal(searchNotes(notes, "egg").length, 1);
  assert.equal(searchNotes(notes, "").length, 3);
});

test("markdownToHtml: headings, lists, emphasis, code", () => {
  const html = markdownToHtml(
    "# Title\n\n- one\n- two\n\n1. first\n\n**bold** and *em* and `code`\n\n---",
  );
  assert.ok(html.includes("<h1>Title</h1>"));
  assert.ok(html.includes("<ul>\n<li>one</li>\n<li>two</li>\n</ul>"));
  assert.ok(html.includes("<ol>\n<li>first</li>\n</ol>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<em>em</em>"));
  assert.ok(html.includes("<code>code</code>"));
  assert.ok(html.includes("<hr>"));
});

test("markdownToHtml escapes html input", () => {
  const html = markdownToHtml('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("export envelope shape", () => {
  const envelope = exportNotes([note("1", "t", "b")]);
  assert.equal(envelope.format, "offline-notes");
  assert.equal(envelope.version, 1);
  assert.equal(envelope.notes.length, 1);
});

test("import: new notes imported, older duplicates skipped", () => {
  const existing = [note("a", "kept", "v1", 100)];
  const envelope = exportNotes([
    note("a", "older", "v0", 50),
    note("b", "new note", "v2", 200),
  ]);
  const { notes, imported, skipped } = importNotes(JSON.stringify(envelope), existing);
  assert.equal(notes.length, 2);
  assert.equal(imported, 1);
  assert.equal(skipped, 1);
  const kept = notes.find((n) => n.id === "a");
  assert.equal(kept?.title, "kept", "older duplicate must not overwrite");
});

test("import: newer duplicate wins", () => {
  const existing = [note("a", "old", "v1", 100)];
  const envelope = exportNotes([note("a", "newer", "v2", 300)]);
  const { notes, imported } = importNotes(JSON.stringify(envelope), existing);
  assert.equal(imported, 1);
  assert.equal(notes.find((n) => n.id === "a")?.title, "newer");
});

test("import rejects bad payloads", () => {
  assert.throws(() => importNotes("not json", []));
  assert.throws(() => importNotes(JSON.stringify({ format: "other" }), []));
});

test("memoryStore: put/get/delete round trip", async () => {
  const store = memoryStore();
  const n = createNote(1, "hello", "world");
  await store.put(n);
  assert.equal((await store.getAll()).length, 1);
  await store.delete(n.id);
  assert.equal((await store.getAll()).length, 0);
});
