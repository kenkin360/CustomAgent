var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_owner=this;
		$this.m_root=React.createRef();
		$this.m_state={
			activeImage: null
			, history: []
			, messages: []
			, inputText: ''
			, selectedRatio: 'original'
			, accumulatedChanges: []
			, generationPrompt: ''
			, isConsulting: false
			, isGenerating: false
		};
		$this.m_versions=[];
		$this.m_mounted=new Map();
		$this.m_listeners=new Set();
		$this.m_dynamicModules=[];
		$this.m_ready=null;
		$this.m_startup=null;
		$this.m_sources=[...(props.SourceFiles||[]), ['DrawRectangle', Bundle.CustomAgent('DrawRectangle.js')], ['Upscale', Bundle.CustomAgent('Upscale.js')]];
		$this.m_actions=Object.assign(Object.create(null), {
			readCompiledSource: (args)=>this.ReadCompiledSource(args)
			, readRemoteSource: (args)=>this.ReadRemoteSource(args)
			, readInstalledSource: (args)=>this.ReadInstalledSource(args)
			, inspectRuntime: (args)=>this.InspectRuntime(args)
			, loadModule: (args, context)=>{
				return this.LoadModule(context.source, {name: args.name, Type: context.Type, readyMember: args.readyMember, track: context.track});
			}
			, rollback: ()=>({message: this.Rollback()})
			, resetConversation: ()=>{
				this.ResetConversation();
				return {message: 'Conversation cleared.', conversationReset: true};
			}
		});
		$this.m_compiledSources=Object.create(null);
		$this.m_compiledError=null;
		try { $this.m_compiledSources=$this.ParseCompiledSource(props.HostSourceUrl); }
		catch (error) { $this.m_compiledError=error; }
		$this.m_installedSources=Object.create(null);
		$this.m_images=new ImageService(Flow);
		$this.m_lastMessages=null;
		$this.m_lastMessagesNode=null;
		$this.m_lastConsulting=null;
		$this.m_lastHistory=null;
		$this.m_lastHistoryNode=null;
		$this.m_activeTurn=null;
		$this.m_clickBindings=[];
		$this.m_locale=(navigator.languages||[]).find((language)=>/^zh\b/i.test(language))?'zh':/^zh\b/i.test(navigator.language||'')?'zh':'en';
	}

	_['private'].Node=function (role) {
		return this.m_root.current?.querySelector(`[data-role="${role}"]`);
	};

	_['private'].SetValues=function (patch) {
		Object.assign(this.m_state, patch);
		this.Update();
		this.Notify();
	};

	_['private'].AddMessage=function (sender, text, fields={}) {
		let $this=_(this);
		$this.SetValues({messages: [...$this.m_state.messages, {
			id: `${sender}_${Date.now()}_${Math.random()}`
			, sender
			, text
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, ...fields
		}]});
	};

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];
	_['public'].Text=function (key) {
		let english={tagline: 'Describe an edit to use local tools, or generate an image', help: 'Help', target: 'Target Image', download: 'Download', empty: 'No image selected. Load an image or describe an idea in chat.', media: '＋ Media', camera: 'Camera', generating: 'Generating image…', history: 'Image versions', copyPrompt: 'Copy prompt', generate: 'Generate image from confirmed changes', ratio: 'Output ratio', original: 'Original', input: 'Discuss an idea, draw a rectangle, inspect code, or create a local tool…', send: 'Send', stop: 'Stop', about: "Discuss image changes or ask for local operations. Only the Generate button creates a new image. You can also inspect and extend this session's code.", close: 'Close', confirmedChanges: 'Confirmed changes', you: 'You', agent: 'Assistant', promptDraft: 'Combined prompt draft: ', copy: 'Copy', thinking: 'Thinking and running local operations…'};
		let chinese={tagline: '描述修改即可執行本地操作，也可選擇生成影像', help: '使用說明', target: '當前聚焦影像 (Target Image)', download: '下載', empty: '尚未選擇或拍攝影像。請載入圖片，或在對話中描述構想。', media: '＋ 媒體庫', camera: '拍照', generating: 'AI 正在修訂影像…', history: '迭代歷程版本', copyPrompt: '複製提示詞', generate: '依已確認改動生成影像', ratio: '輸出比例', original: '原圖', input: '討論構想、畫矩形、查看程式碼，或編寫本地功能…', send: '傳送', stop: '停止', about: '可討論影像修改或要求本地操作。只有按下生成按鈕才會產生新影像，也可以要求查閱及擴充本次執行的程式碼。', close: '關閉', confirmedChanges: '已確認的改動項目', you: '您', agent: 'AI 助理 (Agent)', promptDraft: '整合提示詞草稿：', copy: '複製', thinking: '正在理解要求並處理本地操作…'};
		return (_(this).m_locale==='zh'?chinese:english)[key]||english[key]||key;
	};
	_['public'].Localize=function () {
		let root=_(this).m_root.current;
		if (!root) return;
		for (let node of root.querySelectorAll('[data-i18n]')) node.textContent=this.Text(node.dataset.i18n);
		for (let node of root.querySelectorAll('[data-i18n-placeholder]')) node.placeholder=this.Text(node.dataset.i18nPlaceholder);
	};

	_['public'].GetState=function () {
		let state=_(this).m_state;
		return {...state, history: [...state.history], messages: [...state.messages], accumulatedChanges: [...state.accumulatedChanges]};
	};

	_['public'].GetImageInfo=async function () {
		let $this=_(this);
		let image=$this.m_state.activeImage;
		if (!image) return null;
		let dimensions=await $this.m_images.GetDimensions(image);
		return {...dimensions, mimeType: image.mimeType, title: image.title};
	};

	_['public'].Reply=function (text, fields={}) {
		_(this).AddMessage('agent', text, fields);
	};

	_['public'].ReportError=function (error) {
		_(this).AddMessage('system', error.message||String(error));
	};

	_['public'].NotifyAssistant=async function (event, details, image) {
		try { await _(this).Report(event, details, image); }
		catch (error) { this.ReportError(error); }
	};

	_['public'].Mount=function (name, element, slot='header') {
		let $this=_(this);
		let target=$this.m_root.current?.querySelector(`[data-slot="${slot}"]`);
		if (!name||!(element instanceof HTMLElement)||!this.Slots.includes(slot)||!target) throw new Error('Provide an extension name, an HTML element, and an available UI slot.');
		this.Unmount(name);
		$this.m_mounted.set(name, {Element: element, Slot: slot});
		target.appendChild(element);
	};

	_['public'].Unmount=function (name) {
		let $this=_(this);
		$this.m_mounted.get(name)?.Element.remove();
		$this.m_mounted.delete(name);
	};

	_['public'].Mounted=function () { return [..._(this).m_mounted.keys()]; };

	_['public'].Subscribe=function (listener) {
		let $this=_(this);
		$this.m_listeners.add(listener);
		listener(this.GetState());
		return ()=>$this.m_listeners.delete(listener);
	};

	_['public'].Notify=function () {
		for (let listener of _(this).m_listeners) {
			try { listener(this.GetState()); }
			catch (error) { console.error('App subscriber failed:', error); }
		}
	};

	_['public'].UpdateConversation=function (patch) { _(this).SetValues(patch); };
	_['public'].ResetConversation=function () {
		let $this=_(this);
		if ($this.m_state.isGenerating) throw new Error('Wait for image generation to finish before resetting the conversation.');
		$this.SetValues({messages: [], accumulatedChanges: [], generationPrompt: '', inputText: ''});
	};
	_['public'].SetInput=function (value) { this.UpdateConversation({inputText: value}); };
	_['public'].SetRatio=function (value) {
		if (!['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) throw new Error('Unsupported aspect ratio.');
		this.UpdateConversation({selectedRatio: value});
	};
	_['public'].SelectVersion=function (id) {
		let $this=_(this);
		let image=$this.m_state.history.find((item)=>item.id===id);
		if (!image) throw new Error('Image version not found: '+id);
		$this.SetValues({activeImage: image});
	};
	_['public'].SendMessage=function (text) { return this.Send(text); };
	_['public'].Stop=function () {
		let $this=_(this);
		if (!$this.m_activeTurn) return;
		$this.m_activeTurn.cancelled=true;
		$this.m_activeTurn=null;
		$this.SetValues({isConsulting: false});
	};
	_['public'].PickMedia=function () { return this.SelectMedia(); };
	_['public'].RunAction=async function (action, track=true, source, Type) {
		let $this=_(this);
		await $this.m_startup;
		let image=$this.m_state.activeImage;
		let result=await $this.ExecuteAction(action, image, track, source, Type);
		if (result.image) $this.SetValues({activeImage: result.image, history: [result.image, ...$this.m_state.history]});
		return result;
	};

	_['public'].InspectRuntime=function (args={}) {
		let runtime=this.GetRuntime();
		if (typeof args.name==='string') {
			let fn=runtime.Modules[args.name]?.Run;
			if (typeof fn!=='function') throw new Error('Runtime function not found: '+args.name);
			return {message: `${args.name}: ${fn.Description||String(fn)}`};
		}
		return {message: `Callable modules: ${this.GetNames().map((name)=>name+(runtime.Modules[name].Run.Description?': '+runtime.Modules[name].Run.Description:'')).join('; ')||'(none)'}. Loaded modules: ${Object.keys(runtime.Modules).join(', ')||'(none)'}. Compiled source files: ${JSON.stringify(Object.keys(_(this).m_compiledSources))}. Bundle.Config: ${JSON.stringify(Bundle.Config)}. UI slots: ${this.Slots.join(', ')||'(unavailable)'}. Mounted UI: ${this.Mounted().join(', ')||'(none)'}. Reversible installations: ${_(this).m_versions.length}. Built-in actions: ${Object.keys(_(this).m_actions).join(', ')}.`};
	};

	_['public'].GetRuntime=function () {
		let runtime=globalThis.AppRuntime||=Object.create(null);
		runtime.Modules||=Object.create(null);
		let owner=_(this).m_owner;
		runtime.UI=owner;
		return runtime;
	};

	_['public'].GetNames=function () {
		let modules=this.GetRuntime().Modules;
		return Object.keys(modules).filter((name)=>typeof modules[name]?.Run==='function');
	};

	_['public'].HasVersion=function () {
		return _(this).m_versions.length>0;
	};

	_['public'].Rollback=function () {
		let $this=_(this);
		let installation=$this.m_versions.at(-1);
		if (!installation) throw new Error('No previous module installation is available.');
		let restore=(target, name, descriptor)=>{
			if (descriptor) Object.defineProperty(target, name, descriptor);
			else delete target[name];
		};
		$this.RestoreGlobal(installation.Name, installation.PreviousGlobal);
		restore(this.GetRuntime().Modules, installation.Name, installation.PreviousModule);
		restore($this.m_installedSources, installation.Name, installation.PreviousSource);
		$this.m_versions.pop();
		return `Restored the previous module definition and registration. ${$this.m_versions.length} earlier installations remain. UI changes made by the module require its own cleanup.`;
	};

	_['public'].Initialize=function () {
		let $this=_(this);
		if (!$this.m_startup) {
			$this.m_startup=(async ()=>{
				await this.LoadModule(Bundle.CustomAgent('DrawRectangle.js'), {name: 'DrawRectangle', Type: Resource.Module, track: false});
				await this.LoadModule(Bundle.CustomAgent('Upscale.js'), {name: 'Upscale', Type: Resource.Module, track: false});
			})().catch((error)=>{
				$this.m_startup=null;
				throw error;
			});
		}
		return $this.m_startup;
	};

	_['private'].RestoreGlobal=function (name, descriptor) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else if (!delete globalThis[name]) globalThis[name]=undefined;
	};

	_['private'].RegisterModule=function (name, value, source, remote, track, previousGlobal) {
		if (value==null) throw new Error(name+' did not expose a module value.');
		let runtime=this.GetRuntime();
		if (value.Run!==undefined&&typeof value.Run!=='function') throw new Error(name+' has an invalid Run method.');
		let installation={
			Name: name
			, PreviousGlobal: previousGlobal
			, PreviousModule: Object.getOwnPropertyDescriptor(runtime.Modules, name)
			, PreviousSource: Object.getOwnPropertyDescriptor(this.m_installedSources, name)
		};
		runtime.Modules[name]=value;
		this.m_installedSources[name]={Source: source, Remote: remote};
		if (track) this.m_versions.push(installation);
		return {message: `${name} loaded. Callable: ${typeof value.Run==='function'?'Run':'(none)'}. Reversible installations: ${this.m_versions.length}.`};
	};

	_['private'].ParseCompiledSource=function (url) {
		let prefix='data:text/javascript;base64,';
		if (!url?.startsWith(prefix)) throw new Error('The bundled source is unavailable from import.meta.url.');
		let bytes=Uint8Array.from(atob(url.slice(prefix.length)), (char)=>char.charCodeAt(0));
		let source=new TextDecoder().decode(bytes);
		let markers=[...source.matchAll(/^\/\/ virtual:([^\r\n]+)\r?\n/gm)];
		if (!markers.length) return {bundle: source};
		let files=Object.create(null);
		markers.forEach((marker, index)=>{
			let start=marker.index+marker[0].length;
			let end=index+1<markers.length?markers[index+1].index:source.length;
			let name=marker[1].trim();
			files[name]=(files[name]||'')+source.slice(start, end).replace(/^\/\/ virtual-export:default [^\r\n]+\r?\n/, '');
		});
		return files;
	};

	_['public'].ReadCompiledSource=function (args={}) {
		let $this=_(this);
		if ($this.m_compiledError) throw $this.m_compiledError;
		let files=$this.m_compiledSources;
		if (typeof args.file!=='string') return {message: `Compiled source files: ${JSON.stringify(Object.keys(files))}`};
		if (!Object.prototype.hasOwnProperty.call(files, args.file)) throw new Error('Compiled source file not found: '+args.file);
		return {message: `${args.file}:\n${files[args.file]}`};
	};

	_['public'].ReadRemoteSource=async function (args={}) {
		let entries=_(this).m_sources.map(([name, url, readyMember])=>({name, url, readyMember}));
		if (typeof args.name!=='string') return {message: `Remote source entries: ${JSON.stringify(entries)}`};
		let entry=entries.find((item)=>item.name===args.name||item.url.split(/[?#]/)[0].split('/').pop()===args.name);
		if (!entry) throw new Error('Remote source not found: '+args.name);
		let response=await fetch(entry.url);
		if (!response.ok) throw new Error(`Failed to read ${args.name}: HTTP ${response.status}`);
		return {message: `${entry.name}:\n${await response.text()}`};
	};

	_['public'].ReadInstalledSource=async function (args={}) {
		let sources=_(this).m_installedSources;
		if (typeof args.name!=='string') return {message: `Installed modules: ${JSON.stringify(Object.keys(sources))}`};
		let entry=sources[args.name];
		if (!entry) throw new Error('Installed module not found: '+args.name);
		if (!entry.Remote) return {message: `${args.name}:\n${entry.Source}`};
		let response=await fetch(entry.Source);
		if (!response.ok) throw new Error(`Failed to read ${args.name}: HTTP ${response.status}`);
		return {message: `${args.name}:\n${await response.text()}`};
	};

	_['public'].LoadModule=async function (source, options={}) {
		let $this=_(this);
		let {name, Type, readyMember, track=true}=options;
		if (typeof name!=='string'||!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('Provide a module name.');
		if (typeof source!=='string'||!source.trim()) throw new Error('Provide module source or a script URL.');
		if (typeof Type!=='function'||!(Type.prototype instanceof Resource)) throw new Error('Provide a Resource type for the module.');
		let remote=Type===Resource.Module||Type.prototype instanceof Resource.Module;
		if (remote&&$this.GetRuntime().Modules[name]) return {message: name+' is already loaded.'};
		let previousGlobal=Object.getOwnPropertyDescriptor(globalThis, name);
		try {
			let value=await new Type(name, source, readyMember);
			return $this.RegisterModule(name, value, source, remote, track, previousGlobal);
		}
		catch (error) {
			$this.RestoreGlobal(name, previousGlobal);
			throw error;
		}
	};

	_['private'].ExecuteAction=async function (action, image, track=true, source, Type) {
		if (!action?.arguments||typeof action.arguments!=='object'||Array.isArray(action.arguments)) throw new Error('Action arguments must be an object.');
		let args=action.arguments;
		let callback=_(this).m_actions[action.name]||this.GetRuntime().Modules[action.name]?.Run;
		if (typeof callback!=='function') throw new Error('Runtime function not found: '+String(action.name));
		let value=await callback(args, {image, track, source, Type});
		let output=value&&typeof value==='object'&&'image' in value?value.image:value;
		if (output&&typeof output.base64==='string'&&/^image\/(png|jpeg|webp)$/.test(output.mimeType)) {
			let dimensions=await _(this).m_images.GetDimensions(output);
			return {message: typeof value.message==='string'?value.message:`${action.name} updated the current image.`, image: {
				...image, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
				, base64: output.base64, mimeType: output.mimeType, mediaId: undefined
				, ...dimensions
				, prompt: `Local runtime edit: ${action.name}`
				, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
				, aspectRatio: _(this).m_images.GetAspectRatio(dimensions)
				, title: output.title||`${image?.title||'Image'} · ${action.name}`
			}};
		}
		if (value&&typeof value.message==='string') return value;
		return {message: `${action.name}: ${(typeof value==='string'?value:JSON.stringify(value)??'completed').slice(0,12000)}`};
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
		$this.GetRuntime();
		$this.m_input=(event)=>{
			if (event.target===$this.Node('input')) $this.m_state.inputText=event.target.value;
		};
		$this.m_key=(event)=>{
			if (event.target===$this.Node('input')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing) {
				event.preventDefault();
				if (!$this.m_state.isConsulting) $this.Send();
			}
		};
		let root=$this.m_root.current;
		let bind=(selector, callback)=>{
			for (let element of root.querySelectorAll(selector)) {
				element.addEventListener('click', callback);
				$this.m_clickBindings.push([element, callback]);
			}
		};
		bind('[data-action="send"]', ()=>$this.m_state.isConsulting?$this.m_owner.Stop():$this.Send());
		bind('[data-action="select"]', ()=>$this.SelectMedia());
		bind('[data-action="camera"]', ()=>$this.CaptureCamera());
		bind('[data-action="download"]', ()=>$this.Download());
		bind('[data-action="generate"]', ()=>$this.Generate());
		bind('[data-action="info"]', ()=>$this.Node('dialog').style.display='flex');
		bind('[data-action="close-info"]', ()=>$this.Node('dialog').style.display='none');
		bind('[data-action="copy-prompt"]', ()=>navigator.clipboard.writeText($this.m_state.generationPrompt||''));
		for (let button of root.querySelectorAll('[data-ratio]')) bind(`[data-ratio="${button.dataset.ratio}"]`, ()=>$this.SetValues({selectedRatio: button.dataset.ratio}));
		root.addEventListener('input', $this.m_input);
		root.addEventListener('keydown', $this.m_key);
		$this.Update();
		$this.m_ready=$this.Welcome();
	};

	_['private'].Update=function () {
		let $this=this;
		let state=this.m_state;
		let root=this.m_root.current;
		if (!root) return;
		let node=(role)=>new HtmlNode(this.Node(role));
		let picture=node('image');
		let image=picture.GetElement();
		if (state.activeImage) {
			let url=`data:${state.activeImage.mimeType};base64,${state.activeImage.base64}`;
			if (image&&image.src!==url) picture.SetSource(url);
			picture.Show(true);
		}
		else picture.Show(false);
		node('empty').SetStyle('display', state.activeImage?'none':'block');
		node('image-ratio').SetText(state.activeImage?.width&&state.activeImage?.height?`${state.activeImage.width} × ${state.activeImage.height}`:'');
		node('generating').SetStyle('display', state.isGenerating?'flex':'none');
		this.m_owner.Localize();
		new HtmlNode(root.querySelector('[data-action="send"]')).SetText(state.isConsulting?this.m_owner.Text('stop'):this.m_owner.Text('send'));
		let input=node('input');
		if (input.GetElement()?.value!==state.inputText) input.SetValue(state.inputText);
		node('pending').SetStyle('display', state.accumulatedChanges.length?'block':'none');
		node('pending-count').SetText(`${this.m_owner.Text('confirmedChanges')} (${state.accumulatedChanges.length})`);
		node('pending-list').SetText(state.accumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n'));
		node('pending-list').SetStyle('whiteSpace', 'pre-wrap');
		node('pending-prompt').SetText(state.generationPrompt||'');
		let ratios=node('ratios').GetElement();
		for (let button of ratios?.querySelectorAll('[data-ratio]')||[]) button.classList.toggle('ca-selected', button.dataset.ratio===state.selectedRatio);
		let list=node('message-list').GetElement();
		if (list&&(state.messages!==this.m_lastMessages||state.isConsulting!==this.m_lastConsulting||list!==this.m_lastMessagesNode)) {
			let items=state.messages.map((message)=>{
				let item=document.createElement('div');
				item.className=`ca-message ca-${message.sender}`;
				let time=document.createElement('small');
					time.textContent=(message.sender==='user'?this.m_owner.Text('you'):message.sender==='system'?'App':this.m_owner.Text('agent'))+' · '+message.timestamp;
				item.appendChild(time);
				if (message.includedImage) {
					let preview=document.createElement('img');
					preview.src=`data:${message.includedImage.mimeType};base64,${message.includedImage.base64}`;
					preview.alt='Image result';
					item.appendChild(preview);
				}
				let body=document.createElement('div');
				body.textContent=message.text;
				item.appendChild(body);
				if (message.suggestedPrompt) {
					let prompt=document.createElement('div');
					prompt.className='ca-prompt';
					prompt.textContent=this.m_owner.Text('promptDraft')+message.suggestedPrompt;
					item.appendChild(prompt);
					let copy=document.createElement('button');
					copy.textContent=this.m_owner.Text('copy');
					copy.onclick=()=>navigator.clipboard.writeText(message.suggestedPrompt);
					item.appendChild(copy);
				}
				return item;
			});
			let pendingIndex=state.isConsulting?state.messages.findLastIndex((message)=>message.sender==='user'):-1;
			if (pendingIndex>=0) {
				let thinking=document.createElement('div');
				thinking.className='ca-thinking';
				thinking.setAttribute('role', 'status');
				thinking.setAttribute('aria-live', 'polite');
				thinking.textContent=this.m_owner.Text('thinking');
				items.splice(pendingIndex+1, 0, thinking);
			}
			list.replaceChildren(...items);
			this.m_lastMessages=state.messages;
			this.m_lastMessagesNode=list;
			this.m_lastConsulting=state.isConsulting;
			(list.querySelector('.ca-thinking')||list.lastElementChild)?.scrollIntoView({block: 'nearest'});
		}
		if (!list) this.m_lastMessagesNode=null;
		let area=node('history').GetElement();
		if (area&&(state.history!==this.m_lastHistory||area!==this.m_lastHistoryNode)) {
			area.replaceChildren(...state.history.map((image)=>{
				let button=document.createElement('button');
				button.dataset.version=image.id;
				button.title=image.title;
				button.onclick=()=>this.m_owner.SelectVersion(image.id);
				let thumbnail=document.createElement('img');
				thumbnail.src=`data:${image.mimeType};base64,${image.base64}`;
				thumbnail.alt=image.title;
				button.appendChild(thumbnail);
				return button;
			}));
			this.m_lastHistory=state.history;
			this.m_lastHistoryNode=area;
		}
		if (!area) this.m_lastHistoryNode=null;
		node('history-count').SetText(state.history.length);
		for (let button of area?.children||[]) button.classList.toggle('ca-selected', button.dataset.version===state.activeImage?.id);
	};

	_['public'].Send=async function (text) {
		let $this=_(this);
		let message=String(text??$this.m_state.inputText).trim();
		if (!message||$this.m_state.isConsulting) return;
		let turn={cancelled: false};
		$this.m_activeTurn=turn;
		$this.AddMessage('user', message);
		$this.SetValues({inputText: '', isConsulting: true});
		try {
			await $this.HandleMessage(message, turn);
		}
		catch (error) { if (!turn.cancelled) await this.NotifyAssistant('Conversation failed', {Error: error.message||String(error)}); }
		finally {
			if ($this.m_activeTurn===turn) {
				$this.m_activeTurn=null;
				$this.SetValues({isConsulting: false});
			}
		}
	};

	_['public'].SelectMedia=async function () {
		let $this=_(this);
		try {
			let image=await $this.m_images.Select();
			if (!image) return;
			$this.SetValues({activeImage: image, history: [image, ...$this.m_state.history]});
			await this.NotifyAssistant('Media selected', {Title: image.title, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].CaptureCamera=async function () {
		let $this=_(this);
		try {
			let image=await $this.m_images.Capture();
			if (!image) return;
			$this.SetValues({activeImage: image, history: [image, ...$this.m_state.history]});
			await this.NotifyAssistant('Camera image captured', {Title: image.title, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].Generate=async function (prompt) {
		let $this=_(this);
		let state=$this.m_state;
		let text=String(prompt||state.generationPrompt).trim();
		if (!text||state.isGenerating) return;
		$this.SetValues({isGenerating: true});
		try {
			let generated=await $this.m_images.Generate(text, state.activeImage, state.selectedRatio, state.history.length+1);
			let image=generated.Image;
			$this.SetValues({activeImage: image, history: [image, ...state.history]});
			await this.NotifyAssistant('Image generation completed', {Title: image.title, Prompt: text, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
		finally { $this.SetValues({isGenerating: false}); }
	};

	_['public'].Download=async function () {
		let $this=_(this);
		try { await $this.m_images.Download($this.m_state.activeImage); }
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].componentWillUnmount=function () {
		let $this=_(this);
		this.Stop();
		let root=$this.m_root.current;
		for (let [element, callback] of $this.m_clickBindings) element.removeEventListener('click', callback);
		root?.removeEventListener('input', $this.m_input);
		root?.removeEventListener('keydown', $this.m_key);
		let runtime=this.GetRuntime();
		if (runtime.UI===this) delete runtime.UI;
		for (let name of this.Mounted()) this.Unmount(name);
		$this.m_listeners.clear();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: _(this).m_root, style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let app=$this.m_owner;
		let setupError='';
		let runtime={message: ''};

		try {
			await app.Initialize();
		}
		catch (error) {
			setupError=error.message||String(error);
		}

		try {
			runtime=await app.InspectRuntime({});
		}
		catch (error) {
			setupError=[setupError, error.message||String(error)].filter(Boolean).join('; ');
		}

		try {
			let response=await Flow.generate.text('你是否了解自己的能力?', {systemInstruction: `
你正在此 App 中啟動。請依照下列實際檢查結果簡短歡迎使用者，描述目前可用的能力。以下提供原碼檔案清單與執行狀態；需要原碼內容時可使用對應讀取操作。請依瀏覽器語系或使用者對話語言回覆；尚無語言線索時使用英文。
${runtime.message}
啟動結果：${setupError||'success'}
瀏覽器語系：${navigator.language}
`});
			if (response.text?.trim()&&!app.GetState().messages.length) app.Reply(response.text.trim());
		}
		catch (error) {
			app.ReportError(error);
		}
	};

	_['private'].ReadControl=function (value) {
		let marker=String.fromCharCode(96).repeat(3);
		let pattern=new RegExp(`${marker}json\\s*([\\s\\S]*?)\\s*${marker}`, 'gi');

		for (let block of [...String(value).matchAll(pattern)].reverse()) {
			try {
				let data=JSON.parse(block[1]);
				if (!data||!Object.prototype.hasOwnProperty.call(data, 'localAction')) continue;

				let remaining=(value.slice(0, block.index)+value.slice(block.index+block[0].length)).trim();
				let source=null;
				let Type=null;

				if (data.localAction?.name==='loadModule') {
					let sourceBlocks=[...remaining.matchAll(/(?:^|\n)```(javascript|js|text|url)\s*\n([\s\S]*?)\n```(?=\s*(?:\n|$))/gi)];
					let last=sourceBlocks.at(-1);

					if (last) {
						Type={javascript: Resource.Inline, js: Resource.Inline, text: Resource.Module, url: Resource.Module}[last[1].toLowerCase()];
						source=Type===Resource.Module?last[2].trim():last[2];
						remaining=(remaining.slice(0, last.index)+remaining.slice(last.index+last[0].length)).trim();
					}
				}

				return {Data: data, Text: remaining, Source: source, Type};
			}
			catch (error) {
				console.warn('Invalid conversation control', error);
			}
		}

		try {
			let data=JSON.parse(String(value).trim());
			if (data&&Object.prototype.hasOwnProperty.call(data, 'localAction')) {
				return {Data: data, Text: '', Source: null, Type: null};
			}
		}
		catch (error) {
		}

		if (/(?:^|\n)```json\s*\n/i.test(value)&&/(?:^|\n)```(?:javascript|js)\s*\n/i.test(value)) {
			throw new Error('Module code was returned with an invalid action decision; nothing was installed.');
		}

		return {Data: null, Text: String(value).trim(), Source: null, Type: null};
	};

	_['private'].Instruction=function (runtime) {
		let $this=_(this);
		let dynamicList=$this.m_dynamicModules.length
			?$this.m_dynamicModules.map((m)=>`${m.name} (載入時間: ${m.time})`).join(', ')
			:'(無)';

		return `
你是此 App 的 Assistant。你可以討論需求，也可以請 App 執行本地操作；影像生成由使用者按下生成按鈕啟動。請依使用者本輪使用的語言自然答覆，參考對話或瀏覽器語系判斷語言，預設使用英文。
實際能力：${runtime.message}
本次對話中經由 loadModule 載入的模組：${dynamicList}

需要操作時，在答覆最後附一個 json 程式碼區塊，包含 {"attemptPlan":[{"action":"操作名稱","attempts":1,"reason":"目的與重試條件"}],"localAction":{"name":"操作名稱","arguments":{}}}。一般討論直接以文字答覆。App 每次執行一項操作並回傳結果；依結果繼續、調整或答覆。
readCompiledSource 空參數列出啟動時已完整拆解的固定 host 檔案，{file} 取得完整原碼；readRemoteSource 空參數列出 Bundle.Config 等遠端來源，{name} 可重新取得其內容；readInstalledSource 空參數列出已安裝模組，{name} 取得安裝時保留的完整原碼，遠端安裝者可重新取得。inspectRuntime 檢查現有函數、模組及原碼入口。
loadModule 接收獨立的 JavaScript 程式碼或遠端腳本 URL。需要載入時，先輸出 javascript 程式碼區塊（原碼）或 text 程式碼區塊（URL），再於答覆最後輸出操作控制 JSON，其 localAction 為 {"name":"loadModule","arguments":{"name":"模組名稱"}}，並在 attemptPlan 列出 loadModule。自行撰寫類型時，以頂層 var 和 Function.extend(Base, factory) 宣告，將建構子、方法及靜態成員寫在類別定義內；需要完整範例時，可透過 readInstalledSource 查看 DrawRectangle 原碼。可呼叫的模組提供靜態 Run。
直接以模組名稱作為操作名稱呼叫其 Run；rollback 撤銷上一項模組安裝；resetConversation 清空對話。需要實作新功能時可讀程式碼並撰寫、載入模組。
可用模組可使用瀏覽器標準 API，操作目前影像時，模組的 Run 收到參數與 {image}，回傳 {message,image:{base64,mimeType}}。UI 可透過 AppRuntime.UI.Mount 掛入介面。模組可以只保留類型與靜態方法，若自行建立單例，應在 Function.extend 的類別定義內完成。
若有待使用者確認的生成修改，可於 JSON 加入 accumulatedChanges、suggestedPrompt、aspectRatio。操作結果與錯誤由 App 回傳；答覆使用者時以自然語言說明結果。
`;
	};

	_['private'].HandleMessage=async function (message, turn) {
		let $this=_(this);
		await $this.m_ready;
		if (turn?.cancelled) return;

		let app=$this.m_owner;
		let initial=app.GetState();
		let imageInfo=await app.GetImageInfo();
		if (turn?.cancelled) return;

		let prior=initial.messages.slice();
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();

		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length
			?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n')
			:'(none)';

		let question=()=>`
Current image: ${imageInfo?`${imageInfo.width} × ${imageInfo.height} pixels (${imageInfo.mimeType})`:'none'}
Selected generation aspect ratio: ${initial.selectedRatio}
Pending generation changes:
${changes}
Previous conversation (up to 20 messages):
${history}
Current user message:
${message}
`;

		let image=initial.activeImage;
		let changesOut=initial.accumulatedChanges;
		let promptOut=initial.generationPrompt;
		let ratioOut=initial.selectedRatio;
		let edited=null;
		let plan=[];
		let reports=[];
		let answer='';
		let structured=false;
		let runtime=await app.InspectRuntime({});

		for (;;) {
			if (turn?.cancelled) return;

			let request=reports.length?`
${question()}
Current action plan: ${JSON.stringify(plan)}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Choose the next action, revise the plan, or answer the user based on the actual results.
`:question();

			let options={systemInstruction: $this.Instruction(runtime)};
			if (image) options.images=[{base64: image.base64, mimeType: image.mimeType}];

			let response=await Flow.generate.text(`${request}. `, options);
			if (turn?.cancelled) return;

			let control=$this.ReadControl(response.text);
			answer=control.Text;

			let data=control.Data;
			if (data) {
				structured=true;
				if (Array.isArray(data.accumulatedChanges)) {
					changesOut=data.accumulatedChanges.filter((item)=>typeof item==='string');
				}
				if (typeof data.suggestedPrompt==='string') promptOut=data.suggestedPrompt;
				if (['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(data.aspectRatio)) {
					ratioOut=data.aspectRatio;
				}
				if (Array.isArray(data.attemptPlan)&&data.attemptPlan.length) plan=data.attemptPlan;
			}

			let action=data?.localAction;
			if (!action||typeof action.name!=='string') break;

			if (!plan.some((entry)=>entry.action===action.name)) {
				reports.push({
					action: action.name
					, status: 'error'
					, result: 'The action needs an attemptPlan entry before execution.'
				});
				continue;
			}

			try {
				if (turn?.cancelled) return;

				let result=await app.RunAction(action, true, control.Source, control.Type);
				if (turn?.cancelled) return;

				if (result.conversationReset) {
					let fresh=await Flow.generate.text('.', {systemInstruction: `
App 已清空對話。以使用者這次要求的語言自然回覆。
`});
					if (turn?.cancelled) return;
					if (!fresh.text?.trim()) throw new Error('The model returned an empty answer.');
					app.Reply(fresh.text.trim());
					return;
				}

				if (result.image) {
					image=result.image;
					imageInfo={
						width: image.width
						, height: image.height
						, mimeType: image.mimeType
					};
					edited=result.image;
				}

				if (action.name==='loadModule') {
					let modName=action.arguments?.name||'CustomModule';
					if (!$this.m_dynamicModules.some((m)=>m.name===modName)) {
						$this.m_dynamicModules.push({
							name: modName
							, time: new Date().toLocaleTimeString()
						});
					}
				}

				reports.push({
					action: action.name
					, status: 'success'
					, result: result.message
					, ...(result.image?{
						image: {
							width: result.image.width
							, height: result.image.height
							, mimeType: result.image.mimeType
						}
					}:{})
				});
				runtime=await app.InspectRuntime({});
			}
			catch (error) {
				reports.push({
					action: action.name
					, status: 'error'
					, result: error instanceof Error?error.message:String(error)
				});
			}
		}

		if (!answer) {
			let prompt=`
${question()}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Summarize these results and answer the user in natural language.
`;
			let response=await Flow.generate.text(`${prompt}. `, {systemInstruction: `
依使用者的語言，以 App 回報的結果為依據回答。
`});
			if (turn?.cancelled) return;
			answer=response.text?.trim();
		}

		if (!answer) throw new Error('The model returned an empty answer me.');
		if (turn?.cancelled) return;

		if (structured) {
			app.UpdateConversation({
				accumulatedChanges: changesOut
				, generationPrompt: changesOut.length?promptOut:''
				, selectedRatio: ratioOut
			});
		}

		app.Reply(answer, {
			accumulatedChanges: changesOut
			, suggestedPrompt: promptOut||undefined
			, aspectRatio: ratioOut
			, ...(edited?{
				includedImage: {
					base64: edited.base64
					, mimeType: edited.mimeType
				}
			}:{})
		});
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_ready;

		let messages=_(this).m_owner.GetState().messages.slice(-8)
			.map((entry)=>`${entry.sender}: ${entry.text}`)
			.join('\n');

		let prompt=`
Recent conversation:
${messages}
App event: ${event}
Actual result: ${JSON.stringify(details)}
Reply briefly to the user in the language of the current conversation.
`;
		let response=await Flow.generate.text(`${prompt}. `, {systemInstruction: `
根據 App 回報的結果，依使用者當前對話語言簡短回覆。
`});

		if (!response.text?.trim()) throw new Error('The model returned an empty answer.');
		_(this).m_owner.Reply(response.text.trim(), image?{includedImage: image}:{});
	};

	_['private'].m_root=null;
	_['private'].m_state=null;
	_['private'].m_owner=null;
	_['private'].m_versions=null;
	_['private'].m_mounted=null;
	_['private'].m_listeners=null;
	_['private'].m_actions=null;
	_['private'].m_dynamicModules=null;
	_['private'].m_ready=null;
	_['private'].m_startup=null;
	_['private'].m_sources=null;
	_['private'].m_compiledSources=null;
	_['private'].m_compiledError=null;
	_['private'].m_installedSources=null;
	_['private'].m_images=null;
	_['private'].m_lastMessages=null;
	_['private'].m_lastMessagesNode=null;
	_['private'].m_lastConsulting=null;
	_['private'].m_lastHistory=null;
	_['private'].m_lastHistoryNode=null;
	_['private'].m_activeTurn=null;
	_['private'].m_locale=null;
	_['private'].m_clickBindings=null;
	_['private'].m_input=null;
	_['private'].m_key=null;
});
