# Why SimplyFlow?

**Real web apps, without replacing the web.**

SimplyFlow is a small app layer for people who want the web platform, not a framework platform.

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

HTML points to data and behavior. JavaScript owns the data and implements the behavior.

## The idea

The browser already gives us three good languages:

- HTML for structure;
- CSS for style;
- JavaScript for data and behavior.

SimplyFlow keeps that split. It does not turn HTML into a programming language, and it does not move page structure into JavaScript components.

Instead, SimplyFlow adds a small connection layer:

```text
HTML describes the page.
CSS describes how it looks.
JavaScript describes what it does.
SimplyFlow connects them.
```

## Simplicity is the feature

SimplyFlow is not simple because it is only useful for simple things.

It is simple because it tries to avoid extra concepts. A SimplyFlow app should still look like a web page when you open the source:

```html
<input data-simply-edit="observation.species">
<span data-simply-field="observation.species"></span>
<button data-simply-command="saveObservation">Save</button>
```

The attributes say what the HTML depends on. The actual behavior stays in JavaScript:

```javascript
commands: {
	async saveObservation() {
		await this.actions.saveObservation()
	}
}
```

Commands and actions are ordinary JavaScript functions. SimplyFlow calls them, but it does not turn their return values into a framework-specific protocol.

## What SimplyFlow adds

SimplyFlow focuses on a small set of connections:

| Attribute | Connection |
| --- | --- |
| `data-simply-field` | show JavaScript data in HTML |
| `data-simply-edit` | let HTML edit JavaScript data |
| `data-simply-list` | repeat HTML for each item in JavaScript data |
| `data-simply-command` | let HTML call JavaScript behavior |
| `data-simply-value` | pass a value from HTML to JavaScript behavior |

Those connections are enough to build useful browser apps without adopting a large framework architecture first.

## Why not a large framework?

Large frameworks are useful when you need their full ecosystem: component libraries, team conventions, server rendering, routing systems, build tools, and many ready-made integrations.

SimplyFlow starts from a different question:

> How far can we get while keeping the browser's own structure visible?

That matters when an app should be easy to inspect, self-host, copy, adapt, and maintain over time.

## The promise

SimplyFlow should help you build real applications while keeping the source understandable:

- HTML is structure.
- CSS is style.
- JavaScript is data and behavior.

SimplyFlow connects them.

