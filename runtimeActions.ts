import { Flow } from 'flow-sdk';
import type { ImageVersion, Message, LocalAction } from './types';
import { DrawingActions } from './DrawingActions.js';
import { UPSCALE_INSTALL_CODE } from './upscaleCode';

type RuntimeFunction = (args: unknown, context: { image: ImageVersion | null }) => unknown;
type Runtime = Record<string, unknown> & { Modules?: Record<string, unknown> };

export type AppUISlot = 'header' | 'canvas' | 'chat' | 'overlay';

export interface AppUIState {
  activeImage: ImageVersion | null;
  history: ImageVersion[];
  messages: Message[];
  inputText: string;
  selectedRatio: string;
  accumulatedChanges: string[];
  generationPrompt: string;
  isConsulting: boolean;
  isGenerating: boolean;
}

export type ConversationPatch = Partial<Pick<AppUIState,
  'messages' | 'inputText' | 'selectedRatio' | 'accumulatedChanges' | 'generationPrompt'>>;

export type ConversationHandler = (text: string, ui: AppUI) => void | Promise<void>;

export interface AppUI {
  Slots: AppUISlot[];
  Mount(name: string, element: HTMLElement, slot?: AppUISlot): void;
  Unmount(name: string): void;
  Mounted(): string[];
  GetState(): AppUIState;
  Subscribe(listener: (state: AppUIState) => void): () => void;
  RunAction(action: LocalAction): Promise<ActionResult>;
  GenerateText: typeof Flow.generate.text;
  UpdateConversation(patch: ConversationPatch): void;
  SetConversationHandler(handler: ConversationHandler | null): () => void;
  HasConversationHandler(): boolean;
  ResetConversation(): void;
  SetInput(text: string): void;
  SetRatio(ratio: string): void;
  SelectVersion(id: string): void;
  SendMessage(text?: string): Promise<void>;
  Generate(prompt?: string): Promise<void>;
  PickMedia(): Promise<void>;
  CaptureCamera(): Promise<void>;
  Download(): Promise<void>;
  CaptureVersion(): unknown;
  RestoreVersion(snapshot: unknown): void;
  RollbackCode(): string;
}

interface RuntimeSnapshot {
  Runtime: PropertyDescriptorMap;
  Modules: PropertyDescriptorMap;
  ModulesTarget: Record<string, unknown>;
  UI: unknown;
  UIProperties?: PropertyDescriptorMap;
}

const versions: RuntimeSnapshot[] = [];
const restoredFailures = new WeakSet<object>();
let installing = false;
let activeUI: AppUI | null = null;

declare global {
  var AppRuntime: Runtime | undefined;
}

export interface ActionResult {
  message: string;
  image?: ImageVersion;
  conversationReset?: boolean;
}

function getRuntime(): Runtime {
  if (!globalThis.AppRuntime) {
    globalThis.AppRuntime = Object.create(null) as Runtime;
  }
  const runtime = globalThis.AppRuntime;
  runtime.Modules ||= Object.create(null) as Record<string, unknown>;
  runtime.LoadModule ||= (args: unknown) => loadModule(getArguments(args));
  return runtime;
}

export function attachAppUI(ui: AppUI): () => void {
  const runtime = getRuntime();
  activeUI = ui;
  runtime.UI = ui;
  return () => {
    if (runtime.UI === ui) {
      delete runtime.UI;
    }
    if (activeUI === ui) activeUI = null;
  };
}

export function getRuntimeNames(): string[] {
  const runtime = getRuntime();
  return Object.keys(runtime).filter((name) => typeof runtime[name] === 'function');
}

function captureVersion(): RuntimeSnapshot {
  const runtime = getRuntime();
  return {
    Runtime: Object.getOwnPropertyDescriptors(runtime),
    Modules: Object.getOwnPropertyDescriptors(runtime.Modules!),
    ModulesTarget: runtime.Modules!,
    UI: activeUI?.CaptureVersion(),
    UIProperties: activeUI ? Object.getOwnPropertyDescriptors(activeUI) : undefined,
  };
}

