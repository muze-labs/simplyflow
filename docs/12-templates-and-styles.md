# 12. Templates and styles

You can add reusable templates and styles when the app starts.

```js
const sanctuary = simply.app({
  data: {
    dragons: []
  },

  templates: {
    dragonRow: html`
      <li>
        <strong data-simply-field="name"></strong>
        <span data-simply-field="mood"></span>
      </li>
    `
  },

  styles: {
    dragonCards: css`
      .dragon-card {
        border: 2px solid goldenrod;
        border-radius: 0.5rem;
        padding: 1rem;
      }
    `
  }
})
```

The `templates` option creates named `<template>` elements. The `styles` option creates named `<style>` elements.

## The `html` and `css` tags

The browser bundle provides global `html` and `css` tags:

```js
html`<p>Hello</p>`
css`p { color: purple; }`
```

They return strings. Their main purpose is to help code editors highlight HTML and CSS inside template strings.

They do not make unsafe HTML safe. If you put user text into HTML strings, escape it first.

## Use templates with lists

A list can use a template already present in the page, or one installed through `templates`.

```html
<ul data-simply-list="dragons">
  <template>
    <li>
      <strong data-simply-field="name"></strong>
      <span data-simply-field="mood"></span>
    </li>
  </template>
</ul>
```

For many beginner apps, keeping the template in HTML is easiest to read. The `templates` option is useful when a template belongs with the JavaScript that creates a feature.

## Identify the template behind a rendered element

When SimplyFlow binds a named template, its rendered root gets
`data-simply-template` with the template ID. A list using
`<template rel="dragonRow"></template>` marks the row with `dragonRow`.
From a descendant, use `element.closest('[data-simply-template]')` to find
the nearest marked root, then look up that ID within the owning app.

SimplyFlow owns this attribute. It is absent for an anonymous template.
Standalone bindings use their binding prefix, so the default is
`data-flow-template`. Empty templates continue to render a comment with
the encoded `simply-template` value.

Next: [components](13-components.md).
