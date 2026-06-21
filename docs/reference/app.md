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

Unknown top-level options are copied onto the app instance. This is useful for services:

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
| `app.transformers` | Transformer map passed to the default binding. |
| `app.binding` | Lower-level binding controller. |
| `app.destroyed` | `true` after `app.destroy()` is called. |

The app object is also available as `this` inside commands, actions, behaviors, route functions and lifecycle functions.


## Binding transformers

Pass custom binding transformers through the app constructor. The app's default binding uses them automatically with `data-simply-transform`:

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
