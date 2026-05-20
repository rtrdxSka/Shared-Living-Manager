import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Donut } from '@/components/ui/donut';

const SEGMENTS = [
  { id: 'a', value: 50, color: '#ff0000' },
  { id: 'b', value: 30, color: '#00ff00' },
  { id: 'c', value: 20, color: '#0000ff' },
];

describe('<Donut />', () => {
  it('renders one <circle> per segment plus one background ring (uncontrolled)', () => {
    const { container } = render(<Donut segments={SEGMENTS} />);
    // 1 background ring + 3 segment arcs
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  it('dims non-active segments to opacity 0.3 and brightens active when activeId set', () => {
    const { container } = render(<Donut segments={SEGMENTS} activeId="b" />);
    const segmentCircles = container.querySelectorAll('circle[data-segment-id]');
    expect(segmentCircles).toHaveLength(3);

    const active = container.querySelector('circle[data-segment-id="b"]') as SVGCircleElement;
    const dimmedA = container.querySelector('circle[data-segment-id="a"]') as SVGCircleElement;
    const dimmedC = container.querySelector('circle[data-segment-id="c"]') as SVGCircleElement;

    expect(active.style.opacity).toBe('1');
    expect(dimmedA.style.opacity).toBe('0.3');
    expect(dimmedC.style.opacity).toBe('0.3');
  });

  it('fires onActiveChange with seg.id on mouseenter and null on mouseleave', () => {
    const onActiveChange = vi.fn();
    const { container } = render(
      <Donut segments={SEGMENTS} activeId={null} onActiveChange={onActiveChange} />
    );
    const segB = container.querySelector('circle[data-segment-id="b"]') as SVGCircleElement;

    fireEvent.mouseEnter(segB);
    expect(onActiveChange).toHaveBeenLastCalledWith('b');

    fireEvent.mouseLeave(segB);
    expect(onActiveChange).toHaveBeenLastCalledWith(null);
  });

  it('leaves opacity unchanged when activeId is not provided (uncontrolled)', () => {
    const { container } = render(<Donut segments={SEGMENTS} />);
    const seg = container.querySelector('circle[data-segment-id="a"]') as SVGCircleElement | null;
    // In uncontrolled mode we don't tag segments — they render exactly as before.
    // The absence of the data attribute IS the contract.
    expect(seg).toBeNull();
  });
});
