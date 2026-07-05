# Agent Instructions

These instructions apply to all agent-assisted work in this repository.

## Project Rules

1. Build dynamic systems. Do not hardcode product data, user-facing content, configuration, routes, permissions, prices, locales, or tenant-specific behavior when it should come from configuration, data, or a reusable module boundary.
2. Design and implement for responsive behavior across mobile, tablet, laptop, desktop, and wide desktop screen sizes. Validate that layouts do not overflow, overlap, or lose critical controls at different viewport widths.
3. Account for RTL and LTR support in UI, layout, spacing, typography, icons, directional controls, forms, tables, and content structure. Avoid assumptions that only work in English LTR.
4. Prefer ready shadcn/ui components over hand-rolled primitives when a maintained shadcn/ui component fits the use case. Use lower-level Radix or custom primitives only when shadcn/ui does not provide the needed behavior or the project has an established local abstraction.
5. If a task cannot be implemented end-to-end truthfully, leave a `TODO` comment at the exact code location that explains what remains and why it could not be completed yet.
6. Use product, release, and feature terminology in tracked files. Keep internal sequencing labels out of implementation-facing code, docs, comments, branch names, commits, and PR descriptions.
