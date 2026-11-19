# App module

```js
import { app } from '@muze-labs/simplyflow'
// or with the browser bundle:
const myApp = simply.app(options)
```

`app()` is the main beginner-facing API. It creates a reactive application from ordinary JavaScript data and declarative HTML attributes.

Some examples below use Metro for API calls. In a browser page, load it before using `metro.jsonApi()`:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/everything.js"></script>
```

## `app(options)`

Creates and starts an application.

```js
const contacts = app({
  container: document.querySelector('#contacts'),

  data: {
    contacts: [],
    selectedContactId: null
  },

  api: metro.jsonApi('/api/'),

  async start() {
    this.data.contacts = await this.api.get('contacts.json')
  },

  commands: {
    selectContact(button, id) {
      this.actions.selectContact({ id })
    }
  },

  actions: {
    selectContact({ id }) {
      this.data.selectedContactId = id
    }
  }
})
```

### Options

| Option | Type | Description |
| --- | --- | --- |
| `container` | `Element` | DOM element that contains the app. Defaults to `document.body`. |
| `data` | `object` | Application data. It is converted to a reactive signal and exposed as `app.data`. |
| `attribute` | `string` | Binding attribute prefix, as in `simply.bind`. Defaults to `data-simply`. Command and behavior attributes retain their own prefixes. |
| `commands` | `object` | Command functions called from `data-simply-command`. See [Commands](command.md). |
| `actions` | `object` | Named application behavior. See [Actions](action.md). |
| `routes` | `object` | URL routes. See [Routes](route.md). |
| `shortcuts` | `object` | Keyboard shortcuts. See [Shortcuts](shortcut.md). |
| `behaviors` | `object` | Reusable DOM behaviors. See [Behaviors](behavior.md). |
| `transformers` | `object` | Named binding transformers used by `data-simply-transform`. See [Binding transformers](bind-transformers.md). |
| `templates` | `object` | Named template strings inserted into the app container as `<template id="name">`. |
| `styles` | `object` | Named style strings inserted into the app container as `<style id="name.css">`. |
| `components` | `object` | Advanced/experimental reusable app option groups. Component design is still evolving. |
| `baseURL` | `string` | Base path used by the route module. |
| `start` | `function` | Optional startup function called with `this` set to the app. Routes are initialized after it finishes. |
| `onError` | `function` | Optional error handler for `start()` and action errors. |

Custom top-level options are available as properties on the app. This is useful for services:

```js
app({
  data: {},
  api: metro.jsonApi('/api/'),

  actions: {
    async load() {
      this.data.items = await this.api.get('items.json')
    }
  }
})
```

If an unknown option looks like a typo of a built-in option, SimplyFlow logs a warning and still adds the property.

## App instance

The returned app object contains:

| Property | Description |
| --- | --- |
| `app.data` | Reactive application data. Change this in actions to update the page. |
| `app.container` | The app container element. |
| `app.actions` | Proxied actions object, when actions are configured. |
| `app.commands` | Command controller, when commands are configured. |
| `app.routes` | Route controller, when routes are configured. |
| `app.shortcuts` | Shortcut controller, when shortcuts are configured. |
| `app.behaviors` | Behavior controller, when behaviors are configured. |
| `app.includes` | Include controller. Created automatically for the app container. |
| `app.components` | Source component definitions, including the top-level app definition. |
| `app.transformers` | The app’s merged, editable map of named binding transformers. |
| `app.binding` | Lower-level binding controller. |
| `app.destroyed` | `true` after `app.destroy()` is called. |

The app object is also available as `this` inside commands, actions, behaviors, route functions and lifecycle functions.


## Component definitions and live edits

SimplyFlow merges nested components before their parent, siblings in declaration
order, and the top-level app definition last. Top-level startup and error handling
keep their usual lifecycle. Inspect a component through its original hierarchy.
A nested name is also available directly on `app.components` when the name is free.

The top-level definition is always available as `app.components.app`, including
when the app has no supplied components. Pass reactive state through the top-level
`data` option. It lives on `app.data` and is excluded from the component
registry. A supplied component that declares its own `data` causes an error.
Component methods can read and update the owning app’s data.

SimplyFlow reserves the exact component
name `app` at every level. Rename any component with that name before calling
`simply.app()`, or construction will throw an error.

```js
const news = simply.app({
  components: { editor },
  transformers: { label: { render: renderNewsLabel } }
})

