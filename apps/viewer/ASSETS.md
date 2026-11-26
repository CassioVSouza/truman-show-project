# Viewer Assets & Licences

All 3D geometry, materials, animations, and UI icons in `apps/viewer` are **100% procedurally generated in code** using Three.js primitives and inline SVG.

| Asset | Source | Licence | Notes |
|---|---|---|---|
| Cabin, furniture, terrain, river, mirror pool, forest trees, berry bushes, thorn perimeter | Procedural Three.js geometry (`src/scene/worldScene.ts`) | Apache-2.0 (project-owned) | Driven directly by `@truman/world` `generateMap(seed)` |
| Articulated Resident character & poses | Procedural Three.js rig (`src/scene/worldScene.ts`) | Apache-2.0 (project-owned) | Low-poly primitive rig; posture & breathing driven by `body` events |
| UI icons (heart, lungs, search, lab, globe) | Inline SVG (`src/ui/`) | Apache-2.0 (project-owned) | No external icon packs or CDNs |

Zero paid assets, zero external CDN dependencies, zero uncertain-licence third-party models.
