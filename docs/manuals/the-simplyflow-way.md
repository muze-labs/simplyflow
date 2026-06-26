# The SimplyFlow way

SimplyFlow keeps the browser's languages in their natural roles.

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

## The rule

```text
HTML is structure.
CSS is style.
JavaScript is data and behavior.
SimplyFlow connects them.
```

This rule is the reason SimplyFlow uses attributes. An attribute can point from HTML to JavaScript without moving JavaScript into HTML.

Good:

```html
<button data-simply-command="saveObservation">Save</button>
```

```javascript
commands: {
	async saveObservation() {
		await this.actions.saveObservation()
	}
}
```

Avoid:

```html
<button data-simply-command="this.data.saved = true">Save</button>
```

That puts behavior inside HTML. SimplyFlow should make behavior easy to find, not move it out of JavaScript.

## Attributes are connections

SimplyFlow attributes connect the page to app data and behavior.

| Attribute | Connects HTML to |
| --- | --- |
| `data-simply-field` | data to show |
| `data-simply-edit` | data to edit |
| `data-simply-list` | data to repeat |
| `data-simply-command` | behavior to run |
| `data-simply-value` | a value passed to behavior |

The attributes should stay small and readable. If the value starts to look like a program, it probably belongs in JavaScript.

## Commands and actions are JavaScript

Commands and actions are ordinary JavaScript functions. SimplyFlow calls them with a useful app context, but it does not turn them into a special framework protocol.

At Muze we usually write commands and actions as `async`, even when the first version does not need to wait for anything:

```javascript
commands: {
	async addObservation() {
		await this.actions.addObservation(this.data.newSpecies)
	}
},

actions: {
	async addObservation(species) {
		this.data.observations.push({ species })
		this.data.newSpecies = ''
	}
}
```

Real apps often load files, save data, call APIs, or use storage. Starting with `async` gives every command and action the same shape.

## App state is data

Waiting, success, and error state should usually be normal app data.

```javascript
actions: {
	async loadObservations() {
		this.data.loading = true
		this.data.error = ''

		try {
			this.data.observations = await this.api.get('observations.json')
		} catch (error) {
			this.data.error = error.message
		} finally {
			this.data.loading = false
		}
	}
}
```

Then HTML can show that state like any other data:

```html
<p data-simply-field="error"></p>
```

This keeps loading and error handling in user space. User space means normal application code: code written by the app, not built into SimplyFlow itself.

## Add concepts carefully

SimplyFlow should add a concept only when it makes real apps simpler without breaking the HTML, CSS, and JavaScript boundary.

A good SimplyFlow feature should:

- keep structure in HTML;
- keep style in CSS;
- keep behavior in JavaScript;
- be visible when reading the source;
- reduce repeated application code;
- work for beginners first and advanced users later.

This is why SimplyFlow can grow without becoming a large framework. New features should deepen the same model, not introduce a second model.

## One tool, focused parts

SimplyFlow is one tool for users, but it is built from focused parts. The main package gives a friendly entry point. Subpath imports give advanced users direct access to lower-level pieces when they need them.

```javascript
import { app } from '@muze-labs/simplyflow'
```

Later, advanced code can import focused pieces without switching to a different tool:

```javascript
import { signal, effect } from '@muze-labs/simplyflow/state'
```

That path matters: beginners should not outgrow SimplyFlow by becoming more capable. They should be able to understand more of the same tool.

## The promise

SimplyFlow should help you build real browser apps while keeping the source understandable:

```text
HTML names structure and connections.
CSS controls appearance.
JavaScript owns data and behavior.
SimplyFlow keeps the pieces connected.
```
