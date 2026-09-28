// Dream World registry. Add a theme here to make it available to levels.
import { CityTheme } from './city.js';

const FACTORIES = {
  city: () => new CityTheme(),
};

export const WORLD_IDS = Object.keys(FACTORIES);

export function createTheme(id) {
  const f = FACTORIES[id] ?? FACTORIES.city;
  return f();
}
