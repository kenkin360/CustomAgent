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
			, selectedRatio: '16:9'
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
		$this.m_assistant=null;
		$this.m_images=new ImageService(Flow);
		$this.m_lastMessages=null;
		$this.m_lastHistory=null;
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

	_['public'].CaptureVersion=function () {
		let $this=_(this);
		return {Mounted: new Map($this.m_mounted), Listeners: new Set($this.m_listeners), Handler: $this.m_handler};
	};

	_['public'].RestoreVersion=function (version) {
		let $this=_(this);
		for (let name of this.Mounted()) this.Unmount(name);
		for (let [name, entry] of version.Mounted) this.Mount(name, entry.Element, entry.Slot);
		$this.m_listeners=new Set(version.Listeners);
		$this.m_handler=version.Handler;
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
		if (!['1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) throw new Error('Unsupported aspect ratio.');
		this.UpdateConversation({selectedRatio: value});
	};
	_['public'].SelectVersion=function (id) {
		let $this=_(this);
		let image=$this.m_state.history.find((item)=>item.id===id);
		if (!image) throw new Error('Image version not found: '+id);
		$this.SetValues({activeImage: image});
	};
	_['public'].SendMessage=function (text) { return this.Send(text); };
	_['public'].PickMedia=function () { return this.SelectMedia(); };
	_['public'].RollbackCode=function () { return this.Rollback(); };

	_['public'].RunAction=async function (action, track=true) {
		let $this=_(this);
		if (action.name!=='loadModule') await $this.m_startup;
		let image=$this.m_state.activeImage;
		let result=await $this.ExecuteAction(action, image, this.props.HostSourceUrl, track);
		if (result.image) $this.SetValues({activeImage: result.image, history: [result.image, ...$this.m_state.history]});
		return result;
	};

	_['public'].InspectRuntime=function (args={}) {
		return _(this).ExecuteAction({name: 'inspectRuntime', arguments: args}, _(this).m_state.activeImage, this.props.HostSourceUrl);
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

	_['private'].Capture=function () {
		let runtime=this.GetRuntime();
		let ui=this.m_owner;
		return {
			Runtime: Object.getOwnPropertyDescriptors(runtime)
			, Modules: Object.getOwnPropertyDescriptors(runtime.Modules)
			, ModulesTarget: runtime.Modules
			, UI: ui?.CaptureVersion()
			, UIProperties: ui?Object.getOwnPropertyDescriptors(ui):null
		};
	};

	_['private'].RestoreProperties=function (target, properties) {
		for (let key of Reflect.ownKeys(target)) {
			if (!Object.prototype.hasOwnProperty.call(properties, key)&&!Reflect.deleteProperty(target, key)) {
				throw new Error('Cannot restore non-configurable runtime member: '+String(key));
			}
		}
		Object.defineProperties(target, properties);
	};

	_['private'].Restore=function (snapshot) {
		let runtime=this.GetRuntime();
		this.RestoreProperties(runtime, snapshot.Runtime);
		this.RestoreProperties(snapshot.ModulesTarget, snapshot.Modules);
		runtime.UI=this.m_owner;
		if (snapshot.UIProperties) this.RestoreProperties(this.m_owner, snapshot.UIProperties);
		if (snapshot.UI) this.m_owner.RestoreVersion(snapshot.UI);
	};

	_['public'].HasVersion=function () {
		return _(this).m_versions.length>0;
	};

	_['public'].Rollback=function () {
		let $this=_(this);
		let snapshot=$this.m_versions.at(-1);
		if (!snapshot) throw new Error('No previous runtime code version is available.');
		$this.Restore(snapshot);
		$this.m_versions.pop();
		return `Restored the previous runtime code version. ${$this.m_versions.length} earlier versions remain.`;
	};

	_['public'].Initialize=function () {
		let $this=_(this);
		if (!$this.m_startup) {
			$this.m_startup=(async ()=>{
				await this.RunAction({name: 'loadModule', arguments: {name: 'DrawRectangle', specifier: Bundle.CustomAgent('DrawRectangle.js')}}, false);
				await this.RunAction({name: 'loadModule', arguments: {name: 'UpscaleCode', specifier: Bundle.CustomAgent('UpscaleCode.js')}}, false);
			})().catch((error)=>{
				$this.m_startup=null;
				throw error;
			});
		}
		return $this.m_startup;
	};

	_['private'].RegisterExtension=function (name, Type, track) {
		if (typeof Type!=='function'||!(Type.prototype instanceof Extensible)) throw new Error(name+' must extend Extensible.');
		let runtime=this.GetRuntime();
		let snapshot=this.Capture();
		let before={...runtime};
		try {
			let instance=new Type(runtime);
			runtime.Modules[name]=instance;
			let changed=this.GetNames().filter((key)=>runtime[key]!==before[key]);
			if (track) this.m_versions.push(snapshot);
			return {message: `${name} loaded. Registered functions: ${changed.join(', ')||'(none)'}. Reversible versions: ${this.m_versions.length}.`};
		}
		catch (error) {
			this.Restore(snapshot);
			throw error;
		}
	};

	_['private'].SourceFiles=function (url) {
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

	_['public'].ReadSource=async function (args, url) {
		url||=_(this).m_owner.props.HostSourceUrl;
		let files={};
		try { files=_(this).SourceFiles(url); }
		catch (error) { console.warn('Bundled host source unavailable:', error); }
		let remote=_(this).m_sources.map(([name, address])=>({name, address, file: address.split(/[?#]/)[0].split('/').pop()}));
		if (typeof args.file!=='string') {
			return {message: `Available bundled files: ${Object.keys(files).join(', ')||'(none)'}. Loaded remote files: ${remote.map((entry)=>entry.file).join(', ')||'(none)'}.`};
		}
		let source=files[args.file];
		if (source===undefined) {
			let entry=remote.find((item)=>item.file===args.file||item.name===args.file);
			if (!entry) throw new Error('Source file not found: '+args.file);
			let response=await fetch(entry.address);
			if (!response.ok) throw new Error(`Failed to read ${args.file}: HTTP ${response.status}`);
			source=await response.text();
		}
		let query=typeof args.query==='string'?args.query:'';
		let match=query?source.toLowerCase().indexOf(query.toLowerCase()):-1;
		if (query&&match<0) return {message: `${args.file}: no match for ${JSON.stringify(query)}.`};
		let limit=Number.isInteger(args.limit)?Math.max(1, Math.min(12000, args.limit)):8000;
		let offset=match>=0?Math.max(0, match-500):Number.isInteger(args.offset)?Math.max(0, Math.min(source.length, args.offset)):0;
		return {message: `${args.file} (${offset}-${Math.min(source.length,offset+limit)} of ${source.length} characters):\n${source.slice(offset,offset+limit)}`};
	};

	_['private'].ExecuteAction=async function (action, image, sourceUrl, track=true) {
		if (!action?.arguments||typeof action.arguments!=='object'||Array.isArray(action.arguments)) throw new Error('Action arguments must be an object.');
		let args=action.arguments;
		switch (action.name) {
			case 'readAppSource': return this.ReadSource(args, sourceUrl);
			case 'inspectRuntime': {
				let runtime=this.GetRuntime();
				if (typeof args.name==='string') {
					if (typeof runtime[args.name]!=='function') throw new Error('Runtime function not found: '+args.name);
					return {message: `${args.name}: ${runtime[args.name].Description||String(runtime[args.name]).slice(0,12000)}`};
				}
				return {message: `AppRuntime functions: ${this.GetNames().map((name)=>name+(runtime[name].Description?': '+runtime[name].Description:'')).join('; ')||'(none)'}. Loaded extensions: ${Object.keys(runtime.Modules).join(', ')||'(none)'}. UI slots: ${this.Slots.join(', ')||'(unavailable)'}. Mounted UI: ${this.Mounted().join(', ')||'(none)'}. Custom conversation: ${this.HasConversationHandler()||false}. Reversible versions: ${_(this).m_versions.length}. Built-in actions: readAppSource, inspectRuntime, loadModule, callRuntime, rollbackCode, resetConversation.`};
			}
			case 'loadModule': {
				if (typeof args.name!=='string'||!/^[A-Za-z_$][\w$]*$/.test(args.name)) throw new Error('Provide an extension class name.');
				let url=typeof args.code==='string'&&args.code.trim()
					?`data:text/javascript;charset=utf-8,${encodeURIComponent(args.code)}`
					:args.specifier;
				if (typeof url!=='string'||!url) throw new Error('Provide extension code or a script URL.');
				if (this.GetRuntime().Modules[args.name]&&!args.code) return {message: args.name+' is already loaded.'};
				let Type=await new Resource.Module(args.name, url);
				return this.RegisterExtension(args.name, Type, track);
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
				$this.Send();
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
			case 'send': $this.Send(); break;
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
		this.Node('thinking').hidden=!state.isConsulting;
		let input=this.Node('input');
		if (input.value!==state.inputText) input.value=state.inputText;
		this.Node('pending').style.display=state.accumulatedChanges.length?'block':'none';
		this.Node('pending-count').textContent=`已確認的改動項目 (${state.accumulatedChanges.length})`;
		this.Node('pending-list').textContent=state.accumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n');
		this.Node('pending-list').style.whiteSpace='pre-wrap';
		this.Node('pending-prompt').textContent=state.generationPrompt||'';
		for (let button of this.Node('ratios').querySelectorAll('[data-ratio]')) button.classList.toggle('ca-selected', button.dataset.ratio===state.selectedRatio);
		if (state.messages!==this.m_lastMessages) {
			let list=this.Node('message-list');
			list.replaceChildren(...state.messages.map((message)=>{
				let item=document.createElement('div');
				item.className=`ca-message ca-${message.sender}`;
				let time=document.createElement('small');
				time.textContent=(message.sender==='user'?'您':message.sender==='system'?'App':'AI 創意總監 (Agent)')+' · '+message.timestamp;
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
					prompt.textContent='整合提示詞草稿：'+message.suggestedPrompt;
					item.appendChild(prompt);
					let copy=document.createElement('button');
					copy.dataset.action='copy-message-prompt';
					copy.dataset.messageId=message.id;
					copy.textContent='複製';
					item.appendChild(copy);
				}
				return item;
			}));
			this.m_lastMessages=state.messages;
			this.Node('messages').scrollTop=this.Node('messages').scrollHeight;
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
		$this.AddMessage('user', message);
		$this.SetValues({inputText: '', isConsulting: true});
		try {
			let handler=$this.m_handler;
			if (handler) {
				try { await handler(message, this); }
				catch (error) {
					let recovery='';
					while ($this.m_versions.length&&$this.m_handler===handler) recovery=this.Rollback();
					if ($this.m_handler===handler) $this.m_handler=null;
					throw new Error(`${error.message||String(error)}. ${recovery}`);
				}
			}
			else if ($this.m_messageListener) await $this.m_messageListener(message);
			else throw new Error('Assistant is unavailable.');
		}
		catch (error) { await this.NotifyAssistant('Conversation failed', {Error: error.message||String(error)}); }
		finally { $this.SetValues({isConsulting: false}); }
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
	_['private'].m_images=null;
	_['private'].m_lastMessages=null;
	_['private'].m_lastHistory=null;
	_['private'].m_click=null;
	_['private'].m_input=null;
	_['private'].m_key=null;
});