news.transformers.label = previewLabel
// Later, restore the currently authored hooks for this app.
delete news.transformers.label
```

If `editor` supplies `label.extract`, the restored transformer has both that
hook and `renderNewsLabel`. Replacing the named entry temporarily replaces the
whole transformer. Deleting it merges that name again, including any deliberate
edits to the source definitions. An entry added only to the running app
disappears on deletion. Binding uses the result on its next render or extraction.
The same rule applies to merged properties throughout the app. For example,
assign `news.commands.save` or `news.api.formatLabel` to change that entry for
one app. Delete the entry to restore it from the current component definitions.
Deleting a property from `news.data` removes the value from reactive state.

Plain objects supplied as top-level services also become editable definition
maps. If you pass `{ api }` to `simply.app()`, edits to `news.api.formatLabel`
leave the supplied plain object intact. A reference such as `const api = news.api`
continues to see the current entries after assigning a new plain object to
`news.api` or deleting the edit. This also applies to nested definition maps
and plain objects added while the app runs. A supplied class instance retains its
identity. Arrays have ordinary array deletion and can be restored by deleting
the property that contains them.

Installed commands, shortcuts, routes and drag/drop handlers use the current
definition on their next dispatch. Behaviors use it when they next start.
Edits to template and style definitions update their installed elements.
The container and binding attribute select where to mount at startup.

## Binding transformers

Pass custom binding transformers through the app constructor. The app's default binding uses them automatically with `data-simply-transform`:

Transformers may be render-only functions, or objects with `render` and `extract` hooks when editable fields need to convert DOM values back to a different data shape.

```html
<a data-simply-field="story.id" data-simply-transform="storyLink">
  <span data-simply-field="story.title"></span>
</a>
```

```js
const news = simply.app({
  data: {
    story: { id: 42, title: 'A tiny dragon learns HTML' }
  },
  transformers: {
    storyLink(context, next) {
      context.value = { href: `#story/${context.value}` }
      next(context)
    }
  }
})
```

## `app.destroy()`

Stops the application and releases app-scoped listeners/observers.

It destroys:

- data binding effects;
- command event listeners;
- shortcut and accesskey listeners;
- route click/popstate listeners;
- behavior observers and cleanup functions;
- include observers.

## HTML attributes used by `app()`

The app API uses `data-simply-*` attributes. The most common ones are:

| Attribute | Description |
| --- | --- |
| `data-simply-field="path"` | Shows data at `path`. One-way. |
| `data-simply-edit="path"` | Shows and edits data at `path`. |
| `data-simply-list="path"` | Repeats a template for zero, one, or many values. Arrays render each item; single values render as one item. |
| `data-simply-map="path"` | Repeats a template for a keyed object collection. |
| `data-simply-command="name"` | Calls a command. |
| `data-simply-value="value"` | Passes a value to a command. Supports dynamic values in templates. |
| `data-simply-behavior="name"` | Starts a named behavior on an element. |
| `data-simply-shortcuts="scope"` | Selects a shortcut scope. |
| `data-simply-accesskey="Control+s"` | Clicks the element when the key combination is pressed. |

## Editable fields

`data-simply-field` is one-way. It renders a single value. If the value is an array, it renders the first item. Use `data-simply-edit` when user edits should update `app.data`.

```html
<input data-simply-edit="person.name">
<span data-simply-field="person.name"></span>
```

Supported edit behavior includes text inputs, textareas, selects, multiple selects, checkbox booleans, checkbox arrays and radio groups.

## Lists and keyed collections

`data-simply-list` is designed for data where a property may contain either one value or many values. This is common with linked data. If the value is an array, SimplyFlow renders every item. If the value is a single object or scalar, SimplyFlow renders it as a one-item list. If the value is `null` or `undefined`, it renders nothing.

Use `data-simply-map` only when the object itself is a keyed collection and the property names identify the items:

```js
{
  people: {
    ada: { name: 'Ada' },
    grace: { name: 'Grace' }
  }
}
```

In that case, `:key` is the object key and `:value` is the item value.
