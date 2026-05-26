import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TogetherProgressBar from '@/components/dashboard/couple/TogetherProgressBar';

describe('<TogetherProgressBar />', () => {
  it('sizes each segment relative to the target', () => {
    render(
      <TogetherProgressBar
        mine={300}
        partner={100}
        myLabel="You"
        partnerLabel="Sam"
        target={1000}
        currency="GBP"
      />,
    );
    expect(screen.getByTestId('together-bar-mine')).toHaveStyle({ width: '30%' });
    expect(screen.getByTestId('together-bar-partner')).toHaveStyle({ width: '10%' });
  });

  it('shows both partners’ contributions in the legend', () => {
    render(
      <TogetherProgressBar
        mine={300}
        partner={100}
        myLabel="You"
        partnerLabel="Sam"
        target={1000}
        currency="GBP"
      />,
    );
    const legend = screen.getByTestId('together-legend');
    expect(legend).toHaveTextContent('You 300 GBP');
    expect(legend).toHaveTextContent('Sam 100 GBP');
  });

  it('caps the combined fill at 100% when contributions exceed the target', () => {
    render(
      <TogetherProgressBar
        mine={600}
        partner={600}
        myLabel="You"
        partnerLabel="Sam"
        target={1000}
        currency="GBP"
      />,
    );
    expect(screen.getByTestId('together-bar-mine')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('together-bar-partner')).toHaveStyle({ width: '50%' });
  });
});
