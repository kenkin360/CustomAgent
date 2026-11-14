import './Function.extend.js';

var AppUI=Function.extend(Object, function () {
	var _=this(AppUI);
	AppUI=_[AppUI];

	function AppUI(context) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_context=context;
		$this.m_mounted=new Map();
		$this.m_listeners=new Set();
		$this.m_handler=null;
	}

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];

	_['public'].Mount=function (name, element, slot='header') {
		let $this=_(this);
		let target=$this.m_context.Slots[slot];
		if (!name||!(element instanceof HTMLElement)||!this.Slots.includes(slot)||!target) {
			throw new Error('Provide an extension name, an HTML element, and an available UI slot.');
		}
		this.Unmount(name);
		$this.m_mounted.set(name, {Element: element, Slot: slot});
		target.appendChild(element);
	};

	_['public'].Unmount=function (name) {
		let $this=_(this);
		$this.m_mounted.get(name)?.Element.remove();
		$this.m_mounted.delete(name);
	};

	_['public'].Mounted=function () {
		return [..._(this).m_mounted.keys()];
	};

	_['public'].CaptureVersion=function () {
		let $this=_(this);
		return {
			Mounted: new Map($this.m_mounted)
			, Listeners: new Set($this.m_listeners)
			, Handler: $this.m_handler
		};
	};

	_['public'].RestoreVersion=function (version) {
		let $this=_(this);
		for (let name of this.Mounted()) this.Unmount(name);
		for (let [name, entry] of version.Mounted) this.Mount(name, entry.Element, entry.Slot);
		$this.m_listeners=new Set(version.Listeners);
		$this.m_handler=version.Handler;
	};

	_['public'].GetConversationHandler=function () {
		return _(this).m_handler;
	};

	_['public'].SetConversationHandler=function (handler) {
		if (handler!==null&&typeof handler!=='function') {
			throw new Error('Conversation handler must be a function or null.');
		}
		let $this=_(this);
		let previous=$this.m_handler;
		$this.m_handler=handler;
		return ()=>{
			if ($this.m_handler===handler) $this.m_handler=previous;
		};
	};

	_['public'].HasConversationHandler=function () {
		return _(this).m_handler!==null;
	};

	_['public'].GetState=function () {
		let state=_(this).m_context.GetState();
		return {
			...state
			, history: [...state.history]
			, messages: [...state.messages]
			, accumulatedChanges: [...state.accumulatedChanges]
		};
	};

	_['public'].Subscribe=function (listener) {
		let $this=_(this);
		$this.m_listeners.add(listener);
		listener(this.GetState());
		return ()=>$this.m_listeners.delete(listener);
	};

	_['public'].Notify=function () {
		for (let listener of _(this).m_listeners) {
			try { listener(this.GetState()); }
			catch (error) { console.error('App UI subscriber failed:', error); }
		}
	};

	_['public'].RunAction=function (action) {
		return _(this).m_context.RunAction(action);
	};

	_['public'].GenerateText=function (prompt, options) {
		return _(this).m_context.GenerateText(prompt, options);
	};

	_['public'].UpdateConversation=function (patch) {
		_(this).m_context.UpdateConversation(patch);
	};

	_['public'].ResetConversation=function () {
		let $this=_(this);
		if ($this.m_context.GetState().isGenerating) {
			throw new Error('Wait for image generation to finish before resetting the conversation.');
		}
		$this.m_context.UpdateConversation({messages: [], accumulatedChanges: [], generationPrompt: '', inputText: ''});
		$this.m_context.ResetCopied();
	};

	_['public'].SetInput=function (value) {
		this.UpdateConversation({inputText: value});
	};

	_['public'].SetRatio=function (value) {
		if (!['1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) {
			throw new Error('Unsupported aspect ratio.');
		}
		this.UpdateConversation({selectedRatio: value});
	};

	_['public'].SelectVersion=function (id) {
		_(this).m_context.SelectVersion(id);
	};

	_['public'].SendMessage=function (text) {
		return _(this).m_context.SendMessage(text);
	};

	_['public'].Generate=function (prompt) {
		return _(this).m_context.Generate(prompt);
	};

	_['public'].PickMedia=function () {
		return _(this).m_context.PickMedia();
	};

	_['public'].CaptureCamera=function () {
		return _(this).m_context.CaptureCamera();
	};

	_['public'].Download=function () {
		return _(this).m_context.Download();
	};

	_['public'].RollbackCode=function () {
		return _(this).m_context.RollbackCode();
	};

	_['public'].Destroy=function () {
		let $this=_(this);
		for (let name of this.Mounted()) this.Unmount(name);
		$this.m_listeners.clear();
		$this.m_handler=null;
	};

	_['private'].m_context=null;
	_['private'].m_mounted=null;
	_['private'].m_listeners=null;
	_['private'].m_handler=null;
});

export { AppUI };
