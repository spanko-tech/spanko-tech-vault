// Barrel module — re-exports everything from ui/*.
// Existing dashboards keep working with: const UI = await dc.require("Toolkit/Datacore/UI.jsx");
//
// New code can require submodules directly for slightly faster cold load:
//   const F = await dc.require("Toolkit/Datacore/ui/Forms.jsx");
//   const L = await dc.require("Toolkit/Datacore/ui/Layout.jsx");
//   const B = await dc.require("Toolkit/Datacore/ui/Boards.jsx");
//   const H = await dc.require("Toolkit/Datacore/ui/Hooks.jsx");
//   const LT = await dc.require("Toolkit/Datacore/ui/Lint.jsx");

const F  = await dc.require("Toolkit/Datacore/ui/Forms.jsx");
const L  = await dc.require("Toolkit/Datacore/ui/Layout.jsx");
const B  = await dc.require("Toolkit/Datacore/ui/Boards.jsx");
const H  = await dc.require("Toolkit/Datacore/ui/Hooks.jsx");
const LT = await dc.require("Toolkit/Datacore/ui/Lint.jsx");

return { ...F, ...L, ...B, ...H, ...LT };
