/* Note model, markdown preview and search — pure logic, no DOM/IDB. */

export interface Note {
  id: string;
  title: string;
  body: string; // markdown
  created: number; // epoch ms
  updated: number;
}

export function newId(now: number = Date.now()): string {
  return now.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function createNote(now: number, title = "", body = ""): Note {
  return { id: newId(now), title, body, created: now, updated: now };
}

/** Derive the title from the body when empty: first non-empty line. */
export function noteTitle(note: Note): string {
  if (note.title.trim() !== "") return note.title;
  const line = note.body.split("\n").find((l) => l.trim() !== "");
  return line ? line.replace(/^#+\s*/, "").slice(0, 60) : "untitled";
}

/** Case-insensitive substring search across title and body. */
export function searchNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLocaleLowerCase("en");
  if (q === "") return [...notes];
  return notes.filter(
    (note) =>
      note.title.toLocaleLowerCase("en").includes(q) ||
      note.body.toLocaleLowerCase("en").includes(q),
  );
}

/** Markdown → HTML for the preview: headings, lists, bold/italic/code,
 * links, rules, paragraphs. Escapes HTML in the source first. */
export function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const out: string[] = [];
  let listOpen: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const inline = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const closeList = (): void => {
    if (listOpen) {
      out.push(`</${listOpen}>`);
      listOpen = null;
    }
  };
  const closeParagraph = (): void => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  for (const raw of escaped.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2] as string)}</h${level}>`);
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      closeParagraph();
      closeList();
      out.push("<hr>");
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      closeParagraph();
      if (listOpen !== "ul") {
        closeList();
        out.push("<ul>");
        listOpen = "ul";
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      closeParagraph();
      if (listOpen !== "ol") {
        closeList();
        out.push("<ol>");
        listOpen = "ol";
      }
      out.push(`<li>${inline(numbered[1] as string)}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeParagraph();
      closeList();
      continue;
    }
    paragraph.push(line.trim());
  }
  closeParagraph();
  closeList();
  return out.join("\n");
}

/** Export format: versioned JSON envelope. */
export interface ExportEnvelope {
  format: "offline-notes";
  version: 1;
  exportedAt: number;
  notes: Note[];
}

export function exportNotes(notes: Note[]): ExportEnvelope {
  return {
    format: "offline-notes",
    version: 1,
    exportedAt: Date.now(),
    notes: [...notes],
  };
}

/** Import: validates the envelope, dedupes by id (newest wins). */
export function importNotes(
  text: string,
  existing: Note[],
): { notes: Note[]; imported: number; skipped: number } {
  let envelope: ExportEnvelope;
  try {
    envelope = JSON.parse(text) as ExportEnvelope;
  } catch {
    throw new Error("not valid JSON");
  }
  if (envelope.format !== "offline-notes" || !Array.isArray(envelope.notes)) {
    throw new Error("not an offline-notes export");
  }
  const byId = new Map<string, Note>();
  for (const note of existing) byId.set(note.id, note);
  let imported = 0;
  let skipped = 0;
  for (const note of envelope.notes) {
    if (!note.id || typeof note.body !== "string") {
      skipped++;
      continue;
    }
    const current = byId.get(note.id);
    if (current === undefined) {
      byId.set(note.id, note);
      imported++;
    } else if ((note.updated ?? 0) > (current.updated ?? 0)) {
      byId.set(note.id, note);
      imported++;
    } else {
      skipped++;
    }
  }
  return { notes: [...byId.values()], imported, skipped };
}
