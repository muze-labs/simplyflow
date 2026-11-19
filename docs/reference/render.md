# Render element module

```js
import '@muze-labs/simplyflow/render'
```

This module registers the `<simply-render>` custom element.

## `<simply-render>`

`<simply-render>` renders a named template with data supplied through the element.

The referenced template must contain exactly one root element. Formatting
whitespace and comments may surround it. Wrap text or multiple sibling
elements in one element before using the template with `<simply-render>`.

The rendered root carries the template ID in `data-simply-template`. For
example, an IDE can find each mounted `card` instance in an app with
`app.container.querySelectorAll('[data-simply-template="card"]')`.

The element is mainly a lower-level/advanced rendering helper. The app and bind APIs are usually the preferred way to render data.

## `SimplyRender`

```js
import { SimplyRender } from '@muze-labs/simplyflow/render'
```

The class extends `HTMLElement`. Importing the module registers the element with `customElements` when it is not already registered.

Refer to tests and examples for current low-level usage. This module is less central to the beginner app API than `app()` and `bind()`.
