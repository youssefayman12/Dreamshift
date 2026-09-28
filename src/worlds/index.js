// Dream World registry. Add a theme here to make it available to levels.
import { CityTheme } from './city.js';
import { GardenTheme } from './garden.js';
import { BedroomTheme } from './bedroom.js';

const FACTORIES = {
  city: () => new CityTheme(),
  garden: () => new GardenTheme(),
  bedroom: () => new BedroomTheme(),
};

export const WORLD_IDS = Object.keys(FACTORIES);

export function createTheme(id) {
  const f = FACTORIES[id] ?? FACTORIES.city;
  return f();
}
