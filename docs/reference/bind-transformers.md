# Binding transformer module

```js
import { escape_html, fixed_content } from '@muze-labs/simplyflow/bind/transformers'
```

Binding transformers are small functions that can alter a binding context before rendering.

They are used through the app or binding `transformers` option and the `*-transform` attribute.

```html
<span data-simply-field="comment" data-simply-transform="escape_html"></span>
```

## Transformer signature

```js
function transformer(context, next) {
  // change context if needed
  next(context)
}
```

Transformers are called with `this` set to the binding instance.

## `escape_html(context, next)`

Escapes HTML special characters before rendering text into `innerHTML`.

Characters escaped: `&`, `<`, `>`, `"`, `'`.

## `fixed_content(context, next)`

Prevents the bound data from replacing existing `innerHTML` content. This is useful when an element's content should be kept fixed while other properties are rendered.

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