function restoreProperties(target: object, properties: PropertyDescriptorMap): void {
  for (const key of Reflect.ownKeys(target)) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      if (!Reflect.deleteProperty(target, key)) {
        throw new Error(`Cannot restore non-configurable runtime member: ${String(key)}`);
      }
    }
  }
  Object.defineProperties(target, properties);
}

function restoreVersion(snapshot: RuntimeSnapshot): void {
  const runtime = getRuntime();
  restoreProperties(runtime, snapshot.Runtime);
  restoreProperties(snapshot.ModulesTarget, snapshot.Modules);
  if (activeUI) {
    runtime.UI = activeUI;
    if (snapshot.UIProperties) restoreProperties(activeUI, snapshot.UIProperties);
    if (snapshot.UI !== undefined) activeUI.RestoreVersion(snapshot.UI);
  }
}

export function rollbackRuntime(): string {
  const previous = versions[versions.length - 1];
  if (!previous) {
    throw new Error('No previous runtime code version is available.');
  }
  restoreVersion(previous);
  versions.pop();
  return `Restored the previous runtime code version. ${versions.length} earlier versions remain.`;
}

export function hasRuntimeVersion(): boolean {
  return versions.length > 0;
}

export function wasInstallationRecovered(error: unknown): boolean {
  return typeof error === 'object' && error !== null && restoredFailures.has(error);
}

export async function recoverIfRequested(text: string): Promise<string | null> {
  if (!hasRuntimeVersion()) return null;
  if (/^\s*\/(?:rollback|undo)\s*$/i.test(text)) return rollbackRuntime();
  let requested = false;
  try {
    const response = await Flow.generate.text(text, {
      systemInstruction: 'Classify whether the user wants to undo a recent runtime code change or says the latest change is broken and should be undone. Answer exactly ROLLBACK or CONTINUE. Merely asking what an error means, requesting a new fix, or discussing old versions is CONTINUE. Interpret the message in any language.',
    });
    requested = /^ROLLBACK\b/i.test(response.text.trim());
  } catch (error) {
    console.warn('Recovery intent check failed:', error);
  }
  return requested ? rollbackRuntime() : null;
}

async function waitForGlobal(name: string, readyMember: string | undefined, timeout: number): Promise<unknown> {
  const scope = globalThis as Record<string, any>;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let value = scope[name];
    if (value && typeof value.then === 'function') {
      let timer: ReturnType<typeof setTimeout>;
      try {
        value = await Promise.race([
          value,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), deadline - Date.now());
          }),
        ]);
      } finally {
        clearTimeout(timer!);
      }
      scope[name] = value;
    }
    if (value && (!readyMember || value[readyMember])) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${name}${readyMember ? `.${readyMember}` : ''}`);
}

async function loadScript(url: string, timeout: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${url}`));
    }, timeout);
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(`Failed to load ${url}`));
    };
    script.src = url;
    (document.head || document.body || document.documentElement).appendChild(script);
  });
}

async function loadModule(args: Record<string, unknown>): Promise<ActionResult> {
  const specifier = args.specifier;
  const name = args.name;
  if (typeof specifier !== 'string' || !specifier.trim() ||
      typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) {
    throw new Error('Provide an esm.sh specifier and a module name.');
  }
  const url = new URL(specifier.startsWith('https://') ? specifier : `https://esm.sh/${specifier.replace(/^\/+/, '')}`);
  if (url.origin !== 'https://esm.sh') {
    throw new Error('Only esm.sh module URLs are supported.');
  }
  const runtime = getRuntime();
  const modules = runtime.Modules!;
  if (modules[name]) {
    return { message: `${name} is already loaded from esm.sh.` };
  }
  if (url.searchParams.has('raw')) {
    const globalName = typeof args.globalName === 'string' ? args.globalName : undefined;
    const readyMember = typeof args.readyMember === 'string' ? args.readyMember : undefined;
    if (readyMember && !globalName) {
      throw new Error('readyMember requires globalName.');
    }
    const timeout = typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs)
      ? Math.max(1000, Math.min(60000, args.timeoutMs)) : 30000;
    await loadScript(url.href, timeout);
    const value = globalName ? await waitForGlobal(globalName, readyMember, timeout) : true;
    modules[name] = value;
    return { message: `${name} loaded as a raw script from ${url.href}${globalName ? `; global: ${globalName}${readyMember ? `.${readyMember}` : ''}` : ''}.` };
  }
  const value = await import(url.href);
  modules[name] = value;
  return { message: `${name} loaded as an ES module from ${url.href}; exports: ${Object.keys(value).slice(0, 40).join(', ') || '(none)'}.` };
}

