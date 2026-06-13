# dyfuzor-web

A tiny, self-contained web app that turns an **Excalidraw scene into an [Ideogram-4](https://about.ideogram.ai/)
structured JSON prompt** — draw a layout, copy or download the JSON, paste it into Ideogram.

No backend, no GPU, no dependencies beyond Vite + React + Excalidraw. Static build → deploys
straight to GitHub Pages.

## Run

```sh
bun install
bun run dev      # open the printed localhost URL
bun run build    # static site → dist/
```

## How it maps the scene (`src/scene-to-prompt.ts`)

Fields are classified by their Excalidraw `link`; scene content by shape:

| You draw…                                          | Becomes…                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| locked rect, link `dyfuzor:scene`                  | the 0..1000 coordinate frame (its aspect ratio → image size) |
| box/text, link `dyfuzor:title`                     | `high_level_description`                            |
| box/text, link `dyfuzor:aesthetics`/`lighting`/`medium`/`art_style`/`photo` | the matching `style_description` field |
| box `dyfuzor:palette` with colored rects inside    | `style_description.color_palette` (their fill colors) |
| box/text, link `dyfuzor:bg`                        | `background`                                        |
| **inside the frame:** rectangle with bound text    | an `obj` element (`desc` = the text)                |
| **inside the frame:** free text `literal :: description` | a `text` element                              |

An element's own stroke/fill (minus white/black/transparent) becomes its per-element
`color_palette`. `style_description` is all-or-nothing — it needs `aesthetics` + `lighting` +
`medium` + (`art_style` or `photo`). The starter scene (`src/template.excalidraw`) ships a
labelled panel to fill in.

## Deploy to GitHub Pages

Push to `main`; the included workflow (`.github/workflows/pages.yml`) builds and publishes.
Enable it once under **Settings → Pages → Source: GitHub Actions**. The build uses a relative
base path, so it works at any `username.github.io/repo/` URL without configuration.
