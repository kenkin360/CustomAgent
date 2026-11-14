# CustomAgent

Flow host contains exactly four files: `App.tsx`, `Bundle.js`, `Resource.js`, and `Function.extend.js`. Copy those four files into Flow host using the same filenames. `App.tsx` is a small `Function.extend(React.Component)` loader, following FlowerX's entry point. `Bundle.js` loads the following plain JavaScript files from this repository through `esm.sh` as classic scripts, in dependency order:

- `UpscaleCode.js` — startup `installCode` source for WebSR
- `views/agent.html.js` — interface markup and styles
- `DrawingActions.js` — validated local rectangle drawing
- `RuntimeActions.js` — runtime installation, module loading, source inspection, and rollback
- `ImageService.js` — Flow media, camera, generation, and download operations
- `ConversationController.js` — agent dialogue, local actions, and final response
- `CustomAgent.js` — React component, interface events, and its private runtime UI bridge

Every remotely loaded file is a classic script with a top-level `var` whose name exactly matches its `Bundle.Config` key. `Resource.Module` reads that name from `globalThis`; classic scripts expose top-level `var` there without an explicit assignment. Remote scripts have no top-level `import` or `export`. `UpscaleCode.js` contains `export default` only inside the JavaScript source string passed to `installCode` at runtime. The host's `Bundle.js` and `Resource.js` remain ES modules because `App.tsx` imports them.

Sending a message displays it before the rollback intent check. The model receives up to 20 preceding messages plus the current message separately. Image generation starts only after the user chooses Generate. The UI supports multiple input lines with Shift+Enter.
