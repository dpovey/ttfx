# TODO

## Roadmap

### Unit System (inspired by Squants)

- [ ] [2026-02-21] Implicit same-dimension addition — `kilometers(1) + meters(500)` should auto-convert (Squants behavior)
- [ ] [2026-02-21] More unit domains — Data (bytes, KB, MB, GB), Angle (radians, degrees), Frequency (Hz), Currency
- [ ] [2026-02-21] Vector types with units — `Vec3<Length>` for 3D positions with unit-typed components
- [ ] [2026-02-21] Extension method syntax — `(100).meters` in addition to `meters(100)` (Squants DSL)
- [ ] [2026-02-21] Unit formatting — configurable display (scientific notation, significant figures)
- [ ] [2026-02-21] Unit parsing — parse strings like `"100 km/h"` into typed units at runtime
