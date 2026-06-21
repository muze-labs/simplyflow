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
