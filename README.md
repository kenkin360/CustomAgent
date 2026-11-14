# CustomAgent

Flow host contains exactly four files: `App.tsx`, `Bundle.js`, `Resource.js`, and `Function.extend.js`. Copy those four files into Flow host using the same filenames. `App.tsx` is a small `Function.extend(React.Component)` loader, following FlowerX's entry point. `Bundle.js` loads the following plain JavaScript files from this repository through `esm.sh` as classic scripts, in dependency order:

- `UpscaleCode.js` — startup `installCode` source for WebSR
- `views/agent.html.js` — interface markup and styles
- `DrawingActions.js` — validated local rectangle drawing
- `RuntimeActions.js` — runtime installation, module loading, source inspection, and rollback
- `AppUI.js` — runtime UI bridge and mounted extension slots
- `ImageService.js` — Flow media, camera, generation, and download operations
- `ConversationController.js` — agent dialogue, local actions, and final response
- `CustomAgent.js` — React component and interface events

Every remotely loaded script defines its expected global name and has no top-level `import` or `export`. `UpscaleCode.js` contains an `export default` only inside the JavaScript source string passed to `installCode` at runtime. `Bundle.js` is loaded in Flow host as an ES module and exports `Bundle` for `App.tsx`.

Sending a message displays it before the rollback intent check. The model receives up to 20 preceding messages plus the current message separately. Image generation starts only after the user chooses Generate. The UI supports multiple input lines with Shift+Enter.
