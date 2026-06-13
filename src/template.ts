import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types"
// The hand-designed Excalidraw template is the starter scene. `?raw` inlines it at build time.
import templateRaw from "./template.excalidraw?raw"

/**
 * Starter scene loaded from `template.excalidraw`: a locked `dyfuzor:scene` frame, a left-hand
 * panel of linked fields (`dyfuzor:title|aesthetics|lighting|medium|art_style|photo`), a
 * `dyfuzor:palette` box of swatches, and example elements. Edit the boxes; `scene-to-prompt.ts`
 * turns the scene into an Ideogram prompt.
 */
export function initialElements(): NonNullable<ExcalidrawInitialDataState["elements"]> {
	const scene = JSON.parse(templateRaw) as ExcalidrawInitialDataState
	return scene.elements ?? []
}
