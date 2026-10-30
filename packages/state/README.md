# @muze-labs/simplyflow-state

Reactive state primitives extracted from SimplyFlow.

```javascript
import { signal, effect, batch } from '@muze-labs/simplyflow-state'
```

This package is pure ESM and marked as side-effect-free for bundlers.

Signals return the exact value of non-configurable, non-writable own properties,
including object references and functions. JavaScript proxy invariants require
this: fixed owners such as an OLDM node's `graph` cannot be replaced by another
proxy. Changes inside such a fixed object are not made reactive through that
property. Configurable and writable values retain normal signal wrapping.
