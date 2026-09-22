// One fixed simulation step. Knows nothing about canvas or DOM.

export function stepSimulation(state, dt) {
  state.tick += 1;
  state.time += dt;
}
