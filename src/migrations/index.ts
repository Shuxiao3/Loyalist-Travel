import * as migration_20260917_033437 from './20260917_033437';
import * as migration_20260917_050650 from './20260917_050650';

export const migrations = [
  {
    up: migration_20260917_033437.up,
    down: migration_20260917_033437.down,
    name: '20260917_033437',
  },
  {
    up: migration_20260917_050650.up,
    down: migration_20260917_050650.down,
    name: '20260917_050650'
  },
];
