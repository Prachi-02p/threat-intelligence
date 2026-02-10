import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Threat Intelligence header', () => {
  render(<App />);
  const heading = screen.getByText(/threat intelligence/i);
  expect(heading).toBeInTheDocument();
});
