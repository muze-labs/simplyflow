# @muze-labs/simplyflow-app

Application layer helpers extracted from SimplyFlow: app setup, commands, actions, routes, behaviors, includes, shortcuts, path, suggest, and highlight helpers.

```javascript
import { app } from '@muze-labs/simplyflow-app'
```

`app()` creates a reactive `app.data` object and binds `data-simply-*` attributes in the app container. Custom binding transformers can be passed through the app constructor:

```javascript
const myApp = app({
  data: {
    id: 42
  },
  transformers: {
    itemLink(context, next) {
      context.value = { href: `#item/${context.value}` }
      next(context)
    }
  }
})
```

This package depends on the state and bind packages, is pure ESM, and is marked as side-effect-free for bundlers.

The `attribute` option selects the binding attribute prefix, just as in `simply.bind`. It defaults to `data-simply`. For example, `app({ attribute: 'data-flow', data: { title: 'Hello' } })` binds `data-flow-field="title"` and leaves SimplyEdit's `data-simply-field` attributes alone. Commands still use `data-simply-command`.
