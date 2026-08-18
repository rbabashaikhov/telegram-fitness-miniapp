import { describe, expect, it } from 'vitest';
import { fitnessDemoTour } from './fitnessTour';
import { chooseTooltipPlacement } from './placement';

describe('tooltip placement', () => {
  it('prefers the side with enough room', () => {
    expect(
      chooseTooltipPlacement({
        targetTop: 500,
        targetBottom: 580,
        tooltipHeight: 160,
        viewportHeight: 700,
        preferred: 'top',
      }),
    ).toBe('top');
  });
});

describe('fitness sales tour', () => {
  it('covers dashboard, schedule, confirmation, workouts, admin, attendance and retention', () => {
    expect(fitnessDemoTour.steps.map((step) => step.target)).toEqual([
      'client-membership',
      'schedule-list',
      'confirmation',
      'upcoming-workouts',
      'admin-customers',
      'admin-bookings',
      'retention-list',
    ]);
    expect(fitnessDemoTour.finish.title).toContain('внутри Telegram');
  });
});
