describe('workspace package entry points', () => {
  it('exposes the split packages directly', async () => {
    const state = await import('@muze-labs/simplyflow-state')
    const bind = await import('@muze-labs/simplyflow-bind')
    const model = await import('@muze-labs/simplyflow-model')
    const app = await import('@muze-labs/simplyflow-app')
    const simplyedit = await import('@muze-labs/simplyedit')

    expect(typeof state.signal).toBe('function')
    expect(typeof bind.bind).toBe('function')
    expect(typeof model.model).toBe('function')
    expect(typeof app.app).toBe('function')
    expect(typeof simplyedit.edit).toBe('function')
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



  it('exports named APIs from the SimplyEdit browser bundle', async () => {
    const simplyedit = await import('../packages/simplyedit/dist/simply.edit.js')

    expect(typeof simplyedit.edit).toBe('function')
    expect(typeof simplyedit.SimplyEdit).toBe('function')
    expect(typeof simplyedit.createToolbar).toBe('function')
    expect(typeof simplyedit.createHtmlDomEngine).toBe('function')
  })

  it('keeps side-effectful render registration separate from the pure packages', async () => {
    expect(customElements.get('simply-render')).toBeUndefined()

    await import('@muze-labs/simplyflow/render')

    expect(customElements.get('simply-render')).toBeDefined()
  })
})
