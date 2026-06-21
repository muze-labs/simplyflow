describe('workspace package entry points', () => {
  it('exposes the split packages directly', async () => {
    const state = await import('@muze-labs/simplyflow-state')
    const bind = await import('@muze-labs/simplyflow-bind')
    const model = await import('@muze-labs/simplyflow-model')
    const app = await import('@muze-labs/simplyflow-app')

    expect(typeof state.signal).toBe('function')
    expect(typeof bind.bind).toBe('function')
    expect(typeof model.model).toBe('function')
    expect(typeof app.app).toBe('function')
  })

  it('keeps the main package subpath imports as compatibility entry points', async () => {
    const state = await import('@muze-labs/simplyflow/state')
    const bind = await import('@muze-labs/simplyflow/bind')
    const model = await import('@muze-labs/simplyflow/model')
    const app = await import('@muze-labs/simplyflow/app')

    expect(typeof state.signal).toBe('function')
    expect(typeof bind.bind).toBe('function')
    expect(typeof model.model).toBe('function')
    expect(typeof app.app).toBe('function')
  })

  it('keeps side-effectful render registration separate from the pure packages', async () => {
    expect(customElements.get('simply-render')).toBeUndefined()

    await import('@muze-labs/simplyflow/render')

    expect(customElements.get('simply-render')).toBeDefined()
  })
})
