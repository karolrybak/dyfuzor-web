import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	// Relative base so the build works at any GitHub Pages subpath (no repo name needed).
	base: "./",
	plugins: [react()],
	// Excalidraw reads this at module load.
	define: {
		"process.env.IS_PREACT": JSON.stringify("false"),
	},
})
