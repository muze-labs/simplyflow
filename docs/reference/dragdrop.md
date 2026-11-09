# Drag and drop module

```js
import { app } from '@muze-labs/simplyflow/app'
```

Drag and drop connects source and destination elements to application handlers. Configure it through `app({ drags, drops })`.

## `app({ drags, drops })`

```html
<article draggable="true" data-simply-drag="card" data-simply-value="sketch">
  Sketch the board
</article>

<div data-simply-drop="column" data-simply-value="done">Done</div>
```

```js
const cardType = 'application/x-example-card-id'

app({
  data: { selectedCard: null, selectedColumn: null },

  drags: {
    card(element, id, event) {
      return {
        meta: { kind: 'card' },
        data: { [cardType]: id },
        effects: ['move']
      }
    }
  },

  drops: {
    column: {
      effects: ['move'],

      accepts(element, columnId, drag, event) {
        return drag.meta?.kind === 'card' && drag.types.includes(cardType)
      },

      drop(element, columnId, drag, event) {
        const id = drag.data[cardType]
        if (!id) return

        this.data.selectedCard = id
        this.data.selectedColumn = columnId
      }
    }
  }
})
```

Inside a handler, `this` is the app instance. The first two arguments are the element with the drag or drop attribute and its configured value. Use `data-simply-value` to supply a literal value. In a list template, use `data-simply-value=":value.id"` to supply the current item's ID. See [Command values](command.md#command-values) for the value syntax.

## Drag sources

`data-simply-drag` names a function in `drags`. Set `draggable="true"` for native browser dragging. The function runs synchronously and returns a description or `false` to cancel.

| Property | Description |
| --- | --- |
| `meta` | Optional public JSON object for hover checks. The encoded JSON is limited to 512 UTF-8 bytes before conversion to a type string. |
| `data` | Map from format names to string payloads. Format names are normalized to lowercase. |
| `effects` | Allowed operations from `copy`, `move` and `link`. Defaults to `['copy']`. |

## Drop targets

`data-simply-drop` names a destination in `drops`. A destination defines a required `drop` handler and may restrict its operations with `effects`. At least one effect must be allowed by both source and destination.

`accepts(element, value, drag, event)` is optional. If supplied, it must synchronously return `true` to accept the target. SimplyFlow calls it during hover and again on drop.

`drop(element, value, drag, event)` receives the captured payload and may return a promise. The application validates the payload and updates its data.

| Context property | Description |
| --- | --- |
| `drag.meta` | Decoded metadata, if available. |
| `drag.types` | Advertised formats, excluding the metadata marker. |
| `drag.effects` | Effects advertised by the source. |
| `drag.effect` | Effect selected for this destination. |
| `drag.before` | Insertion anchor for a sortable target. |
| `drag.data` | Map of string payloads, available to `drop` only. |

## Sortable targets

Set `data-simply-sort="vertical"` or `"horizontal"` on the destination. Sortable items are direct children marked with `data-simply-drag` and a value. Use stable IDs as item values.

`drag.before` contains the next item's value or `null` to append. Update the order in app data from the drop handler. Style the temporary attributes to show the insertion point.

| Attribute | Element |
| --- | --- |
| `data-simply-drag-over` | Accepted destination. |
| `data-simply-drop-before` | Item immediately after the insertion point. |
| `data-simply-drop-end` | Destination when the drop would append. |

## Touch and cross-window dragging

Add `data-simply-drag-handle` to the source or a child and set `touch-action: none` on the handle. Touch dragging is local to the page.

For native drags between windows, advertise a portable payload such as `text/plain` or `text/uri-list` alongside custom formats. Metadata travels in a custom type string and may be absent at the destination. Use `drag.types` and any available metadata to decide whether to accept a hover, then check the actual payload on drop.

A `move` effect describes the requested operation. The app decides when to remove a source item. The [Kanban example](../../examples/kanban/) uses a confirmation from the receiving window before removing the card.

## Lower-level API

From a source checkout, import `dragdrop` from `packages/app/src/dragdrop.mjs`.

```js
const controller = dragdrop({ app, container, drags, drops })
controller.cancel()
controller.destroy()
```

`container` defaults to `app.container`. `cancel()` clears the preview and resets the controller's drag state. `destroy()` also removes its listeners. When configured through `app({ drags, drops })`, the controller is available as `app.dragdrop` and is destroyed by `app.destroy()`.
