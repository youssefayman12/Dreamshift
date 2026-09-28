// Cosmetic catalog. Purely visual — never affects gameplay. `cost` is in
// dream fragments; `unlock` names an achievement that grants it instead.
export const SKINS = [
  { id: 'dreamer', name: 'Dreamer', body: '#f4efff', shade: '#c9bff0', cap: '#5a48ff', capDark: '#3524b8', pom: '#ffe38a', outline: '#150b2b', cost: 0 },
  { id: 'moth', name: 'Moth', body: '#f3e7cf', shade: '#cdb994', cap: '#8d6c4d', capDark: '#5e4531', pom: '#fff3b8', outline: '#1d140b', cost: 150 },
  { id: 'mint', name: 'Mint Sleep', body: '#e8fff6', shade: '#a9dfc9', cap: '#15b890', capDark: '#0b7a5f', pom: '#bafff0', outline: '#061b16', cost: 300 },
  { id: 'ember', name: 'Ember', body: '#fff0e6', shade: '#f0bfa6', cap: '#ff5a3c', capDark: '#b82f19', pom: '#ffd24d', outline: '#2a0a04', cost: 300 },
  { id: 'void', name: 'Void Walker', body: '#2b2442', shade: '#1a152b', cap: '#0b0716', capDark: '#000', pom: '#b58bff', outline: '#d8ccff', eye: '#e9ddff', cost: 600 },
  { id: 'starlit', name: 'Starlit', body: '#fffbea', shade: '#e8dcb0', cap: '#1b2154', capDark: '#0c0f2e', pom: '#ffffff', outline: '#10132e', pattern: 'stars', unlock: 'stars_city' },
  { id: 'lucid', name: 'Lucid', body: '#ffe0ec', shade: '#e8a9c2', cap: '#2e0a1c', capDark: '#12030a', pom: '#ff5c95', outline: '#22040f', pattern: 'stars', unlock: 'wake_up' },
];

export const TRAILS = [
  { id: 'wisp', name: 'Wisp', cost: 0 },
  { id: 'none', name: 'None', cost: 0 },
  { id: 'stardust', name: 'Stardust', cost: 200 },
  { id: 'petals', name: 'Petals', cost: 250 },
  { id: 'aurora', name: 'Aurora', cost: 450 },
];

export const FLIPFX = [
  { id: 'ripple', name: 'Ripple', cost: 0 },
  { id: 'shock', name: 'Shockring', cost: 250 },
  { id: 'feathers', name: 'Pillow Burst', cost: 250 },
  { id: 'prism', name: 'Prism', unlock: 'near_100' },
];

export const CATALOG = { skin: SKINS, trail: TRAILS, flipfx: FLIPFX };

export function findCosmetic(kind, id) {
  const list = CATALOG[kind];
  return list.find((c) => c.id === id) ?? list[0];
}