function getArguments(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Action arguments must be an object.');
  }
  return value as Record<string, unknown>;
}

function getSourceFiles(url: string): Record<string, string> {
  const prefix = 'data:text/javascript;base64,';
  if (!url.startsWith(prefix)) {
    throw new Error('The bundled source is unavailable from import.meta.url.');
  }
  const bytes = Uint8Array.from(atob(url.slice(prefix.length)), (char) => char.charCodeAt(0));
  const source = new TextDecoder().decode(bytes);
  const markers = [...source.matchAll(/^\/\/ virtual:([^\r\n]+)\r?\n/gm)];
  if (!markers.length) {
    return { bundle: source };
  }
  const files: Record<string, string> = Object.create(null);
  markers.forEach((marker, index) => {
    const name = marker[1].trim();
    const start = marker.index! + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index! : source.length;
    const content = source.slice(start, end).replace(/^\/\/ virtual-export:default [^\r\n]+\r?\n/, '');
    files[name] = (files[name] || '') + content;
  });
  return files;
}

function readAppSource(args: Record<string, unknown>, url: string): ActionResult {
  const files = getSourceFiles(url);
  const names = Object.keys(files);
  if (typeof args.file !== 'string') {
    return { message: `Available bundled files: ${names.join(', ')}` };
  }
  const source = files[args.file];
  if (source === undefined) {
    throw new Error(`Bundled file not found: ${args.file}`);
  }
  const limit = typeof args.limit === 'number' && Number.isInteger(args.limit)
    ? Math.max(1, Math.min(12000, args.limit)) : 8000;
  const search = typeof args.query === 'string' ? args.query : '';
  const match = search ? source.toLowerCase().indexOf(search.toLowerCase()) : -1;
  if (search && match < 0) {
    return { message: `${args.file}: no match for ${JSON.stringify(search)}.` };
  }
  const offset = match >= 0 ? Math.max(0, match - 500)
    : typeof args.offset === 'number' && Number.isInteger(args.offset)
      ? Math.max(0, Math.min(source.length, args.offset)) : 0;
  return {
    message: `${args.file} (${offset}-${Math.min(source.length, offset + limit)} of ${source.length} characters):\n${source.slice(offset, offset + limit)}`,
  };
}

async function installCode(args: Record<string, unknown>, track = true): Promise<ActionResult> {
  if (typeof args.code !== 'string' || !args.code.trim() || args.code.length > 50000) {
    throw new Error('Provide JavaScript module code of at most 50000 characters.');
  }
  if (installing) throw new Error('Another runtime installation is in progress.');
  const runtime = getRuntime();
  const snapshot = captureVersion();
  installing = true;
  const before = { ...runtime };
  try {
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(args.code)}#${Date.now()}_${Math.random()}`;
    const module = await import(url);
    if (typeof module.default === 'function') {
      await module.default(runtime);
    }
    const names = getRuntimeNames();
    const changed = names.filter((name) => runtime[name] !== before[name]);
    const panels = (runtime.UI as AppUI | undefined)?.Mounted() || [];
    if (track) versions.push(snapshot);
    return { message: `Code loaded in the current App runtime. Registered functions: ${changed.join(', ') || '(none)'}. Available functions: ${names.join(', ') || '(none)'}. Mounted UI: ${panels.join(', ') || '(none)'}. Custom conversation: ${(runtime.UI as AppUI | undefined)?.HasConversationHandler() || false}. Reversible versions: ${versions.length}.` };
  } catch (error) {
    try {
      restoreVersion(snapshot);
    } catch (restoreError) {
      throw new Error(`Installation failed: ${String(error)}. Recovery failed: ${String(restoreError)}`);
    }
    const failure = error instanceof Error ? error : new Error(String(error));
    restoredFailures.add(failure);
    throw failure;
  } finally {
    installing = false;
  }
}

