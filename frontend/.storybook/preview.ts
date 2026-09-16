import type { Preview } from '@storybook/react-vite'

import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'leadboard-dark',
      values: [{ name: 'leadboard-dark', value: '#101014' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' mostra violações só na UI de testes; 'error' quebra o CI
      test: 'todo',
    },
  },
}

export default preview
