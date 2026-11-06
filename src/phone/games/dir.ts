export type Dir = 'up' | 'down' | 'left' | 'right';
export const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
