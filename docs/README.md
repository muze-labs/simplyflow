# SimplyFlow documentation

**Real web apps, without replacing the web.**

SimplyFlow connects HTML structure to JavaScript data and behavior. HTML stays structure, CSS stays style, and JavaScript stays behavior.

```html
<h1 data-simply-field="station.name"></h1>
<button data-simply-command="recordVisit">Record visit</button>
```

```javascript
commands: {
	async recordVisit() {
		this.data.station.visits++
	}
}
```

HTML names the data and behavior it needs. JavaScript owns the data and implements the behavior.

## Start here

New to SimplyFlow? Start with [Why SimplyFlow?](start/why-simplyflow.md) for the design idea. Use [When should I use SimplyFlow?](start/when-should-i-use-simplyflow.md) as a choice guide. Then continue with the tutorials.

The current tutorial path is being reorganized. For now, these chapters are still the best place to begin:

1. [Meet your first app](01-meet-your-app.md)
2. [Show data on the page](02-showing-data.md)
3. [Buttons and commands](03-buttons-and-commands.md)
4. [Editing data](04-editing-data.md)
5. [Lists of dragons](05-lists-of-dragons.md)
6. [Actions keep things tidy](06-actions.md)
7. [Loading and saving](07-loading-and-saving.md)

After that, continue with the intermediate chapters:

8. [Pages and routes](08-pages-and-routes.md)
9. [Keyboard shortcuts](09-keyboard-shortcuts.md)
10. [Including HTML](10-includes.md)
11. [Adding behaviors](11-behaviors.md)
12. [Templates and styles](12-templates-and-styles.md)
13. [Components](13-components.md)
14. [More control](14-more-control.md)

## How the documentation is organized

SimplyFlow documentation is divided into four kinds of pages.

| Section | Use it when you want to |
| --- | --- |
| Tutorials | Learn SimplyFlow step by step |
| Cookbook | Copy a small solution to a common problem |
| Reference | Look up exact attributes, options, and function details |
| [Programmer manuals](manuals/README.md) | Understand the design, lifecycle, and package structure |

The full structure is being added in stages. The [reference documentation](reference/README.md) is already available. Start the manuals with [The SimplyFlow way](manuals/the-simplyflow-way.md).

## The core idea

SimplyFlow follows one rule:

> HTML describes structure. CSS describes style. JavaScript contains data and behavior. SimplyFlow connects them with attributes.

The most important attributes are:

| Attribute | Use it to |
| --- | --- |
| `data-simply-field` | Show data in HTML |
| `data-simply-edit` | Let the user edit data |
| `data-simply-list` | Repeat HTML for each item in a list |
| `data-simply-command` | Let HTML call JavaScript behavior |
| `data-simply-value` | Pass a value from HTML to a command |

A command is just JavaScript:

```javascript
commands: {
	async saveObservation() {
		await this.actions.saveObservation()
	}
}
```

An action is also just JavaScript:

```javascript
actions: {
	async saveObservation() {
		await this.api.put('observations.json', this.data.observation)
	}
}
```

SimplyFlow does not interpret command return values. If an app needs waiting, success, or error state, store that state in `data` and show it like any other data.

## When should I use SimplyFlow?

Use SimplyFlow when the browser owns useful app data and the source should stay understandable.

For a practical choice guide, read [When should I use SimplyFlow?](start/when-should-i-use-simplyflow.md).

## Add SimplyFlow to a page

For no-build examples, use the browser bundle from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-labs/simplyflow/dist/simply.flow.js"></script>
```

After that, `simply.app()` is available in page scripts.

Some examples use Metro for HTTP requests. Add it when an example uses `metro.jsonApi()`:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/everything.js"></script>
```

For projects that use JavaScript modules, import the package instead:

```javascript
import { app } from '@muze-labs/simplyflow'
```

## Package documentation

SimplyFlow is one tool, but it is built from focused packages. Package-specific documentation will be linked from here as the docs are reorganized.

| Package | Covers |
| --- | --- |
| `@muze-labs/simplyflow` | The complete browser-friendly package |
| `@muze-labs/simplyflow/app` | `app()`, data, commands, actions, routes, shortcuts |
| `@muze-labs/simplyflow/bind` | Fields, edit binding, lists, and binding lifecycle |
| `@muze-labs/simplyflow/state` | Signals, effects, batching, and lower-level state tools |
| `@muze-labs/simplyflow/model` | Sorting, filtering, paging, and data-heavy views |
| `@muze-labs/simplyflow/edit` | Editable field support |
| `@muze-labs/simplyedit` | Rich content editing built on SimplyFlow |
