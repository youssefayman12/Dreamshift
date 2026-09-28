// Portal abstraction. Gameplay code only ever talks to this interface, so
// adding another portal (Poki, GameDistribution, …) means adding an adapter.
//
// Interface:
//   name, init(), loadingStart(), loadingStop(), gameplayStart(), gameplayStop(),
//   happyTime(), midgameAd() -> Promise<void>, rewardedAd() -> Promise<boolean>,
//   hasRewarded (bool)

class NoPlatform {
  constructor() { this.name = 'web'; this.hasRewarded = false; }
  async init() {}
  loadingStart() {}
  loadingStop() {}
  gameplayStart() {}
  gameplayStop() {}
  happyTime() {}
  async midgameAd() {}
  async rewardedAd() { return false; }
}

/** Local testing adapter: `?portal=mock` simulates ads with a 1.5s overlay. */
class MockPlatform extends NoPlatform {
  constructor() { super(); this.name = 'mock'; this.hasRewarded = true; }
  fake(label) {
    return new Promise((res) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;background:#000c;color:#fff;display:grid;place-items:center;font:700 24px system-ui;z-index:99';
      d.textContent = `[ ${label} ad ]`;
      document.body.appendChild(d);
      setTimeout(() => { d.remove(); res(); }, 1500);
    });
  }
  async midgameAd() { this.onAdStart?.(); await this.fake('midgame'); this.onAdEnd?.(); }
  async rewardedAd() { this.onAdStart?.(); await this.fake('rewarded'); this.onAdEnd?.(); return true; }
}

class CrazyGamesPlatform extends NoPlatform {
  constructor() { super(); this.name = 'crazygames'; this.hasRewarded = true; }
  async init() {
    if (!window.CrazyGames?.SDK) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    this.sdk = window.CrazyGames.SDK;
    await this.sdk.init();
  }
  loadingStart() { this.sdk?.game.loadingStart?.(); }
  loadingStop() { this.sdk?.game.loadingStop?.(); }
  gameplayStart() { this.sdk?.game.gameplayStart(); }
  gameplayStop() { this.sdk?.game.gameplayStop(); }
  happyTime() { this.sdk?.game.happytime?.(); }
  ad(type) {
    return new Promise((res) => {
      if (!this.sdk) return res(false);
      this.sdk.ad.requestAd(type, {
        adStarted: () => this.onAdStart?.(),
        adFinished: () => { this.onAdEnd?.(); res(true); },
        adError: () => { this.onAdEnd?.(); res(false); },
      });
    });
  }
  async midgameAd() { await this.ad('midgame'); }
  async rewardedAd() { return this.ad('rewarded'); }
}

export async function createPlatform() {
  const q = new URLSearchParams(location.search);
  const portal = q.get('portal') || (/crazygames/.test(document.referrer) ? 'crazygames' : '');
  let p;
  if (portal === 'crazygames') p = new CrazyGamesPlatform();
  else if (portal === 'mock') p = new MockPlatform();
  else p = new NoPlatform();
  try { await p.init(); } catch (e) {
    console.warn('[platform] init failed, continuing without SDK', e);
    p = new NoPlatform();
  }
  return p;
}
