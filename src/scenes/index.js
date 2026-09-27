import * as boot from './boot.js';
import * as genesis from './genesis.js';
import * as geometry from './geometry.js';
import * as current from './current.js';
import * as sim from './sim.js';
import * as objects from './objects.js';
import * as sw from './switch.js';
import * as vibe from './vibe.js';
import * as erase from './erase.js';
import * as warp from './warp.js';
import * as execution from './execution.js';
import * as cosmos from './cosmos.js';
import * as love from './love.js';
import * as singularity from './singularity.js';
import * as end from './end.js';

// One factory per chapter id in timeline.js.
export const SCENES = {
  boot: boot.create,
  genesis: genesis.create,
  geometry: geometry.create,
  current: current.create,
  sim: sim.create,
  objects: objects.create,
  switch: sw.create,
  vibe: vibe.create,
  erase: erase.create,
  warp: warp.create,
  execution: execution.create,
  cosmos: cosmos.create,
  love: love.create,
  singularity: singularity.create,
  end: end.create,
};
