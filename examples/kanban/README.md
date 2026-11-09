# Kanban

Extract this folder into SimplyFlow's `examples/` directory so the page is at
`examples/kanban/index.html`.

This example uses the local SimplyFlow browser bundle. Install `dragdrop.mjs`
in `packages/app/src/` and apply the accompanying `simply-app-dragdrop.patch`
if your checkout does not already include drag and drop. Then run these
commands from the repository root.

```sh
npm ci
npm run build-dev
python3 -m http.server 8000
```

Open [the Kanban example](http://localhost:8000/examples/kanban/). Try
reordering the two cards in To do, then dropping one into the empty Done
column. Then open the same URL in a second window and drag a card there.
Use the same browser profile and the same origin in both windows. Touch
dragging starts at the grip and works within one page.

The columns and cards are SimplyFlow lists. The drop handler passes the
destination and insertion anchor to `moveCard`, which updates the data.
Each window keeps its own board in memory. A drop in another window inserts
the card and acknowledges the transfer over a BroadcastChannel. The source
removes its card after it receives the acknowledgement. Separate browsers
or profiles cannot exchange that acknowledgement. If the drag payload gets
through, the destination adds a copy and the source retains its card.
