import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { useCallback, useRef, useState } from "react"
import {
	type SceneElement,
	sceneDimensions,
	sceneToPrompt,
	type SizePreset,
} from "./scene-to-prompt.ts"
import { initialElements } from "./template.ts"

interface ExcalidrawApi {
	getSceneElements: () => readonly unknown[]
}

/** A square glyph whose size encodes the small/medium/large preset. */
function SizeGlyph({ px }: { px: number }) {
	const off = (20 - px) / 2
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<rect x={off} y={off} width={px} height={px} rx="2" fill="currentColor" />
		</svg>
	)
}

const SIZE_PRESETS: { id: SizePreset; label: string; px: number }[] = [
	{ id: "small", label: "small (≤512)", px: 8 },
	{ id: "medium", label: "medium (~1 MP)", px: 13 },
	{ id: "large", label: "large (≤2048)", px: 18 },
]

export function App() {
	const apiRef = useRef<ExcalidrawApi | null>(null)
	const [status, setStatus] = useState("draw a scene, then copy or download the Ideogram JSON")
	const [promptJson, setPromptJson] = useState("")
	const [dims, setDims] = useState(() => ({ width: 1024, height: 1024 }))
	const [sizePreset, setSizePresetState] = useState<SizePreset>("medium")
	const sizePresetRef = useRef<SizePreset>("medium")

	const onSceneChange = useCallback((elements: readonly unknown[]) => {
		const next = sceneDimensions(elements as unknown as SceneElement[], sizePresetRef.current)
		setDims((prev) => (prev.width === next.width && prev.height === next.height ? prev : next))
	}, [])

	const setSizePreset = useCallback((preset: SizePreset) => {
		sizePresetRef.current = preset
		setSizePresetState(preset)
		const elements = apiRef.current?.getSceneElements()
		if (elements) setDims(sceneDimensions(elements as unknown as SceneElement[], preset))
	}, [])

	const buildJson = useCallback((): string | null => {
		const api = apiRef.current
		if (!api) return null
		const elements = api.getSceneElements() as unknown as SceneElement[]
		const { prompt } = sceneToPrompt(elements, sizePresetRef.current)
		const json = JSON.stringify(prompt, null, 2)
		setPromptJson(json)
		return json
	}, [])

	const copyPrompt = useCallback(async () => {
		const json = buildJson()
		if (!json) return
		try {
			await navigator.clipboard.writeText(json)
			setStatus("Ideogram JSON copied to clipboard ✓")
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err))
		}
	}, [buildJson])

	const downloadPrompt = useCallback(() => {
		const json = buildJson()
		if (!json) return
		const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
		const a = document.createElement("a")
		a.href = url
		a.download = "ideogram-prompt.json"
		a.click()
		URL.revokeObjectURL(url)
		setStatus("downloaded ideogram-prompt.json ✓")
	}, [buildJson])

	return (
		<div className="app">
			<div className="canvas">
				<Excalidraw
					excalidrawAPI={(api) => {
						apiRef.current = api as unknown as ExcalidrawApi
					}}
					onChange={onSceneChange}
					initialData={{ elements: initialElements(), scrollToContent: true }}
				/>
			</div>
			<aside className="panel">
				<h1>dyfuzor — scene → Ideogram</h1>
				<div className="row">
					<span>image size</span>
					<strong>
						{dims.width} × {dims.height}
					</strong>
				</div>
				<div className="sizes">
					{SIZE_PRESETS.map((p) => (
						<button
							key={p.id}
							type="button"
							className={sizePreset === p.id ? "active" : ""}
							title={p.label}
							aria-label={p.label}
							aria-pressed={sizePreset === p.id}
							onClick={() => setSizePreset(p.id)}
						>
							<SizeGlyph px={p.px} />
						</button>
					))}
				</div>
				<button type="button" onClick={copyPrompt}>
					Copy Ideogram JSON
				</button>
				<button type="button" className="secondary" onClick={downloadPrompt}>
					Download .json
				</button>
				<div className="status">{status}</div>
				{promptJson && (
					<details open>
						<summary>prompt JSON</summary>
						<pre>{promptJson}</pre>
					</details>
				)}
			</aside>
		</div>
	)
}
