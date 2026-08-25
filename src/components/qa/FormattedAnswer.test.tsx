// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FormattedAnswer from './FormattedAnswer';

afterEach(cleanup);

describe('FormattedAnswer', () => {
  it('renders bold runs as emphasis rather than literal asterisks', () => {
    // The assistant returns markdown; the chat used to print the asterisks.
    const { container } = render(
      <FormattedAnswer text="You are over budget on **Shopping** this month." />
    );

    expect(container.textContent).not.toContain('**');
    expect(screen.getByText('Shopping').tagName).toBe('STRONG');
  });

  it('renders a dash list as a real list', () => {
    const { container } = render(
      <FormattedAnswer text={'To cut back:\n- Dining\n- Transport'} />
    );

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Dining');
    expect(items[1].textContent).toBe('Transport');
  });

  it('handles numbered lists', () => {
    const { container } = render(
      <FormattedAnswer text={'1. Shopping\n2. Dining'} />
    );

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.textContent).not.toContain('1.');
  });

  it('keeps bold formatting inside list items', () => {
    const { container } = render(
      <FormattedAnswer text={'- **Dining**: ₦67,050.00'} />
    );

    expect(container.querySelector('li strong')?.textContent).toBe('Dining');
    expect(container.textContent).toContain('₦67,050.00');
  });

  it('separates a lead paragraph from the list that follows', () => {
    const { container } = render(
      <FormattedAnswer
        text={'You went over in three categories.\n- Shopping\n- Dining'}
      />
    );

    expect(container.querySelector('p')?.textContent).toBe(
      'You went over in three categories.'
    );
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders plain prose unchanged', () => {
    const text = 'You spent ₦757,750.00 this month.';
    const { container } = render(<FormattedAnswer text={text} />);

    expect(container.textContent).toBe(text);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('never emits markup from the text it is given', () => {
    // Guards against a switch to dangerouslySetInnerHTML later on.
    const { container } = render(
      <FormattedAnswer text={'<img src=x onerror=alert(1)> and **bold**'} />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('handles an empty answer without throwing', () => {
    const { container } = render(<FormattedAnswer text="" />);
    expect(container.textContent).toBe('');
  });
});
