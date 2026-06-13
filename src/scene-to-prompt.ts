import {
	type BBox,
	type IdeogramElement,
	type IdeogramPrompt,
	type IdeogramPromptInput,
	type IdeogramStyle,
	ideogramPrompt,
} from "./ideogram.ts"

/** Link value marking the locked rectangle that defines the 0..1000 coordinate frame. */
export const SCENE_LINK = "dyfuzor:scene"

/** Minimal structural view of an Excalidraw element — keeps this mapper pure & testable. */
export interface SceneElement {
	id: string
	type: string
	x: number
	y: number
	width: number
	height: number
	link?: string | null
	containerId?: string | null
	/** Wrapped text as displayed (bound text in a narrow box gets hard `\n`s inserted). */
	text?: string
	/** Unwrapped text as actually typed — prefer this; it has no auto-wrap newlines. */
	originalText?: string | null
	strokeColor?: string | null
	backgroundColor?: string | null
	locked?: boolean
}

interface Frame {
	x: number
	y: number
	w: number
	h: number
}

/** What `sceneToPrompt` returns: the prompt plus output dimensions from the frame aspect ratio. */
export interface SceneResult {
	prompt: IdeogramPrompt
	width: number
	height: number
}

/** Output-size preset: small/large pin the longest side to 512/2048; medium targets ~1 MP. */
export type SizePreset = "small" | "medium" | "large"

// The style fields the schema's PhotoStyle/ArtStyle union needs.
const STYLE_FIELDS = ["aesthetics", "lighting", "medium", "photo", "art_style"] as const
type StyleField = (typeof STYLE_FIELDS)[number]

type LinkTag =
	| { kind: "scene" }
	| { kind: "palette" }
	| { kind: "background" }
	| { kind: "highLevel" }
	| { kind: "style"; field: StyleField }
	| { kind: "none" }

/**
 * Classify an element's `link` into a dyfuzor role. Accepts the namespaced
 * `dyfuzor:<role>` form (the template convention) and a few bare/legacy aliases.
 * The shape (rectangle vs text) does NOT matter — only the link does.
 */
function classifyLink(link: string | null | undefined): LinkTag {
	if (!link) return { kind: "none" }
	const l = link.trim().toLowerCase()
	// Legacy `style:<field>` form.
	if (l.startsWith("style:")) {
		const field = l.slice("style:".length)
		if ((STYLE_FIELDS as readonly string[]).includes(field)) {
			return { kind: "style", field: field as StyleField }
		}
		return { kind: "none" }
	}
	const body = l.startsWith("dyfuzor:") ? l.slice("dyfuzor:".length) : l
	if (body === "scene") return { kind: "scene" }
	if (body === "palette") return { kind: "palette" }
	if (body === "bg" || body === "background") return { kind: "background" }
	if (body === "title" || body === "hl" || body === "highlevel" || body === "high_level") {
		return { kind: "highLevel" }
	}
	if ((STYLE_FIELDS as readonly string[]).includes(body)) {
		return { kind: "style", field: body as StyleField }
	}
	return { kind: "none" }
}

function clamp1000(value: number): number {
	return Math.max(0, Math.min(1000, Math.round(value)))
}

/** Map an element's geometry into Ideogram's `[y_min, x_min, y_max, x_max]` 0..1000 box. */
function toBBox(el: SceneElement, frame: Frame): BBox {
	const x0 = ((el.x - frame.x) / frame.w) * 1000
	const y0 = ((el.y - frame.y) / frame.h) * 1000
	const x1 = ((el.x + el.width - frame.x) / frame.w) * 1000
	const y1 = ((el.y + el.height - frame.y) / frame.h) * 1000
	return [clamp1000(y0), clamp1000(x0), clamp1000(y1), clamp1000(x1)]
}

function centerInside(el: SceneElement, f: Frame): boolean {
	const cx = el.x + el.width / 2
	const cy = el.y + el.height / 2
	return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h
}

function append(base: string, text: string): string {
	return base ? `${base} ${text}` : text
}

/** Unwrapped text of an element (no Excalidraw auto-wrap newlines). */
function rawText(el: SceneElement): string {
	return el.originalText ?? el.text ?? ""
}

