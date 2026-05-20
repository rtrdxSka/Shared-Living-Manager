import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SparkBars } from '@/components/ui/spark-bars';

describe('<SparkBars />', () => {
  it('renders one bar per value (uncontrolled, back-compat)', () => {
    const { container } = render(<SparkBars values={[10, 20, 30]} />);
    // In uncontrolled mode, bars do NOT have data-bar-index
    const bars = container.querySelectorAll('[data-bar-index]');
    expect(bars).toHaveLength(0);
    // But the original layout still renders 3 bar divs inside the flex container
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(3);
  });

  it('marks the active bar with scaleY transform when activeIndex set', () => {
    const { container } = render(
      <SparkBars values={[10, 20, 30]} activeIndex={1} />
    );
    const bars = container.querySelectorAll<HTMLElement>('[data-bar-index]');
    expect(bars).toHaveLength(3);

    const active = container.querySelector<HTMLElement>('[data-bar-index="1"]')!;
    const other = container.querySelector<HTMLElement>('[data-bar-index="0"]')!;

    expect(active.style.transform).toBe('scaleY(1.15)');
    expect(active.style.transformOrigin).toBe('bottom');
    expect(other.style.transform).toBe('');
  });

  it('fires onActiveChange with index on mouseenter and null on mouseleave', () => {
    const onActiveChange = vi.fn();
    const { container } = render(
      <SparkBars values={[10, 20, 30]} activeIndex={null} onActiveChange={onActiveChange} />
    );
    const bar = container.querySelector<HTMLElement>('[data-bar-index="2"]')!;

    fireEvent.mouseEnter(bar);
    expect(onActiveChange).toHaveBeenLastCalledWith(2);

    fireEvent.mouseLeave(bar);
    expect(onActiveChange).toHaveBeenLastCalledWith(null);
  });

  it('renders valueLabel above the active bar when provided', () => {
    const { getByTestId } = render(
      <SparkBars
        values={[10, 20, 30]}
        activeIndex={2}
        valueLabel={(i, v) => <span data-testid="sb-label">#{i}={v}</span>}
      />
    );
    expect(getByTestId('sb-label')).toHaveTextContent('#2=30');
  });

  it('does not render valueLabel when activeIndex is null', () => {
    const { queryByTestId } = render(
      <SparkBars
        values={[10, 20, 30]}
        activeIndex={null}
        valueLabel={(i, v) => <span data-testid="sb-label">#{i}={v}</span>}
      />
    );
    expect(queryByTestId('sb-label')).toBeNull();
  });
});
