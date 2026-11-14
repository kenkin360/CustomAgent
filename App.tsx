import React, { useState, useRef, useEffect } from 'react';
import { Flow } from 'flow-sdk';
import type { Message, ImageVersion } from './types';
import { attachAppUI, executeAppAction, initializeBuiltins, hasRuntimeVersion, recoverIfRequested, rollbackRuntime, wasInstallationRecovered } from './runtimeActions';
import { AppUI as AgentUI } from './AppUI.js';
import { ConversationController } from './ConversationController.js';
import { ImageService } from './ImageService.js';
import type { AppUISlot, AppUIState } from './runtimeActions';
import {
  Sparkles,
  Send,
  Image as ImageIcon,
  Camera,
  Download,
  Wand2,
  RefreshCw,
  Plus,
  Sliders,
  History,
  Info,
  Maximize2,
  Check,
  Compass,
  ListChecks,
  CheckCircle2,
  Trash2
} from 'lucide-react';
const DEFAULT_IMAGE_MODEL = ImageService.ModelDisplayName;
const isConversationResetRequest = (text: string) =>
  /^(?:(?:那|好|請|麻煩|幫我|直接|先|現在)\s*)*(?:reset|重設|清除|清空)\s*(?:(?:目前|現在|全部|整個|所有)\s*的?\s*)?(?:對話|聊天|對話紀錄|聊天紀錄|對話記錄|聊天記錄)(?:\s*[。！!])?$/i.test(text);
