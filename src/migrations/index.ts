import * as migration_20260917_033437 from './20260917_033437';
import * as migration_20260917_050650 from './20260917_050650';
import * as migration_20260917_115547 from './20260917_115547';
import * as migration_20260917_133623 from './20260917_133623';
import * as migration_20260917_153924 from './20260917_153924';

export const migrations = [
  {
    up: migration_20260917_033437.up,
    down: migration_20260917_033437.down,
    name: '20260917_033437',
  },
  {
    up: migration_20260917_050650.up,
    down: migration_20260917_050650.down,
    name: '20260917_050650',
  },
  {
    up: migration_20260917_115547.up,
    down: migration_20260917_115547.down,
    name: '20260917_115547',
  },
  {
    up: migration_20260917_133623.up,
    down: migration_20260917_133623.down,
    name: '20260917_133623',
  },
  {
    up: migration_20260917_153924.up,
    down: migration_20260917_153924.down,
    name: '20260917_153924'
  },
];
