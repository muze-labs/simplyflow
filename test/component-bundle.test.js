/** @jest-environment node */
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'

it('isolates a marked component shared by two apps from a separately built browser bundle', async () => {
  const [componentModule, browserBundle] = await Promise.all([
    build({
      stdin: {
        contents: `
          import { mergeable } from '@muze-labs/simplyflow/app'
          export const editor = { api: mergeable({ format: () => 'original' }) }
        `,
        resolveDir: process.cwd()
      },
      bundle: true, format: 'iife', globalName: 'componentModule', write: false
    }),
    build({ entryPoints: ['packages/simplyflow/src/index.mjs'], bundle: true, write: false })
  ])

  const { window } = new JSDOM('<main></main><aside></aside>', { runScripts: 'outside-only' })
  try {
    window.eval(componentModule.outputFiles[0].text)
    window.eval(browserBundle.outputFiles[0].text)
    const editor = window.componentModule.editor
    const mount = selector => window.simply.app({
      container: window.document.querySelector(selector),
      components: { editor }
    })
    const first = mount('main')
    const second = mount('aside')
    try {
      first.api.format = () => 'personal'
      expect(first.api.format()).toBe('personal')
      expect(editor.api.format()).toBe('original')
      expect(second.api.format()).toBe('original')
    } finally {
      first.destroy()
      second.destroy()
    }
  } finally {
    window.close()
  }
})