export default function App() {
  // Current active image being reviewed/modified
  const [activeImage, setActiveImage] = useState<ImageVersion | null>(null);
  const [history, setHistory] = useState<ImageVersion[]>([]);
  // Accumulated modification items through multi-turn discussion
  const [accumulatedChanges, setAccumulatedChanges] = useState<string[]>([]);
  // Chat conversation state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: '您好！您可以要求我在影像上畫矩形、查閱這個 App 實際載入的程式碼，或在本次運行中編寫並載入新的本地功能。也可以討論其他視覺構想；只有您按下生成按鈕時，才會生成新影像。',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      accumulatedChanges: [],
      suggestedPrompt: '',
      aspectRatio: '16:9',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('16:9');
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const slots = useRef<Record<AppUISlot, HTMLDivElement | null>>({ header: null, canvas: null, chat: null, overlay: null });
  const uiRef = useRef<InstanceType<typeof AgentUI> | null>(null);
  const controller = useRef<InstanceType<typeof ConversationController> | null>(null);
  const imageService = useRef<InstanceType<typeof ImageService> | null>(null);
  if (!controller.current) controller.current = new ConversationController();
  if (!imageService.current) imageService.current = new ImageService(Flow);
  const appRef = useRef<{
    state: AppUIState;
    send: (text?: string) => Promise<void>;
    generate: (prompt?: string) => Promise<void>;
    pickMedia: () => Promise<void>;
    captureCamera: () => Promise<void>;
    download: () => Promise<void>;
  } | null>(null);
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isConsulting]);
  useEffect(() => {
    void initializeBuiltins().catch(console.error);
  }, []);
  const handleSelectMedia = async () => {
    try {
      const image = await imageService.current!.Select(selectedRatio);
      if (!image) return;
      setActiveImage(image);
      setHistory((previous) => [image, ...previous]);
      setMessages((previous) => [...previous, {
        id: 'msg_' + Date.now(), sender: 'agent',
        text: `我已載入影像「${image.title}」。您可以叫我直接畫矩形，例如「在左上角畫紅色矩形」，也可以討論需要生成的其他修改。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        includedImage: {base64: image.base64, mimeType: image.mimeType},
      }]);
    } catch (error) {
      console.error('Failed to select media:', error);
    }
  };
  const handleCaptureCamera = async () => {
    try {
      const image = await imageService.current!.Capture(selectedRatio);
      if (!image) return;
      setActiveImage(image);
      setHistory((previous) => [image, ...previous]);
      setMessages((previous) => [...previous, {
        id: 'msg_' + Date.now(), sender: 'agent',
        text: '已接收到照片。您可以描述要畫的矩形，也可以討論其他影像修改。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        includedImage: {base64: image.base64, mimeType: image.mimeType},
      }]);
    } catch (error) {
      console.error('Failed to capture photo:', error);
    }
  };
  // Send message through Flow.generate.text
  const handleSendMessage = async (text?: string) => {
    if (isConsulting || appRef.current?.state.isConsulting) return;
    const userText = (text ?? appRef.current?.state.inputText ?? inputText).trim();
    if (!userText) return;
    if (isConversationResetRequest(userText)) {
      uiRef.current?.ResetConversation();
      return;
    }
    const userMsg: Message = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    if (appRef.current) appRef.current.state.messages = [...appRef.current.state.messages, userMsg];
    setMessages((previous) => [...previous, userMsg]);
    if (appRef.current) appRef.current.state.isConsulting = true;
    if (appRef.current) appRef.current.state.inputText = '';
    setInputText('');
    if (hasRuntimeVersion()) {
      setIsConsulting(true);
      try {
        const restored = await recoverIfRequested(userText);
        if (restored) {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages((previous) => [...previous,
            { id: 'recovery_' + Date.now(), sender: 'agent', text: restored, timestamp },
          ]);
          if (appRef.current) appRef.current.state.isConsulting = false;
          setIsConsulting(false);
          return;
        }
      } catch (error) {
        console.error('Runtime recovery failed:', error);
        setMessages((previous) => [...previous, {
          id: 'recovery_error_' + Date.now(),
          sender: 'agent',
          text: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
        if (appRef.current) appRef.current.state.isConsulting = false;
        setIsConsulting(false);
        return;
      }
    }
    const ui = uiRef.current!;
    const handler = ui.GetConversationHandler();
    setIsConsulting(true);
    try {
      if (handler) {
        await handler(userText, ui);
      } else {
        await initializeBuiltins();
        await controller.current!.Send(userText, ui);
      }
    } catch (error) {
      console.error('Conversation failed:', error);
      let recovery = '';
      if (handler) {
        try {
          while (!wasInstallationRecovered(error) && hasRuntimeVersion() && ui.GetConversationHandler() === handler) {
            recovery = rollbackRuntime();
          }
          if (!wasInstallationRecovered(error) && ui.GetConversationHandler() === handler) {
            ui.SetConversationHandler(null);
            recovery = 'Restored the default conversation handler.';
          }
        } catch (restoreError) {
          recovery = `Recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`;
        }
      }
      const detail = error instanceof Error ? error.message : String(error);
      ui.UpdateConversation({messages: [...ui.GetState().messages, {
        id: 'err_' + Date.now(),
        sender: 'agent',
        text: `Conversation failed: ${detail}${recovery ? '. ' + recovery : ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]});
    } finally {
      if (appRef.current) appRef.current.state.isConsulting = false;
      setIsConsulting(false);
    }
  };
  // Execute image generation with Nano Banana 2.1
  const handleGenerateRevision = async (customPrompt?: string) => {
    const promptToUse = customPrompt || generationPrompt;
    if (!promptToUse.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const generated = await imageService.current!.Generate(promptToUse, activeImage, selectedRatio, history.length + 1);
      const newVersion: ImageVersion = generated.Image;
      if (activeImage && !activeImage.mediaId && generated.SourceMediaId) {
        setHistory((previous) => previous.map((version) => version.id === activeImage.id
          ? {...version, mediaId: generated.SourceMediaId} : version));
      }
      setActiveImage(newVersion);
      setHistory((prev) => [newVersion, ...prev]);
      // Add confirmation message to chat
      const confirmMsg: Message = {
        id: 'gen_' + Date.now(),
        sender: 'agent',
        text: `已為您生成新的視覺修訂版本！您可以在左側畫布即時檢視細節。若有需要進一步調整之處（例如強化對比、替換背景物件），隨時在對話中提出！`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        includedImage: {
          base64: newVersion.base64,
          mimeType: newVersion.mimeType,
        },
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error('Failed to generate image:', err);
      const errMsg: Message = {
        id: 'err_' + Date.now(),
        sender: 'agent',
        text: '影像生成失敗，請檢查提示詞或稍後重試。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsGenerating(false);
    }
  };
  const handleDownload = async () => {
    try {
      await imageService.current!.Download(activeImage);
    } catch (error) {
      console.error('Download error:', error);
    }
  };
  const copyPrompt = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  appRef.current = {
    state: {
      activeImage, history, messages, inputText, selectedRatio,
      accumulatedChanges, generationPrompt, isConsulting, isGenerating,
    },
    send: handleSendMessage,
    generate: handleGenerateRevision,
    pickMedia: handleSelectMedia,
    captureCamera: handleCaptureCamera,
    download: handleDownload,
  };
  useEffect(() => {
    uiRef.current?.Notify();
  }, [activeImage, history, messages, inputText, selectedRatio, accumulatedChanges, generationPrompt, isConsulting, isGenerating]);
  useEffect(() => {
    const ui = new AgentUI({
      Slots: slots.current,
      GetState: () => appRef.current!.state,
      ResetCopied: () => setCopiedId(null),
      RollbackCode: rollbackRuntime,
      GenerateText: (prompt: string, options: any) => Flow.generate.text(prompt, options),
      SendMessage: (text?: string) => appRef.current!.send(text),
      Generate: (prompt?: string) => appRef.current!.generate(prompt),
      PickMedia: () => appRef.current!.pickMedia(),
      CaptureCamera: () => appRef.current!.captureCamera(),
      Download: () => appRef.current!.download(),
      SelectVersion: (id: string) => {
        const version = appRef.current!.state.history.find((item) => item.id === id);
        if (!version) throw new Error(`Image version not found: ${id}`);
        appRef.current!.state.activeImage = version;
        setActiveImage(version);
      },
      RunAction: async (action: any) => {
        const result = await executeAppAction(action, appRef.current!.state.activeImage, import.meta.url);
        if (result.image) {
          appRef.current!.state.activeImage = result.image;
          setActiveImage(result.image);
          setHistory((previous) => [result.image!, ...previous]);
        }
        return result;
      },
      UpdateConversation: (patch: any) => {
        const state = appRef.current!.state;
        if (patch.messages !== undefined) {
          state.messages = patch.messages;
          setMessages(patch.messages);
        }
        if (patch.accumulatedChanges !== undefined) {
          state.accumulatedChanges = patch.accumulatedChanges;
          setAccumulatedChanges(patch.accumulatedChanges);
        }
        if (patch.generationPrompt !== undefined) {
          state.generationPrompt = patch.generationPrompt;
          setGenerationPrompt(patch.generationPrompt);
        }
        if (patch.selectedRatio !== undefined) {
          state.selectedRatio = patch.selectedRatio;
          setSelectedRatio(patch.selectedRatio);
        }
        if (patch.inputText !== undefined) {
          state.inputText = patch.inputText;
          setInputText(patch.inputText);
        }
      },
    });
    uiRef.current = ui;
    const detach = attachAppUI(ui);
    return () => {
      detach();
      if (uiRef.current === ui) uiRef.current = null;
      ui.Destroy();
    };
  }, []);
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Bar for Context Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Compass size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              Visual Concept Director
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Agent Active
              </span>
            </div>
            <div className="text-xs text-slate-400">描述修改即可執行本地繪圖，也可選擇生成影像</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div ref={(node) => { slots.current.header = node; }} className="flex items-center gap-2" />
          <button
            onClick={() => setIsIntroOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800 transition"
          >
            <Info size={14} />
            <span>使用說明</span>
          </button>
        </div>
      </div>
      {/* Main Workspace: Split View */}
      <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">
        {/* Left Side: Viewport & Canvas (order-1 on mobile, lg:order-1) */}
        <main className="order-1 shrink-0 min-h-[260px] max-h-[44vh] lg:max-h-none lg:min-h-0 lg:flex-1 overflow-hidden flex flex-col bg-slate-900/60 border-b lg:border-b-0 lg:border-r border-slate-800 p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-indigo-400" />
              <span>當前聚焦影像 (Target Image)</span>
            </div>
            {activeImage && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  比例: {activeImage.aspectRatio}
                </span>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
                  title="下載當前影像"
                >
                  <Download size={13} />
                  <span>下載</span>
                </button>
              </div>
            )}
          </div>
          {/* Main Visual Display Frame */}
          <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden group">
            <div ref={(node) => { slots.current.canvas = node; }} className="absolute inset-0 z-10 pointer-events-none [&>*]:pointer-events-auto" />
            {activeImage ? (
              <div className="w-full h-full relative flex items-center justify-center p-2">
                <img
                  src={`data:${activeImage.mimeType};base64,${activeImage.base64}`}
                  alt={activeImage.title}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                />
                {isGenerating && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-400" size={32} />
                    <div className="text-sm font-medium text-slate-200">
                      AI 正在依據指導修訂影像 ({DEFAULT_IMAGE_MODEL})...
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-6 max-w-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <ImageIcon size={24} />
                </div>
                <div className="text-sm font-medium text-slate-300 mb-1">尚未選擇或拍攝影像</div>
                <div className="text-xs text-slate-500 mb-4 leading-relaxed">
                  請載入一張需要修改的圖片，或直接在對話中描述您想創作的風格，由 AI 協助設計。
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleSelectMedia}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition"
                  >
                    <Plus size={14} />
                    <span>從媒體庫選取</span>
                  </button>
                  <button
                    onClick={handleCaptureCamera}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium border border-slate-700 transition"
                  >
                    <Camera size={14} />
                    <span>相機拍照</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Quick Version History Ribbon */}
          {history.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <History size={12} />
                  <span>迭代歷程版本 ({history.length})</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSelectMedia}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800"
                  >
                    <Plus size={12} /> 媒體庫
                  </button>
                  <button
                    onClick={handleCaptureCamera}
                    className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800"
                  >
                    <Camera size={12} /> 拍照
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {history.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => setActiveImage(ver)}
                    className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border transition ${
                      activeImage?.id === ver.id
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={`data:${ver.mimeType};base64,${ver.base64}`}
                      alt={ver.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
        {/* Right Side: Chat & Consultation Workspace (order-2 on mobile, lg:order-2) */}
        <aside className="order-2 flex-1 min-h-0 flex flex-col w-full lg:w-[480px] lg:flex-none lg:shrink-0 lg:h-full bg-slate-950">
          {/* Chat Messages Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {msg.sender === 'user' ? '您' : 'AI 創意總監 (Agent)'}
                  </span>
                  <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow'
                  }`}
                >
                  {/* Inline image thumbnail if included in message */}
                  {msg.includedImage && (
                    <div className="mb-2.5 rounded-lg overflow-hidden border border-slate-700/60 max-h-36">
                      <img
                        src={`data:${msg.includedImage.mimeType};base64,${msg.includedImage.base64}`}
                        alt="Discussion Image"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {/* Accumulated checklist chip in message if available */}
                  {msg.accumulatedChanges && msg.accumulatedChanges.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 bg-slate-950/60 -mx-1 -mb-1 p-2.5 rounded-xl">
                      <div className="text-[11px] font-semibold text-indigo-300 flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ListChecks size={13} className="text-indigo-400" />
                          已累計修訂清單 ({msg.accumulatedChanges.length})
                        </span>
                        <span className="text-[10px] text-slate-400">尚未生成，可繼續補充</span>
                      </div>
                      <ul className="space-y-1 mb-2">
                        {msg.accumulatedChanges.map((item, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-indigo-400 font-mono text-[10px] mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      {msg.suggestedPrompt && (
                        <div className="pt-2 border-t border-slate-900">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>整合提示詞草稿:</span>
                            <button
                              onClick={() => copyPrompt(msg.suggestedPrompt!, msg.id)}
                              className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                            >
                              {copiedId === msg.id ? <Check size={11} className="text-emerald-400" /> : null}
                              {copiedId === msg.id ? '已複製' : '複製'}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 italic line-clamp-2 font-mono">
                            {msg.suggestedPrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isConsulting && (
              <div className="flex items-start gap-2">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-xs p-3.5 flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="animate-spin text-indigo-400" size={14} />
                  <span>正在理解要求並處理本地操作...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          {/* Persistent Accumulated Modifications Bar & Explicit Confirm to Generate */}
          {accumulatedChanges.length > 0 && (
            <div className="mx-3 mb-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                  <ListChecks size={14} className="text-indigo-400" />
                  <span>已確認的改動項目 ({accumulatedChanges.length})</span>
                </div>
                <button
                  onClick={() => {
                    setAccumulatedChanges([]);
                    setGenerationPrompt('');
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
                  title="清空修訂清單"
                >
                  <Trash2 size={11} />
                  <span>清空重設</span>
                </button>
              </div>
              {/* Badges of current items */}
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                {accumulatedChanges.map((change, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-slate-900/90 text-slate-200 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1"
                  >
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                    <span>{change}</span>
                  </span>
                ))}
              </div>
              {/* The explicit Final Confirmation Button */}
              <button
                onClick={() => handleGenerateRevision()}
                disabled={isGenerating || !generationPrompt}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition shadow-md cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>正在依據所有改動生成新影像...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>所有改動已描述完畢，最後確認並生成影像 ({DEFAULT_IMAGE_MODEL})</span>
                  </>
                )}
              </button>
            </div>
          )}
          {/* Prompt Controls & Generation Toolbelt */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 shrink-0">
            <div ref={(node) => { slots.current.chat = node; }} className="flex items-center gap-2 empty:hidden" />
            {/* Quick parameter bar */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">輸出比例:</span>
                {(['16:9', '9:16', '1:1', '4:3', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition ${
                      selectedRatio === ratio
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500">可直接要求畫矩形</span>
            </div>
            {/* Chat Input Box */}
            <div className="flex items-center gap-2">
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  accumulatedChanges.length > 0
                    ? '繼續討論、執行本地功能，或按上方按鈕生成...'
                    : activeImage
                    ? '例如：畫矩形、查看 App 程式碼，或編寫新功能...'
                    : '討論構想、查看程式碼，或編寫本地功能...'
                }
                className="flex-1 min-w-0 max-h-32 resize-y bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isConsulting}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition shrink-0"
                title="發送對話"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </aside>
      </div>
      <div ref={(node) => { slots.current.overlay = node; }} className="fixed inset-0 z-40 pointer-events-none [&>*]:pointer-events-auto" />
      {/* Intro Modal */}
      {isIntroOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Visual Concept Director</h3>
                <p className="text-xs text-slate-400">影像修改對話與創意迭代工具</p>
              </div>
            </div>
            <div className="space-y-3 text-xs text-slate-300 mb-6 leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>
                  <strong>本地修改</strong>：載入圖片後，可描述矩形的位置、大小及顏色，App 會畫在影像上並保留新版本。
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>
                  <strong>程式碼與執行環境</strong>：可請 agent 查閱目前載入的打包程式碼，透過 esm.sh 載入外部模組，並在本次 App 運行中編寫和呼叫新的本地函式。
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>
                  <strong>可選的生成迭代 ({DEFAULT_IMAGE_MODEL})</strong>：其他修改可先討論並整理提示詞；只有按下生成按鈕才會調用影像模型。
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>
                  <strong>歷程版本比對與下載</strong>：本地修改及生成版本皆會保存在下方縮圖歷程中，可切換比對與下載。
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsIntroOpen(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
            >
              進入工作區開始對話
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
