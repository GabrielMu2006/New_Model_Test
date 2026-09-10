/**
 * Undo / redo stack based on full mechanism snapshots.
 *
 * Mechanisms are small (a few hundred numbers), so snapshotting is simpler and
 * far more reliable than hand-written inverse operations, and it also captures
 * link-length edits, motor changes and deletions.
 */

import { deepClone } from './math.js';

export class History {
  constructor(options = {}) {
    this.limit = options.limit != null ? options.limit : 80;
    this.past = [];
    this.future = [];
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  get undoLabel() {
    return this.past.length ? this.past[this.past.length - 1].label : null;
  }

  get redoLabel() {
    return this.future.length ? this.future[this.future.length - 1].label : null;
  }

  /** Record the state *before* an edit, together with a human readable label. */
  push(label, snapshot) {
    this.past.push({ label: String(label || 'edit'), snapshot: deepClone(snapshot) });
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
    return this;
  }

  undo(current) {
    if (!this.past.length) return null;
    const entry = this.past.pop();
    this.future.push({ label: entry.label, snapshot: deepClone(current) });
    return deepClone(entry.snapshot);
  }

  redo(current) {
    if (!this.future.length) return null;
    const entry = this.future.pop();
    this.past.push({ label: entry.label, snapshot: deepClone(current) });
    return deepClone(entry.snapshot);
  }

  clear() {
    this.past.length = 0;
    this.future.length = 0;
  }
}
