import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoStore } from '../demo.store';
import { store } from '../../lib/demo-store';

describe('DemoStore Route Component', () => {
  const initialState = {
    firstName: 'Jane',
    lastName: 'Smith',
  };

  beforeEach(() => {
    store.setState(() => initialState);
  });

  it('renders with initial values', () => {
    render(<DemoStore />);

    // Check for inputs
    const firstNameInput = screen.getByDisplayValue('Jane');
    const lastNameInput = screen.getByDisplayValue('Smith');

    // Check for full name display
    const fullNameDisplay = screen.getByText('Jane Smith');

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(fullNameDisplay).toBeInTheDocument();
  });

  it('updates full name when first name changes', () => {
    render(<DemoStore />);

    const firstNameInput = screen.getByDisplayValue('Jane');

    fireEvent.change(firstNameInput, { target: { value: 'John' } });

    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('updates full name when last name changes', () => {
    render(<DemoStore />);

    const lastNameInput = screen.getByDisplayValue('Smith');

    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });
});
