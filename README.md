# todos

Eine Aufgabenverwaltung mit Next.js 15, React 18, TypeScript, Tailwind und
Supabase.

## Entwicklung

```bash
npm install
cp .env.local.example .env.local   # Supabase-URL und Anon-Key eintragen
npm run dev
```

Die SQL-Dateien unter `supabase/` bauen aufeinander auf und lassen sich
mehrfach ausführen. Die jüngste ist `schema_v20_journal.sql`.

## Design-System

Der Styleguide liegt als eigenständige Seite unter `design/styleguide.html`
und lässt sich ohne Build im Browser öffnen. Er zeigt jeden Baustein in
beiden Themes und in beiden Dichten. Die Tokens stehen zusätzlich als
`design/tokens.css` und sind in `src/app/globals.css` gespiegelt, wo die App
sie liest.

### Grundsätze

1. Eine Fläche, eine Linie. Flächen sind matt, kein `backdrop-filter`, kein
   Blur, keine Verläufe. Getrennt wird mit 1 px Linien, nicht mit Schatten.
   Schatten tragen nur Popover und Dialoge.
2. Eine Akzentfarbe. Sie markiert Auswahl, Fokus, Primäraktion und Links.
   Rot steht ausschließlich für überfällig, hohe Priorität und Löschen, Gelb
   nur für mittlere Priorität.
3. Drei Textfarben: `--text`, `--text-muted`, `--text-faint`. Keine weiteren
   Abstufungen und keine Opazitäten wie `text-white/25`.
4. Zeilen statt Karten. Aufgaben, Gewohnheiten, Projekte und Listen sind
   Zeilen fester Höhe in einer Spalte.
5. Kontext statt Modal. Details erscheinen in der rechten Spalte. Ein Dialog
   erscheint nur, wenn etwas endgültig verschwindet.
6. Ruhe. Keine Dauer-Animation. Übergänge 150 ms, nur bei Öffnen, Hover und
   Fokus. `prefers-reduced-motion` wird respektiert.
7. Alles erreichbar. Jede Aktion hat einen Weg mit Maus, Tastatur und
   Finger. Hover ist eine Abkürzung, nie der einzige Zugang.

### Farben

Jeder Wert hält mindestens 4,5:1 gegen die Fläche, auf der er steht.

| Token | Hell | Dunkel |
| --- | --- | --- |
| `--bg` | `#F6F7F9` | `#0F1115` |
| `--surface` | `#FFFFFF` | `#151821` |
| `--surface-2` | `#F1F3F6` | `#1B1F29` |
| `--surface-3` | `#E9ECF1` | `#222733` |
| `--border` | `#E3E6EB` | `#262B36` |
| `--border-strong` | `#CBD1DA` | `#343A47` |
| `--text` | `#14171C` | `#E7E9EE` |
| `--text-muted` | `#5B6470` | `#9AA3B2` |
| `--text-faint` | `#676F7C` | `#7C8593` |
| `--accent` | `#2A66D8` | `#5B8DEF` |
| `--danger` | `#CE3238` | `#E5484D` |
| `--warning` | `#9C600B` | `#E7A33A` |
| `--success` | `#1F7F4C` | `#3DBE7A` |

`--accent-contrast` ist die Schrift auf gefüllten Akzentflächen: weiß im
hellen Theme, `#0F1115` im dunklen, weil Weiß auf dem hellen Blau nur 3,2:1
ergibt.

Die Akzentfarbe ist als Preset wählbar (Blau, Indigo, Grün, Orange, Rosa,
Grau). Die Werte stehen in `ACCENT_PRESETS` in
`src/components/ThemeProvider.tsx` und, für den Moment vor dem ersten Paint,
noch einmal im Inline-Skript in `src/app/layout.tsx`. Beide müssen
zusammenpassen.

### Maße

| Token | Wert |
| --- | --- |
| `--row-h` | 40 px, kompakt 32 px |
| `--header-h` | 48 px |
| `--control-h` | 32 px |
| `--nav-w` | 240 px, eingeklappt 56 px |
| `--detail-w` | 400 px, ab 1536 px 440 px |
| `--radius` | 6 px |
| `--radius-lg` | 8 px |
| `--duration` | 150 ms |

Abstände folgen dem 4er-Raster. Schriftgrößen: 12 für Meta und
Gruppenüberschriften, 13 für Sekundärtext und Navigation, 14 für Zeilen,
Eingaben und Buttons, 16 für Paneltitel, 20 für Seitentitel. Gewichte nur
400, 500 und 600. Nichts unter 12 px.

### Layout

Die App läuft als CSS-Grid über die volle Breite und Höhe:
`240px minmax(0, 1fr) 400px` bei `100dvh`. Jede Spalte hat eine 48 px hohe
Kopfzeile und einen eigenen Scrollbereich; die Seite selbst scrollt nie.

- ab 1536 px: Detailpanel 440 px
- 1280 bis 1535 px: 240 / flexibel / 400
- 1024 bis 1279 px: Navigation als 56 px Icon-Leiste, Panel 380 px
- 768 bis 1023 px: Panel als Drawer von rechts über dem Inhalt
- unter 768 px: eine Spalte, Bottom-Navigation, Panel als Vollbild-Sheet

### Bausteine

`globals.css` stellt die Klassen bereit, aus denen die Oberfläche besteht:
`.app-shell`, `.app-nav`, `.app-content`, `.app-detail`, `.app-col-head`,
`.app-col-body`, `.nav-row`, `.task-row`, `.task-circle`, `.group-head`,
`.props`, `.prop-button`, `.quick-input`, `.btn` mit den Varianten
`primary`, `secondary`, `ghost`, `danger` und `text-danger`, `.icon-btn`,
`.input`, `.chip`, `.popover`, `.dialog`, `.toast-stack`, `.section-title`.

Popover, Dialog, Datumsauswahl und die Auswahllisten liegen als
Komponenten unter `src/components/ui/`. Wer ein neues Feld baut, nimmt sie
statt eigener Overlays.
