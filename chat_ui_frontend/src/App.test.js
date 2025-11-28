import { render, screen } from '@testing-library/react';
import App from './App';

test('renders chat header', () => {
  render(<App />);
  const title = screen.getByText(/Ocean Chat/i);
  expect(title).toBeInTheDocument();
});
