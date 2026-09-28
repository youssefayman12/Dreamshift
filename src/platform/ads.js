// Ad pacing policy. Ads only ever appear at natural breaks — never during
// active play — and are rate-limited so the game stays pleasant without them.
const MIN_GAP = 180;       // seconds between interstitials
const GRACE = 120;         // no interstitials in the first two minutes

export class AdPolicy {
  constructor(platform, analytics) {
    this.p = platform;
    this.a = analytics;
    this.sessionStart = performance.now() / 1000;
    this.lastAd = -Infinity;
    this.breaks = 0;
  }

  /**
   * Called at a natural break. `kind`: 'stageComplete' | 'endlessOver' | 'menu'.
   * Resolves once any ad is done (immediately if none is shown).
   */
  async naturalBreak(kind) {
    this.breaks++;
    const now = performance.now() / 1000;
    if (now - this.sessionStart < GRACE) return;
    if (now - this.lastAd < MIN_GAP) return;
    // Don't interrupt every break; roughly every other one.
    if (this.breaks % 2 !== 0 && kind !== 'stageComplete') return;
    this.lastAd = now;
    this.a.track('ad_midgame', { kind });
    await this.p.midgameAd();
  }

  /** Optional rewarded ad (continue / bonus). Resolves true if granted. */
  async rewarded(reason) {
    if (!this.p.hasRewarded) return false;
    this.a.track('ad_rewarded_request', { reason });
    const ok = await this.p.rewardedAd();
    if (ok) this.lastAd = performance.now() / 1000; // counts toward pacing
    this.a.track('ad_rewarded_result', { reason, ok });
    return ok;
  }
}
