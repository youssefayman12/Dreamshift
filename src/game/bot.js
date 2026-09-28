// Autopilot used by the title-screen attract mode (and ?bot for testing).
// Replans a short horizon ahead with the same solver used by the validator.
import { plan } from './solver.js';

export class Bot {
  constructor(run, opts = {}) {
    this.run = run;
    this.flips = null;
    this.base = 0;
    this.horizon = opts.horizon ?? 220;
    run.onStep = (step) => this.onStep(step);
  }

  replan(step) {
    const r = this.run;
    const res = plan(r.level, r.runner, r.t, this.horizon);
    this.flips = res ? new Set(res) : new Set();
    this.base = step;
  }

  onStep(step) {
    const r = this.run;
    if (!this.flips || step - this.base > this.horizon * 0.45 || r.runner !== this.lastRunner) {
      this.lastRunner = r.runner;
      this.replan(step);
    }
    // A buffer that only lives for this one step: exactly the planned flip.
    if (this.flips.has(step - this.base)) r.buffer = 1e-6;
  }
}
