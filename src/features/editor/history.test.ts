import { describe, expect, it } from 'vitest';
import { commit, initHistory, LIMIT, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = initHistory('a');
    h = commit(h, 'b', null, 0);
    h = commit(h, 'c', null, 0);
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    h = undo(h);
    expect(h.present).toBe('a');
    h = redo(redo(h));
    expect(h.present).toBe('c');
  });

  it('coalesces typing in the same field', () => {
    let h = initHistory('');
    h = commit(h, 'H', 'name', 0);
    h = commit(h, 'Hi', 'name', 300);
    h = commit(h, 'Hi!', 'name', 600);
    expect(h.past).toEqual(['']);
    h = commit(h, 'Hi!x', 'email', 700);
    expect(h.past).toEqual(['', 'Hi!']);
    h = commit(h, 'Hi!xy', 'email', 5000);
    expect(h.past).toHaveLength(3);
  });

  it('clears redo after a new edit and caps size', () => {
    let h = initHistory(0);
    for (let i = 1; i <= LIMIT + 20; i++) h = commit(h, i, null, i);
    expect(h.past).toHaveLength(LIMIT);
    h = undo(h);
    h = commit(h, -1, null, 0);
    expect(h.future).toEqual([]);
  });
});
