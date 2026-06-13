/**
 * Ideogram-4 prompt shape + a small builder. Plain TypeScript (vendored from the dyfuzor
 * toolkit) so this demo stays dependency-free — no arktype, no runtime validation.
 */

/** Uppercase hex color, e.g. `#00F0FF`. */
export type HexColor = `#${string}`
/** Bounding box `[y_min, x_min, y_max, x_max]` on a 0..1000 grid. */
export type BBox = [number, number, number, number]

interface BaseStyle {
	aesthetics: string
	lighting: string
	medium: string
	color_palette?: HexColor[]
}
/** Photographic style — uses `photo`, no `art_style`. */
export interface PhotoStyle extends BaseStyle {
	photo: string
}
/** Graphic/artistic style — uses `art_style`, no `photo`. */
export interface ArtStyle extends BaseStyle {
	art_style: string
}
export type IdeogramStyle = PhotoStyle | ArtStyle

export interface ObjElement {
	type: "obj"
	bbox?: BBox
	desc: string
	color_palette?: HexColor[]
}
export interface TextElement {
	type: "text"
	bbox?: BBox
	text: string
	desc: string
	color_palette?: HexColor[]
}
export type IdeogramElement = ObjElement | TextElement

export interface IdeogramComposition {
	background: string
	elements: IdeogramElement[]
}

export interface IdeogramPrompt {
	high_level_description?: string
	style_description?: IdeogramStyle
	compositional_deconstruction: IdeogramComposition
}

export interface IdeogramPromptInput {
	/** 1-2 sentence summary of the whole scene. Strongly recommended. */
	highLevel?: string
	style?: IdeogramStyle
	background: string
	elements: IdeogramElement[]
}

/** Build a prompt from a flat, ergonomic input. */
export function ideogramPrompt(input: IdeogramPromptInput): IdeogramPrompt {
	const prompt: IdeogramPrompt = {
		compositional_deconstruction: {
			background: input.background,
			elements: input.elements,
		},
	}
	if (input.highLevel) prompt.high_level_description = input.highLevel
	if (input.style) prompt.style_description = input.style
	return prompt
}
