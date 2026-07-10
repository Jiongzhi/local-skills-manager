import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

it('renders the skills manager shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Skills Manager' })).toBeVisible()
})
