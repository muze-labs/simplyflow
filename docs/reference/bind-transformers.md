# Binding transformer module

```js
import { escape_html, fixed_content, attributes } from '@muze-labs/simplyflow/bind/transformers'
```

Binding transformers are small functions that can alter a binding context before rendering.

They are used through the app or binding `transformers` option and the `*-transform` attribute.

```html
<span data-simply-field="comment" data-simply-transform="escape_html"></span>
```

## Render-only transformer signature

A transformer can be a function. Function transformers run only while data is rendered into the DOM.

```js
function transformer(context, next) {
  // change context if needed
  next(context)
}
```

Transformers are called with `this` set to the binding instance.

## Render and extract transformer signature

A transformer can also be an object with `render` and/or `extract` functions.

```js
const transformer = {
  render(context, next) {
    // data -> DOM
    next(context)
  },

  extract(context, next) {
    // DOM -> data, used by data-simply-edit / data-flow-edit
    next(context)
  }
}
```

`render` runs before the element renderer. `extract` runs when an editable binding writes DOM state back to data. This is useful when the stored data shape is not the same as the rendered value.

```html
<select data-simply-edit="type" data-simply-transform="selectedObjectKey">
  <option value="article">Article</option>
  <option value="note">Note</option>
</select>
```

```js
simply.app({
  data: {
    type: {
      note: {}
    }
  },
  transformers: {
    selectedObjectKey: {
      render(context, next) {
        context.value = Object.keys(context.value || {})[0] || ''
        next(context)
      },
      extract(context, next) {
        context.value = {
          [context.value]: context.currentValue?.[context.value] || {}
        }
        context.replaceValue = true
        next(context)
      }
    }
  }
})
```

Set `context.replaceValue = true` in `extract` when the extracted value should replace the old value instead of being merged into it. Without this flag, extracted objects are merged into the existing object so ordinary editable object bindings can preserve fields that are not represented by the edited element.

## `escape_html`

Escapes HTML special characters before rendering a string into normal element content. This is useful because SimplyFlow renders string field values as HTML by default. Use `escape_html` when you want to show HTML source literally.

```html
<pre data-simply-field="body" data-simply-transform="escape_html"></pre>
```

For `input` and `textarea` elements, `escape_html` leaves the value as plain text because those elements already display their value literally.

`escape_html` also has an extract hook. Editable source-like elements can write escaped DOM text back to the raw HTML string in data.

Characters escaped on render: `&`, `<`, `>`, `"`, `'`.

## `fixed_content(context, next)`

Prevents the bound data from replacing existing `innerHTML` content. This is useful when an element's content should be kept fixed while other properties are rendered.

## `attributes`

Renders and extracts selected HTML attributes without replacing the element's content.

```html
<h1
  data-simply-edit="subject"
  data-simply-transform="attributes"
  data-simply-attributes="about property typeof">
  Visible title
</h1>
```

```js
simply.app({
  data: {
    subject: {
      about: '#thing',
      property: 'schema:name',
      typeof: 'schema:Thing'
    }
  }
})
```

The attribute list uses the same prefix as the binding. With `app()`, use `data-simply-attributes`. With lower-level `bind()` and the default prefix, use `data-flow-attributes`.

If no attribute list is provided, the transformer uses the object keys from the current value. An explicit attribute list is clearer for templates and is recommended.

## Custom transformers

```js
simply.app({
  data,
  transformers: {
    uppercase(context, next) {
      context.value = String(context.value).toUpperCase()
      next(context)
    }
  }
})
```

```html
<span data-simply-field="name" data-simply-transform="uppercase"></span>
```
