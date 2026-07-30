# HOLLOWMERE

Full project spec: see SPEC.md in this directory — read it fully before making
changes. It defines the game design, tech stack, networking model, skill tree
content (61 nodes), and the 6 build phases.

Reference prototype (working single-player HTML/Canvas/vanilla-JS game with the
correct feel — read for movement/combat/values reference, not for structure):
reference/prototype.html

## Working conventions
- Windows host, but you're running under git-bash/MSYS in this session — use
  POSIX shell syntax.
- Commit working code at the end of each phase with a clear commit message
  (e.g. "Phase 1: scaffold + movement"). Don't commit broken builds.
- Run `npm run build` (or equivalent) to verify compilation before committing
  each phase.
- Keep a PHASE_NOTES.md updated with a short summary of what was built and what
  to test, appended after each phase.
