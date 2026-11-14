# CustomAgent

Flow SDK image discussion and local editing app. `App.tsx` is the Flow entry point.

## Modules

| File | Responsibility |
| --- | --- |
| `App.tsx` | React screen, state, and event entry points |
| `ConversationController.js` | Model dialogue, action planning, results, and final replies |
| `AppUI.js` | Runtime UI API, extensions, conversation handler, and state bridge |
| `ImageService.js` | Flow media, camera, image generation, and downloads |
| `DrawingActions.js` | Validated local rectangle operation |
| `runtimeActions.ts` | Runtime installation, module loading, source inspection, and rollback |
| `upscaleCode.ts` | Startup `installCode` implementation for image upscaling |
| `Function.extend.js` | Class implementation used by the JavaScript modules |
| `types.ts` | Shared TypeScript interfaces |

The JavaScript classes follow FlowerX's `Function.extend(Object, factory)` pattern with `_['public']` and `_['private']` members. `App.tsx` imports the classes as ES modules; `Function.extend.js` is imported for its script side effect and has no `export` statement.

The user message is shown before the runtime rollback check. Conversation history sent to the model contains the preceding 20 messages, excluding the newly submitted message, which is sent separately. Local actions do not start image generation. The user starts image generation explicitly through the generate control.

To use this in Flow host, add all source files in this repository with their exact filenames and select `App.tsx` as the entry point. The app depends on Flow's `flow-sdk`, React, and `lucide-react`.
