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
		$this.m_handler=null;
		$this.m_messageListener=null;
		$this.m_eventListener=null;
		$this.m_startup=null;
		$this.m_sources=[...(props.SourceFiles||[]), ['DrawRectangle', Bundle.CustomAgent('DrawRectangle.js')], ['UpscaleCode', Bundle.CustomAgent('UpscaleCode.js')]];
		$this.m_compiledSources=Object.create(null);
		$this.m_compiledError=null;
		try { $this.m_compiledSources=$this.ParseCompiledSource(props.HostSourceUrl); }
		catch (error) { $this.m_compiledError=error; }
		$this.m_installedSources=Object.create(null);
		$this.m_assistant=null;
		$this.m_images=new ImageService(Flow);
		$this.m_lastMessages=null;
		$this.m_lastConsulting=null;
		$this.m_lastHistory=null;
		$this.m_activeTurn=null;
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
		try { await _(this).m_eventListener(event, details, image); }
		catch (error) { this.ReportError(error); }
	};

	_['public'].SubscribeMessage=function (listener) {
		let $this=_(this);
		$this.m_messageListener=listener;
		return ()=>{ if ($this.m_messageListener===listener) $this.m_messageListener=null; };
	};

	_['public'].SubscribeEvent=function (listener) {
		let $this=_(this);
		$this.m_eventListener=listener;
		return ()=>{ if ($this.m_eventListener===listener) $this.m_eventListener=null; };
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

	_['public'].GetConversationHandler=function () { return _(this).m_handler; };

	_['public'].SetConversationHandler=function (handler) {
		if (handler!==null&&typeof handler!=='function') throw new Error('Conversation handler must be a function or null.');
		let $this=_(this);
		let previous=$this.m_handler;
		$this.m_handler=handler;
		return ()=>{ if ($this.m_handler===handler) $this.m_handler=previous; };
	};

	_['public'].HasConversationHandler=function () { return _(this).m_handler!==null; };
	_['public'].GenerateText=function (prompt, options) { return _(this).m_assistant.GenerateText(prompt, options); };
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
	_['public'].RollbackCode=function () { return this.Rollback(); };

	_['public'].RunAction=async function (action, track=true, source) {
		let $this=_(this);
		await $this.m_startup;
		let image=$this.m_state.activeImage;
		let result=await $this.ExecuteAction(action, image, track, source);
		if (result.image) $this.SetValues({activeImage: result.image, history: [result.image, ...$this.m_state.history]});
		return result;
	};

	_['public'].InspectRuntime=function (args={}) {
		return _(this).ExecuteAction({name: 'inspectRuntime', arguments: args}, _(this).m_state.activeImage);
	};

	_['public'].GetRuntime=function () {
		let runtime=globalThis.AppRuntime||=Object.create(null);
		runtime.Modules||=Object.create(null);
		let owner=_(this).m_owner;
		runtime.UI=owner;
		return runtime;
	};

	_['public'].GetNames=function () {
		return Object.keys(this.GetRuntime()).filter((name)=>typeof this.GetRuntime()[name]==='function');
	};

	_['public'].HasVersion=function () {
		return _(this).m_versions.length>0;
	};

	_['public'].Rollback=function () {
		let $this=_(this);
		let installation=$this.m_versions.at(-1);
		if (!installation) throw new Error('No previous module installation is available.');
		let runtime=this.GetRuntime();
		let restore=(target, name, descriptor)=>{
			if (descriptor) Object.defineProperty(target, name, descriptor);
			else delete target[name];
		};
		restore(runtime.Modules, installation.Name, installation.PreviousModule);
		if (installation.ActionName) restore(runtime, installation.ActionName, installation.PreviousAction);
		restore($this.m_installedSources, installation.Name, installation.PreviousSource);
		$this.m_versions.pop();
		return `Restored the previous module registration. ${$this.m_versions.length} earlier installations remain. UI changes made by the module require its own cleanup.`;
	};

	_['public'].Initialize=function () {
		let $this=_(this);
		if (!$this.m_startup) {
			$this.m_startup=(async ()=>{
				await this.LoadModule(Bundle.CustomAgent('DrawRectangle.js'), {name: 'DrawRectangle', track: false});
				await this.LoadModule(Bundle.CustomAgent('UpscaleCode.js'), {name: 'UpscaleCode', track: false});
			})().catch((error)=>{
				$this.m_startup=null;
				throw error;
			});
		}
		return $this.m_startup;
	};

	_['private'].RegisterModule=function (name, value, source, remote, track) {
		if (value==null) throw new Error(name+' did not expose a module value.');
		let runtime=this.GetRuntime();
		let actionName=value.ActionName;
		if (actionName!==undefined&&(typeof actionName!=='string'||!/^[A-Za-z_$][\w$]*$/.test(actionName)||typeof value.Run!=='function')) throw new Error(name+' has an invalid ActionName or Run method.');
		let installation={
			Name: name
			, PreviousModule: Object.getOwnPropertyDescriptor(runtime.Modules, name)
			, PreviousSource: Object.getOwnPropertyDescriptor(this.m_installedSources, name)
			, ActionName: actionName
			, PreviousAction: actionName?Object.getOwnPropertyDescriptor(runtime, actionName):null
		};
		runtime.Modules[name]=value;
		if (actionName) runtime[actionName]=value.Run;
		this.m_installedSources[name]={Source: source, Remote: remote};
		if (track) this.m_versions.push(installation);
		return {message: `${name} loaded. Registered functions: ${actionName||'(none)'}. Reversible installations: ${this.m_versions.length}.`};
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
		let {name, readyMember, track=true}=options;
		if (typeof name!=='string'||!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('Provide a module name.');
		if (typeof source!=='string'||!source.trim()) throw new Error('Provide module source or a script URL.');
		let remote=/^https?:\/\//i.test(source.trim());
		if ($this.GetRuntime().Modules[name]&&remote) return {message: name+' is already loaded.'};
		if ($this.GetRuntime().Modules[name]&&!remote) throw new Error('Use a new module name for updated code.');
		let url=remote?source.trim():`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
		let value=await new Resource.Module(name, url, readyMember);
		return $this.RegisterModule(name, value, source, remote, track);
	};

	_['private'].ExecuteAction=async function (action, image, track=true, source) {
		if (!action?.arguments||typeof action.arguments!=='object'||Array.isArray(action.arguments)) throw new Error('Action arguments must be an object.');
		let args=action.arguments;
		switch (action.name) {
			case 'readCompiledSource': return this.ReadCompiledSource(args);
			case 'readRemoteSource': return this.ReadRemoteSource(args);
			case 'readInstalledSource': return this.ReadInstalledSource(args);
			case 'inspectRuntime': {
				let runtime=this.GetRuntime();
				if (typeof args.name==='string') {
					if (typeof runtime[args.name]!=='function') throw new Error('Runtime function not found: '+args.name);
					return {message: `${args.name}: ${runtime[args.name].Description||String(runtime[args.name])}`};
				}
				return {message: `AppRuntime functions: ${this.GetNames().map((name)=>name+(runtime[name].Description?': '+runtime[name].Description:'')).join('; ')||'(none)'}. Loaded modules: ${Object.keys(runtime.Modules).join(', ')||'(none)'}. Compiled source files: ${JSON.stringify(Object.keys(this.m_compiledSources))}. Bundle.Config: ${JSON.stringify(Bundle.Config)}. UI slots: ${this.Slots.join(', ')||'(unavailable)'}. Mounted UI: ${this.Mounted().join(', ')||'(none)'}. Custom conversation: ${this.HasConversationHandler()||false}. Reversible installations: ${_(this).m_versions.length}. Built-in actions: readCompiledSource, readRemoteSource, readInstalledSource, inspectRuntime, loadModule, callRuntime, rollbackCode, resetConversation.`};
			}
			case 'loadModule': {
				if (Object.prototype.hasOwnProperty.call(args, 'code')||Object.prototype.hasOwnProperty.call(args, 'specifier')) throw new Error('Pass module source separately from action arguments.');
				return this.LoadModule(source, {name: args.name, readyMember: args.readyMember, track});
			}
			case 'rollbackCode': return {message: this.Rollback()};
			case 'resetConversation':
				this.ResetConversation();
				return {message: 'Conversation cleared.', conversationReset: true};
			default: {
				let name=action.name==='callRuntime'?args.name:action.name;
				let input=action.name==='callRuntime'?args.arguments??{}:args;
				let fn=this.GetRuntime()[name];
				if (typeof fn!=='function') throw new Error('Runtime function not found: '+String(name));
				let value=await fn(input, {image});
				let output=value&&typeof value==='object'&&'image' in value?value.image:value;
				if (output&&typeof output.base64==='string'&&/^image\/(png|jpeg|webp)$/.test(output.mimeType)) {
					let dimensions=await this.m_images.GetDimensions(output);
					return {message: typeof value.message==='string'?value.message:`${name} updated the current image.`, image: {
						...image, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
						, base64: output.base64, mimeType: output.mimeType, mediaId: undefined
						, ...dimensions
						, prompt: `Local runtime edit: ${name}`
						, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
						, aspectRatio: this.m_images.GetAspectRatio(dimensions)
						, title: output.title||`${image?.title||'Image'} · ${name}`
					}};
				}
				return {message: `${name}: ${(typeof value==='string'?value:JSON.stringify(value)??'completed').slice(0,12000)}`};
			}
		}
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
		$this.GetRuntime();
		$this.m_click=(event)=>$this.HandleClick(event);
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
		root.addEventListener('click', $this.m_click);
		root.addEventListener('input', $this.m_input);
		root.addEventListener('keydown', $this.m_key);
		$this.Update();
		$this.m_assistant=new Assistant(this);
	};

	_['private'].HandleClick=function (event) {
		let $this=this;
		let node=event.target.closest('[data-action],[data-ratio],[data-version]');
		if (!node||!this.m_root.current.contains(node)) return;
		if (node.dataset.ratio) { this.SetValues({selectedRatio: node.dataset.ratio}); return; }
		if (node.dataset.version) {
			let image=this.m_state.history.find((item)=>item.id===node.dataset.version);
			if (image) this.SetValues({activeImage: image});
			return;
		}
		switch (node.dataset.action) {
			case 'send': $this.m_state.isConsulting?$this.m_owner.Stop():$this.Send(); break;
			case 'select': $this.SelectMedia(); break;
			case 'camera': $this.CaptureCamera(); break;
			case 'download': $this.Download(); break;
			case 'generate': $this.Generate(); break;
			case 'info': $this.Node('dialog').style.display='flex'; break;
			case 'close-info': $this.Node('dialog').style.display='none'; break;
			case 'copy-prompt': navigator.clipboard.writeText(this.m_state.generationPrompt||''); break;
			case 'copy-message-prompt': {
				let message=this.m_state.messages.find((item)=>item.id===node.dataset.messageId);
				if (message?.suggestedPrompt) navigator.clipboard.writeText(message.suggestedPrompt);
				break;
			}
		}
	};

	_['private'].Update=function () {
		let $this=this;
		let state=this.m_state;
		let root=this.m_root.current;
		if (!root) return;
		let picture=this.Node('image');
		if (state.activeImage) {
			let url=`data:${state.activeImage.mimeType};base64,${state.activeImage.base64}`;
			if (picture.src!==url) picture.src=url;
			picture.hidden=false;
		}
		else picture.hidden=true;
		this.Node('empty').style.display=state.activeImage?'none':'block';
		this.Node('image-ratio').textContent=state.activeImage?.width&&state.activeImage?.height?`${state.activeImage.width} × ${state.activeImage.height}`:'';
		this.Node('generating').style.display=state.isGenerating?'flex':'none';
		this.m_owner.Localize();
		let sendButton=root.querySelector('[data-action="send"]');
		sendButton.textContent=state.isConsulting?this.m_owner.Text('stop'):this.m_owner.Text('send');
		let input=this.Node('input');
		if (input.value!==state.inputText) input.value=state.inputText;
		this.Node('pending').style.display=state.accumulatedChanges.length?'block':'none';
		this.Node('pending-count').textContent=`${this.m_owner.Text('confirmedChanges')} (${state.accumulatedChanges.length})`;
		this.Node('pending-list').textContent=state.accumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n');
		this.Node('pending-list').style.whiteSpace='pre-wrap';
		this.Node('pending-prompt').textContent=state.generationPrompt||'';
		for (let button of this.Node('ratios').querySelectorAll('[data-ratio]')) button.classList.toggle('ca-selected', button.dataset.ratio===state.selectedRatio);
		if (state.messages!==this.m_lastMessages||state.isConsulting!==this.m_lastConsulting) {
			let list=this.Node('message-list');
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
					copy.dataset.action='copy-message-prompt';
					copy.dataset.messageId=message.id;
					copy.textContent=this.m_owner.Text('copy');
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
			this.m_lastConsulting=state.isConsulting;
			(list.querySelector('.ca-thinking')||list.lastElementChild)?.scrollIntoView({block: 'nearest'});
		}
		if (state.history!==this.m_lastHistory) {
			let area=this.Node('history');
			area.replaceChildren(...state.history.map((image)=>{
				let button=document.createElement('button');
				button.dataset.version=image.id;
				button.title=image.title;
				let thumbnail=document.createElement('img');
				thumbnail.src=`data:${image.mimeType};base64,${image.base64}`;
				thumbnail.alt=image.title;
				button.appendChild(thumbnail);
				return button;
			}));
			this.m_lastHistory=state.history;
		}
		this.Node('history-count').textContent=state.history.length;
		for (let button of this.Node('history').children) button.classList.toggle('ca-selected', button.dataset.version===state.activeImage?.id);
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
			let handler=$this.m_handler;
			if (handler) {
				try { await handler(message, this, turn); }
				catch (error) {
					if ($this.m_handler===handler) $this.m_handler=null;
					throw error;
				}
			}
			else if ($this.m_messageListener) await $this.m_messageListener(message, turn);
			else throw new Error('Assistant is unavailable.');
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
		root?.removeEventListener('click', $this.m_click);
		root?.removeEventListener('input', $this.m_input);
		root?.removeEventListener('keydown', $this.m_key);
		$this.m_assistant?.Destroy();
		let runtime=this.GetRuntime();
		if (runtime.UI===this) delete runtime.UI;
		for (let name of this.Mounted()) this.Unmount(name);
		$this.m_listeners.clear();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: _(this).m_root, style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].m_root=null;
	_['private'].m_state=null;
	_['private'].m_assistant=null;
	_['private'].m_owner=null;
	_['private'].m_versions=null;
	_['private'].m_mounted=null;
	_['private'].m_listeners=null;
	_['private'].m_handler=null;
	_['private'].m_messageListener=null;
	_['private'].m_eventListener=null;
	_['private'].m_startup=null;
	_['private'].m_sources=null;
	_['private'].m_compiledSources=null;
	_['private'].m_compiledError=null;
	_['private'].m_installedSources=null;
	_['private'].m_images=null;
	_['private'].m_lastMessages=null;
	_['private'].m_lastConsulting=null;
	_['private'].m_lastHistory=null;
	_['private'].m_activeTurn=null;
	_['private'].m_locale=null;
	_['private'].m_click=null;
	_['private'].m_input=null;
	_['private'].m_key=null;
});
