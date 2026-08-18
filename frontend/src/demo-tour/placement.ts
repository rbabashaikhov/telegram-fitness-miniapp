import type { TourPlacement } from './types';

export function chooseTooltipPlacement(params: {
  targetTop: number;
  targetBottom: number;
  tooltipHeight: number;
  viewportHeight: number;
  gap?: number;
  bottomReserve?: number;
  preferred?: TourPlacement;
}): 'top' | 'bottom' {
  const gap = params.gap ?? 12;
  const bottomReserve = params.bottomReserve ?? 24;
  const need = params.tooltipHeight + gap;
  const spaceAbove = params.targetTop;
  const spaceBelow = params.viewportHeight - params.targetBottom - bottomReserve;
  if (params.preferred === 'top' && spaceAbove >= need) return 'top';
  if (params.preferred === 'bottom' && spaceBelow >= need) return 'bottom';
  if (spaceBelow >= need) return 'bottom';
  if (spaceAbove >= need) return 'top';
  return spaceAbove >= spaceBelow ? 'top' : 'bottom';
}