/** Collapse all whitespace runs (incl. newlines) to single spaces — for prose-y descriptions. */
function oneLine(s: string): string {
	return s.replace(/\s+/g, " ").trim()
}

/** Normalize an Excalidraw color to an uppercase `#RRGGBB`, or null (transparent/invalid). */
function normHex(color: string | null | undefined): string | null {
	if (!color) return null
	let s = color.trim().toLowerCase()
	if (!s || s === "transparent") return null
	if (/^#[0-9a-f]{3}$/.test(s)) {
		s = `#${s
			.slice(1)
			.split("")
			.map((c) => c + c)
			.join("")}`
	}
	if (!/^#[0-9a-f]{6}$/.test(s)) return null
	return s.toUpperCase()
}

// Per-element palettes drop transparent, plain white/black, and Excalidraw's default ink.
const PER_ELEMENT_SKIP = new Set(["#FFFFFF", "#000000", "#1E1E1E"])

/** Collect an element's own swatch colors (stroke + fill), skipping white/black/transparent. */
function elementSwatches(el: SceneElement): string[] {
	const out: string[] = []
	for (const c of [el.strokeColor, el.backgroundColor]) {
		const h = normHex(c)
		if (h && !PER_ELEMENT_SKIP.has(h) && !out.includes(h)) out.push(h)
	}
	return out.slice(0, 5)
}

/** Build a complete PhotoStyle/ArtStyle (optionally with a palette), or undefined if incomplete. */
function buildStyle(
	fields: Partial<Record<StyleField, string>>,
	palette: string[],
): IdeogramStyle | undefined {
	const { aesthetics, lighting, medium, photo, art_style } = fields
	if (!aesthetics || !lighting || !medium) return undefined
	const pal = palette.length ? { color_palette: palette as `#${string}`[] } : {}
	if (photo) return { aesthetics, lighting, medium, photo, ...pal }
	if (art_style) return { aesthetics, lighting, medium, art_style, ...pal }
	return undefined
}

/** Locate the coordinate frame (locked `dyfuzor:scene` rect), or a default 1000² frame. */
function findFrame(elements: SceneElement[]): Frame {
	const sceneRects = elements.filter(
		(e) => e.type === "rectangle" && classifyLink(e.link).kind === "scene",
	)
	const scene = sceneRects.find((e) => e.locked) ?? sceneRects[0]
	return scene
		? { x: scene.x, y: scene.y, w: scene.width, h: scene.height }
		: { x: 0, y: 0, w: 1000, h: 1000 }
}

/**
 * Output dimensions from the frame's aspect ratio, snapped to multiples of 16.
 * - `medium` (default): keep the area near ~1 MP (1024²).
 * - `small` / `large`: pin the longest side to 512 / 2048, preserving the aspect ratio.
 */
function frameDimensions(
	frame: Frame,
	preset: SizePreset = "medium",
): { width: number; height: number } {
	const ar = frame.h > 0 ? frame.w / frame.h : 1
	const snap = (n: number) => Math.min(2048, Math.max(256, Math.round(n / 16) * 16))
	if (preset === "medium") {
		const TARGET = 1024
		const h = Math.sqrt((TARGET * TARGET) / ar)
		return { width: snap(h * ar), height: snap(h) }
	}
	const longest = preset === "small" ? 512 : 2048
	const w = ar >= 1 ? longest : longest * ar
	const h = ar >= 1 ? longest / ar : longest
	return { width: snap(w), height: snap(h) }
}

/** Cheap, prompt-free readout of the output size implied by the scene frame + size preset. */
export function sceneDimensions(
	elements: SceneElement[],
	preset: SizePreset = "medium",
): { width: number; height: number } {
	return frameDimensions(findFrame(elements), preset)
}

/**
 * Map an Excalidraw scene to an Ideogram prompt (dyfuzor template conventions):
 * - panel fields are classified by `link` (`dyfuzor:title|aesthetics|lighting|medium|
 *   art_style|photo|palette|bg`), regardless of whether they're a box or free text;
 *   a box's content is its bound text, a text's content is its own text.
 * - `dyfuzor:palette` box → `style.color_palette` (background colors of the rects inside it).
 * - the locked `dyfuzor:scene` rectangle is the 0..1000 coordinate frame; its aspect ratio
 *   sets the output width/height (multiples of 16).
 * - inside the frame: a rectangle with bound text → `obj` (desc = bound text); free text →
 *   `text`, split on `::` into `text :: desc` (no `::` ⇒ desc = text). Each element's own
 *   stroke/fill colors (minus white/black) become its per-element `color_palette`.
 */
export function sceneToPrompt(
	elements: SceneElement[],
	preset: SizePreset = "medium",
): SceneResult {
	const frame = findFrame(elements)

	// Text bound to a container (rectangle label) — used both for panel fields and obj desc.
	// Use the unwrapped `originalText` so narrow boxes don't leak auto-wrap newlines.
	const boundText = new Map<string, string>()
	for (const e of elements) {
		if (e.type === "text" && e.containerId) {
			const raw = rawText(e).trim()
			if (raw) boundText.set(e.containerId, append(boundText.get(e.containerId) ?? "", raw))
		}
	}

	// Palette: background colors of every rectangle inside the `dyfuzor:palette` box.
	const paletteBox = elements.find((e) => classifyLink(e.link).kind === "palette")
	const palette: string[] = []
	if (paletteBox) {
		const pf: Frame = {
			x: paletteBox.x,
			y: paletteBox.y,
			w: paletteBox.width,
			h: paletteBox.height,
		}
		for (const e of elements) {
			if (e === paletteBox || e.type !== "rectangle") continue
			if (!centerInside(e, pf)) continue
			const h = normHex(e.backgroundColor)
			if (h && !palette.includes(h)) palette.push(h)
		}
	}

	const objects: IdeogramElement[] = []
	const texts: IdeogramElement[] = []
	const styleFields: Partial<Record<StyleField, string>> = {}
	let background = ""
	let highLevel = ""

	/** Read a panel field's content (single-line): bound text for a box, own text otherwise. */
	const fieldContent = (e: SceneElement): string =>
		oneLine(e.type === "rectangle" ? (boundText.get(e.id) ?? "") : rawText(e))

	for (const e of elements) {
		const tag = classifyLink(e.link)
		if (tag.kind === "scene" || tag.kind === "palette") continue
		if (tag.kind === "background") {
			background = append(background, fieldContent(e))
			continue
		}
		if (tag.kind === "highLevel") {
			highLevel = append(highLevel, fieldContent(e))
			continue
		}
		if (tag.kind === "style") {
			styleFields[tag.field] = append(styleFields[tag.field] ?? "", fieldContent(e))
			continue
		}

		// Unlinked element → potential scene content. Only what the user drew inside the frame.
		if (e.locked) continue
		if (!centerInside(e, frame)) continue

		if (e.type === "rectangle") {
			const desc = oneLine(boundText.get(e.id) ?? "")
			if (!desc) continue
			const swatches = elementSwatches(e)
			objects.push({
				type: "obj",
				bbox: toBBox(e, frame),
				desc,
				...(swatches.length ? { color_palette: swatches as `#${string}`[] } : {}),
			})
		} else if (e.type === "text" && !e.containerId) {
			const raw = rawText(e).trim()
			if (!raw) continue
			const parts = raw.split("::")
			// Literal text keeps intentional line breaks (free text never auto-wraps); desc is prose.
			const literal = (parts[0] ?? "").trim()
			if (!literal) continue
			const desc = oneLine(parts.slice(1).join("::")) || literal
			const swatches = elementSwatches(e)
			texts.push({
				type: "text",
				bbox: toBBox(e, frame),
				text: literal,
				desc,
				...(swatches.length ? { color_palette: swatches as `#${string}`[] } : {}),
			})
		}
	}

	const input: IdeogramPromptInput = { background, elements: [...objects, ...texts] }
	if (highLevel) input.highLevel = highLevel
	const style = buildStyle(styleFields, palette)
	if (style) input.style = style
	return { prompt: ideogramPrompt(input), ...frameDimensions(frame, preset) }
}