let startupPromise: Promise<ActionResult> | null = null;

export function initializeBuiltins(): Promise<ActionResult> {
  if (!startupPromise) {
    startupPromise = installCode({ code: UPSCALE_INSTALL_CODE }, false).catch((error) => {
      startupPromise = null;
      throw error;
    });
  }
  return startupPromise;
}

function inspectRuntime(args: Record<string, unknown>): ActionResult {
  const runtime = getRuntime();
  if (typeof args.name === 'string') {
    const member = runtime[args.name];
    if (typeof member !== 'function') {
      throw new Error(`Runtime function not found: ${args.name}`);
    }
    return { message: `${args.name}: ${String(member).slice(0, 12000)}` };
  }
  const ui = runtime.UI as AppUI | undefined;
  return { message: `AppRuntime functions: ${getRuntimeNames().join(', ') || '(none)'}. Loaded modules: ${Object.keys(runtime.Modules!).join(', ') || '(none)'}. UI slots: ${ui?.Slots.join(', ') || '(unavailable)'}. Mounted UI: ${ui?.Mounted().join(', ') || '(none)'}. Custom conversation: ${ui?.HasConversationHandler() || false}. Reversible versions: ${versions.length}. Built-in actions: drawRectangle, readAppSource, inspectRuntime, installCode, loadModule, callRuntime, rollbackCode, resetConversation.` };
}

async function callRuntime(args: Record<string, unknown>, image: ImageVersion | null): Promise<ActionResult> {
  const runtime = getRuntime();
  const name = args.name;
  const fn = typeof name === 'string' ? runtime[name] : undefined;
  if (typeof fn !== 'function') {
    throw new Error(`Runtime function not found: ${String(name)}`);
  }
  const value = await (fn as RuntimeFunction)(args.arguments ?? {}, { image });
  const output = value && typeof value === 'object' && 'image' in value ? value.image : value;
  if (output && typeof output === 'object' && 'base64' in output && 'mimeType' in output &&
      typeof output.base64 === 'string' && typeof output.mimeType === 'string' &&
      /^image\/(png|jpeg|webp)$/.test(output.mimeType)) {
    const result = value as { message?: string };
    const picture = output as { base64: string; mimeType: string; title?: string };
    return {
      message: typeof result.message === 'string' ? result.message : `${name} updated the current image.`,
      image: {
        ...image,
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        base64: picture.base64,
        mimeType: picture.mimeType,
        mediaId: undefined,
        prompt: `Local runtime edit: ${name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aspectRatio: image?.aspectRatio || '1:1',
        title: picture.title || `${image?.title || 'Image'} · ${name}`,
      },
    };
  }
  const message = typeof value === 'string' ? value : JSON.stringify(value) ?? 'completed';
  return { message: `${name}: ${message.slice(0, 12000)}` };
}

export async function executeAppAction(action: LocalAction, image: ImageVersion | null, sourceUrl: string): Promise<ActionResult> {
  const args = getArguments(action.arguments);
  switch (action.name) {
    case 'drawRectangle':
      return { message: 'Rectangle drawn on the current image.', image: await DrawingActions.Execute(action, image) };
    case 'readAppSource':
      return readAppSource(args, sourceUrl);
    case 'inspectRuntime':
      return inspectRuntime(args);
    case 'installCode':
      return installCode(args);
    case 'loadModule':
      return loadModule(args);
    case 'callRuntime':
      return callRuntime(args, image);
    case 'rollbackCode':
      return { message: rollbackRuntime() };
    case 'resetConversation':
      if (!activeUI) throw new Error('App UI is unavailable.');
      activeUI.ResetConversation();
      return { message: 'Conversation cleared.', conversationReset: true };
    default:
      throw new Error(`Unsupported local action: ${action.name}`);
  }
}
