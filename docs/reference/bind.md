# Bind module

```js
import { bind } from '@muze-labs/simplyflow/bind'
```

`bind()` is the lower-level DOM/data binding API. `app()` uses it internally with the `data-simply-*` attribute prefix. The lower-level default prefix is `data-flow-*`.

## `bind(options)`

```js
const data = simply.signal({
  person: { name: 'Ada' },
  todos: []
})

const binding = bind({
  root: data,
  container: document.body
})
```

### Options

| Option | Type | Description |
| --- | --- | --- |
| `root` | signal/object | Required. Root data object. |
| `container` | `Element` | Binding root. Defaults to `document.body`. |
| `attribute` | `string` | Attribute prefix. Defaults to `data-flow`. |
| `transformers` | `object` | Named transformers available through `*-transform`. |
| `render` | `object` | Renderer stacks for `field`, `list`, and `map`. |
| `renderers` | `object` | Element-specific field renderers by tag name. |
| `twoway` | `boolean` | Enables broad DOM-to-data tracking. Defaults to `false`. Prefer explicit `*-edit`. |

Throws when `options.root` is missing.

## Attributes

With the default `data-flow` prefix:

| Attribute | Description |
| --- | --- |
| `data-flow-field="path"` | Render data at `path`. One-way. |
| `data-flow-edit="path"` | Render and edit data at `path`. |
| `data-flow-list="path"` | Render zero, one, or many values using child templates. Arrays render each item; single values render as one item. |
| `data-flow-map="path"` | Render a keyed object collection using child templates. |
| `data-flow-transform="name"` | Run a named transformer. Multiple names are separated by spaces. |
| `data-flow-attributes="name ..."` | Attribute names used by the built-in `attributes` transformer. |

`app()` uses the same attributes with the `data-simply` prefix.

## Field binding

```html
<span data-flow-field="person.name"></span>
<input data-flow-edit="person.name">
```

`data-flow-field` is one-way. It renders a single value. If the value is an array, it renders the first item. `data-flow-edit` updates the bound data when the user edits supported form controls.

## Lists

```html
<ul data-flow-list="todos">
  <template>
    <li>
      <input type="checkbox" data-flow-edit="done">
      <span data-flow-field="text"></span>
    </li>
  </template>
</ul>
```

`data-flow-list` accepts arrays and single values. Arrays render one item per array element. A single object or scalar renders as a one-item list. `null` and `undefined` render no items. This is useful for linked-data style properties where the same field may contain one value or many values.

Add `data-flow-list-key="id"` to an ordered list to identify rows by a
stable item property. An app using the default prefix writes
`data-simply-list-key="id"`. The path is relative to the item and must return
a unique string or finite number for every row. With the same key and
template, a new object can reuse the existing row and its bindings. The
generated row key still holds the current array index.

Inside a list template, relative paths are resolved against the current item. Special paths include:

| Path | Meaning |
| --- | --- |
| `:value` | Current item. |
| `:key` | Current array index or keyed collection key. |
| `:root.path` | Path from the root data object. |
| `:empty` | Template used when a list/map is empty. |
| `:notempty` | Template used when a list/map is not empty. |

## Maps

`data-flow-map` is for keyed object collections: objects where the property names identify the rendered items. It does not mean “render any object as many rows”; plain objects passed to `data-flow-list` are treated as single values. In a map template, the current key is available through `:key` and the current value through `:value`.

## Transformers

Built-in transformers:

| Name | Description |
| --- | --- |
| `escape_html` | Escapes HTML-special characters before rendering. |
| `fixed_content` | Prevents replacing content when an element already has fixed content. |
| `attributes` | Renders and extracts selected HTML attributes without replacing the element's content. |

Custom transformers can be render-only functions or objects with `render` and `extract` functions. The `extract` function is used by `data-flow-edit` / `data-simply-edit` when DOM state is written back to data. Set `context.replaceValue = true` inside `extract` when the extracted value should replace the existing value instead of being merged into it.

See [Binding transformers](bind-transformers.md) for details.

## Instance methods/properties

| Member | Description |
| --- | --- |
| `binding.bindings` | `Map<Element, signal>` of active binding effects. |
| `binding.destroy()` | Destroys all active binding effects and observers. |
| `binding.trace(path)` | Returns trace information for a data path. |

## Helpers

### `getValueByPath(root, path)`

Returns the value at a binding path. Supports binding special paths such as `:root` internally.

### `trace(path)`

Returns global binding trace data for a path.

## Refreshing a template

Bindings resolve `<template rel="card">` within their container. Put the
corresponding `<template id="card">` inside that container, or supply `card` in
the app’s `templates` option. Sibling apps can use the same template name.

After editing a named template element in place, pass a bound field, list, or
map and that template to `binding.rerender(element, template)`. The binding
uses its current data and replaces the instances of that template inside the
host. Other rows retain their DOM nodes. For an expanded `<simply-render>`,
pass its rendered root as the element.

```js
const template = app.container.querySelector('template#card')
template.innerHTML = editedMarkup
for (const use of app.container.querySelectorAll('template[rel="card"]')) {
  app.binding.rerender(use.parentElement, template)
}
for (const root of app.container.querySelectorAll('[data-simply-template="card"]')) {
  app.binding.rerender(root, template)
}
```

A bound template can be empty or contain one root element. Whitespace and
comments may surround the root. Wrap text in an element to render it.

Clearing a bound template leaves one comment per rendered instance, such as
`<!-- simply-template=card -->`. The trimmed comment text uses
`URLSearchParams` encoding. Its required `simply-template` parameter contains
the template ID (an empty string for an unnamed inline template). Restore the
markup and call `rerender(host, template)` again to render the current data.

The method returns `true` after refreshing a matching instance. It returns
`false` for an unrelated target, or when replacement would remove the focused
element. In that case, retry after focus leaves the instance. Pending bound edits are committed as old bindings are released.
