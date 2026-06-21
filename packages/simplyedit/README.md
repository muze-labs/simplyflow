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

## Sortable lists

Add `data-simply-sortable` to a `data-simply-list` element to make the rendered array sortable in the editor. The attribute is boolean: SimplyEdit reorders the same array that the list already renders, so the path is not repeated.

```html
<ol data-simply-list="sections" data-simply-sortable>
  <template>
    <li>
      <h2 data-simply-field="heading" data-simply-editable="richtext"></h2>
      <div data-simply-field="body" data-simply-editable="richtext"></div>
    </li>
  </template>
</ol>
```

If a rendered list item contains an element with `data-simply-sort-handle`, SimplyEdit uses that element as the drag handle. If no handle exists, SimplyEdit inserts a default accessible handle button as editor chrome. Generated item handles are positioned to the left of the item so they do not change the item's normal layout.

```html
<button type="button" data-simply-sort-handle aria-label="Move section">⋮⋮</button>
```

Handles can be focused and moved with `ArrowUp`, `ArrowDown`, `Home`, and `End`. Clicking an item handle, or pressing `Enter` / `Space` while it is focused, opens a small item toolbar with actions to delete the item or append a new item after it.

Every sortable list also gets a generated list handle with a different icon. The list handle is present even when the list is empty. Clicking it opens a list toolbar with an insert action; inserted items are added before the first existing item. When inserting into an empty list, SimplyEdit creates a blank item from the list template's field/list paths.

Sortable lists are data-first. The helper may move DOM nodes temporarily while dragging for feedback, but the drop writes the new order back to `app.data`; SimplyFlow then renders from the reordered array. Insert and delete actions also update the same array rather than treating the DOM as the source of truth.
