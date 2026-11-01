/* Round the Bases! — the main field is shared by two modes: the race and "You call it". */
(function () {
"use strict";
const view = window.RTBField(document.getElementById("cv"), { lo: -18, hi: 108 });
const modes = {};
let mode = "race";

const stage = {
  view,
  register(name, api) { modes[name] = api; },
  get mode() { return mode; },
  setMode(next) {
    if (next === mode) return;
    if (modes[mode]) modes[mode].leave();
    mode = next;
    modes[mode].enter();
  },
  render() { if (modes[mode]) modes[mode].render(); },
};
new ResizeObserver(() => { view.size(); stage.render(); }).observe(view.canvas);
window.RTBStage = stage;
})();
