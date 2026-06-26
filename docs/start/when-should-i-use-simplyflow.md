# When should I use SimplyFlow?

Use SimplyFlow when your browser page has useful data and behavior of its own, and you want the source to stay close to normal HTML, CSS, and JavaScript.

```html
<input data-simply-edit="project.name">
<button data-simply-command="saveProject">Save</button>
```

That is the core shape: HTML names the data and behavior. JavaScript implements the behavior.

## Good fits

SimplyFlow is a good fit for:

- editable notes, records, dashboards, and small tools;
- local-first apps that keep useful state in the browser;
- Solid and linked-data apps;
- browser-side previews and editors;
- apps that load and save data through APIs or storage libraries;
- self-hosted or no-build apps that should stay easy to inspect;
- professional tools where long-term understandability matters more than framework conventions.

## Poor fits

Do not add SimplyFlow just because it is available.

Plain HTML and CSS are better when the page only needs text, links, images, layout, and normal navigation.

A server-driven tool is usually better when the backend already owns the interface and sends HTML updates to the browser.

A large framework may be better when you need a large component ecosystem, team-wide framework conventions, server rendering and hydration, or many existing plugins.

## Quick choice guide

| Choose | When |
| --- | --- |
| Plain HTML and CSS | The page does not need app behavior |
| Alpine | You want small inline behavior directly in HTML |
| Stimulus | Existing HTML only needs JavaScript behavior attached to it |
| htmx or Datastar | The backend owns the UI and sends HTML updates |
| React, Vue, Solid, or Next | You need a large framework and ecosystem |
| SimplyFlow | The browser owns useful data and behavior, and the app should stay understandable |

## Common cases

| You are building | Good choice |
| --- | --- |
| A mostly static information page | Plain HTML and CSS |
| A server-rendered CRUD app | htmx, Datastar, or another server-driven tool |
| A small dropdown or menu on an existing page | Alpine or Stimulus |
| A browser-side editor, preview, or dashboard | SimplyFlow |
| A Solid app that works with linked data in the browser | SimplyFlow |
| A large product with a team-standard component stack | React, Vue, Solid, Next, or similar |

## The deciding question

Ask this first:

> Does the browser own meaningful app data?

If the answer is yes, SimplyFlow is worth considering.

If the answer is no, another tool may be smaller, simpler, or more natural for the job.
