import { signal } from '../packages/state/src/index.mjs'

test('signals preserve fixed object and function property identity', () => {
    const graph = { subjects: {} }
    const method = () => 'value'
    const target = {}
    Object.defineProperties(target, {
        graph: { value: graph },
        method: { value: method },
        inaccessible: { get: undefined }
    })
    const state = signal(target)
    expect(state.graph).toBe(graph)
    expect(state.method).toBe(method)
    expect(state.inaccessible).toBeUndefined()
})
