# SimplyEdit package

```js
import { edit } from '@muze-labs/simplyedit'
```

`@muze-labs/simplyedit` is an experimental editor application layer built on top of SimplyFlow. It is separate from the core `@muze-labs/simplyflow` package: SimplyFlow renders and binds data, while SimplyEdit owns editing sessions, the floating toolbar, and rich-text engine integration.

## Data format

Rich text values are stored as HTML strings.

```js
const data = {
  title: 'A page title',
  body: '<p>Hello <strong>world</strong>.</p>'
}
```

SimplyFlow already renders string field values as HTML, so rich text does not need a special `html` transformer. Use the built-in `escape_html` transformer when you want to show the same string literally, for example in a source preview.

## Basic usage

```html
<h1 data-simply-field="title" data-simply-editable="richtext"></h1>
<article data-simply-field="body" data-simply-editable="richtext"></article>

<pre data-simply-field="body" data-simply-transform="escape_html"></pre>
```

```js
import { edit } from '@muze-labs/simplyedit'

const editor = edit({
  container: document.body,
  data: {
    title: 'A small editable page',
    body: '<p>This is <strong>stored HTML</strong>.</p>'
  }
})
```

Editable rich-text fields use `data-simply-field` for normal rendering and `data-simply-editable="richtext"` to opt in to SimplyEdit's editor session. The editor writes changed HTML back to the same `app.data` path.

## Toolbar behavior

Focusing or clicking an editable field activates the editing session, but does not automatically show the toolbar. The toolbar appears when there is a non-collapsed selection inside the active field. Users can also press `Control+Space` to show the toolbar at the caret when the selection is collapsed. `Escape` hides the toolbar again without leaving the editing session.

The floating toolbar uses a visible cursor anchor: a small rotated square positioned at the current selection/caret. The toolbar is positioned relative to that anchor with native CSS anchor positioning where available, with a small fallback for browsers that do not support it yet.

Toolbar buttons may expand subtoolbars. The default link button opens a smaller subtoolbar with link-specific commands. Subtoolbar commands still go through the same editor session API as main toolbar commands.

```js
const editor = edit({
  container: document.body,
  data,
  buttons: [
    { label: 'Bold', command: 'bold', icon: 'B' },
    { label: 'Link', command: 'expand', value: 'link', icon: '↗', expands: true }
  ],
  toolbars: {
    link: {
      buttons: [
        { label: 'Set link', command: 'link', icon: '↗' },
        { label: 'Remove', command: 'unlink', icon: '×' }
      ]
    }
  }
})
```

## Editing engine boundary

The first engine is a small DOM/contenteditable HTML engine. It is deliberately behind an adapter boundary so a Cobalt-backed engine, ProseMirror engine, or another richer engine can replace it later without rewriting the toolbar or editor package.

An engine exposes a `mount()` method and returns a session:

```js
const session = engine.mount({
  element,
  html,
  onChange(html) {},
  onSelectionChange(session) {}
})
```

A session exposes:

```js
session.getHTML()
session.setHTML(html)
session.focus()
session.destroy()
session.execute('bold')
session.execute('italic')
session.execute('underline')
session.execute('link', 'https://example.com/')
session.query('bold')
```

The toolbar only talks to this session API. It does not know whether the active engine is the initial DOM engine or a future Cobalt implementation.

## Current scope

This is a first vertical slice for inspection:

- HTML strings are the canonical rich-text data format.
- `escape_html` can show HTML strings literally.
- editable fields mount a contenteditable session on focus/click.
- editing writes HTML back to `app.data`.
- the floating toolbar is rendered with SimplyFlow and dispatches commands to the active session.
- the toolbar appears for selected text, can be opened at the caret with `Control+Space`, hides with `Escape`, and supports expandable subtoolbars.

Storage, page-path handling, image upload, source editing, block/list editing, and a real Cobalt-backed engine are intentionally left for later packages/iterations.
