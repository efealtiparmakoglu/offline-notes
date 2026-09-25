# offline-notes

Local-first notes app — IndexedDB storage, markdown preview, JSON
import/export, full-text search. Single-file offline HTML, zero npm
dependencies (build uses Node's native TypeScript stripping).

```text
$ npm test          # 9 core tests (Node)
$ npm run build     # -> dist/index.html (open in any browser)
```

## Features

- **Local-first** — notes live in IndexedDB; there is no server and no
  network access. Works from `file://` after the single build.
- **Markdown preview** — hand-written converter for headings, lists,
  emphasis, code, links and rules; source HTML is escaped first, so
  `<script>` in a note can't inject anything.
- **Derived titles** — empty title falls back to the first non-empty
  body line (heading markup stripped).
- **Search** — case-insensitive substring match across titles and
  bodies.
- **Import/export** — versioned JSON envelope; import dedupes by id and
  keeps the newest version (older duplicates are skipped with a count).

## Storage abstraction

`store.ts` defines one `NoteStore` interface with two implementations:
IndexedDB (browser) and an in-memory map (tests / no-IDB fallback).
`openStore()` picks the best available — the UI and the test suite
exercise the identical interface.

## Development

```console
$ npm test          # markdown, search, export/import, store round trip
$ npm run build
```

## License

MIT — see [LICENSE](LICENSE).
