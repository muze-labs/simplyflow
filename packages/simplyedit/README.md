# @muze-labs/simplyedit

Experimental SimplyEdit application layer built on top of SimplyFlow.

Rich text fields store HTML strings as their canonical data format. The current package mounts a small contenteditable HTML session on elements marked with `data-simply-editable`, writes changed HTML back to `app.data`, and renders a floating SimplyFlow toolbar.

```html
<h1 data-simply-field="title" data-simply-editable="richtext"></h1>
<article data-simply-field="body" data-simply-editable="richtext"></article>
```

```js
import { edit } from '@muze-labs/simplyedit'

const editor = edit({
  container: document.body,
  data: {
    title: 'A page',
    body: '<p>Hello <strong>world</strong>.</p>'
  }
})
```

The toolbar appears when the user selects text inside an active editable field. `Control+Space` opens the toolbar at the caret for collapsed selections, and `Escape` hides it again. Toolbar buttons can expand subtoolbars; the built-in link button uses this to show link-specific commands.

The editing engine is intentionally behind an adapter interface so the initial DOM/contenteditable engine can later be replaced by a Cobalt-backed engine or another mature editor.
