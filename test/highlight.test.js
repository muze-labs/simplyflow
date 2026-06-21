import { html, css } from '@muze-labs/simplyflow-app/highlight'

describe('highlight template helpers', () => {
  it('interpolates html and css template strings', () => {
    expect(html`<p>${'Hello'}</p>`).toBe('<p>Hello</p>')
    expect(css`.${'card'} { display: block; }`).toBe('.card { display: block; }')
  })
})

