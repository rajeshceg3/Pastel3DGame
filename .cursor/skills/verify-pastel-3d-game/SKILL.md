# Verify Pastel3DGame
Pastel 3D Game - single-file 3D crafting game (three.js).
## Launch
Any static file server from the repo root.
## Doctor
`python3 .cursor/skills/verify-pastel-3d-game/verify.py`
## Drive
Serves the static site and renders it in headless Chromium asserting the boot marker, crafting menu, and zero JS console errors.
## Evidence
`.cursor/skills/verify-pastel-3d-game/evidence.json`
## Cleanup
Static server terminated after the render.
## Known boundaries
Render smoke only; scene quality and e2e suites not exercised here.
