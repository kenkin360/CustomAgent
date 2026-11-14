var RuntimeActions=Function.extend(Object, function () {
	var _=this(RuntimeActions);
	RuntimeActions=_[RuntimeActions];

	function RuntimeActions(sources) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_versions=[];
		$this.m_ui=null;
		$this.m_installing=false;
		$this.m_startup=null;
		$this.m_sources=sources||[];
	}

	_['public'].GetRuntime=function () {
		let runtime=globalThis.AppRuntime||=Object.create(null);
		runtime.Modules||=Object.create(null);
		runtime.LoadModule||=(args)=>this.LoadModule(args);
		return runtime;
	};

	_['public'].AttachUI=function (ui) {
		let $this=_(this);
		$this.m_ui=ui;
		let runtime=this.GetRuntime();
		runtime.UI=ui;
		return ()=>{
			if (runtime.UI===ui) delete runtime.UI;
			if ($this.m_ui===ui) $this.m_ui=null;
		};
	};

	_['public'].GetNames=function () {
		return Object.keys(this.GetRuntime()).filter((name)=>typeof this.GetRuntime()[name]==='function');
	};

	_['private'].Capture=function () {
		let runtime=this.GetRuntime();
		let ui=this.m_ui;
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
		if (this.m_ui) {
			runtime.UI=this.m_ui;
			if (snapshot.UIProperties) this.RestoreProperties(this.m_ui, snapshot.UIProperties);
			if (snapshot.UI) this.m_ui.RestoreVersion(snapshot.UI);
		}
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

	_['public'].RecoverIfRequested=async function (text) {
		if (!this.HasVersion()) return null;
		if (/^\s*\/(?:rollback|undo)\s*$/i.test(text)) return this.Rollback();
		try {
			let response=await Flow.generate.text(text, {
				systemInstruction: 'Classify whether the user wants to undo a recent runtime code change or says the latest change is broken and should be undone. Answer exactly ROLLBACK or CONTINUE. Merely asking what an error means, requesting a new fix, or discussing old versions is CONTINUE. Interpret the message in any language.'
			});
			return /^ROLLBACK\b/i.test(response.text.trim())?this.Rollback():null;
		}
		catch (error) {
			console.warn('Recovery intent check failed:', error);
			return null;
		}
	};

	_['public'].InstallCode=async function (args, track=true) {
		if (typeof args?.code!=='string'||!args.code.trim()||args.code.length>50000) {
			throw new Error('Provide JavaScript module code of at most 50000 characters.');
		}
		let $this=_(this);
		if ($this.m_installing) throw new Error('Another runtime installation is in progress.');
		let runtime=this.GetRuntime();
		let snapshot=$this.Capture();
		let before={...runtime};
		$this.m_installing=true;
		try {
			let url=`data:text/javascript;charset=utf-8,${encodeURIComponent(args.code)}#${Date.now()}_${Math.random()}`;
			let module=await import(url);
			if (typeof module.default==='function') await module.default(runtime);
			let names=this.GetNames();
			let changed=names.filter((name)=>runtime[name]!==before[name]);
			if (track) $this.m_versions.push(snapshot);
			return {message: `Code loaded in the current App runtime. Registered functions: ${changed.join(', ')||'(none)'}. Available functions: ${names.join(', ')||'(none)'}. Mounted UI: ${$this.m_ui?.Mounted().join(', ')||'(none)'}. Custom conversation: ${$this.m_ui?.HasConversationHandler()||false}. Reversible versions: ${$this.m_versions.length}.`};
		}
		catch (error) {
			try { $this.Restore(snapshot); }
			catch (restoreError) { throw new Error(`Installation failed: ${String(error)}. Recovery failed: ${String(restoreError)}`); }
			throw error;
		}
		finally {
			$this.m_installing=false;
		}
	};

	_['public'].Initialize=function () {
		let $this=_(this);
		if (!$this.m_startup) {
			$this.m_startup=this.InstallCode({code: UPSCALE_INSTALL_CODE}, false).catch((error)=>{
				$this.m_startup=null;
				throw error;
			});
		}
		return $this.m_startup;
	};

	_['public'].LoadModule=async function (args) {
		if (typeof args?.specifier!=='string'||typeof args?.name!=='string'||!/^[A-Za-z_$][\w$]*$/.test(args.name)) {
			throw new Error('Provide an esm.sh specifier and a module name.');
		}
		let url=new URL(args.specifier.startsWith('https://')?args.specifier:`https://esm.sh/${args.specifier.replace(/^\/+/, '')}`);
		if (url.origin!=='https://esm.sh') throw new Error('Only esm.sh module URLs are supported.');
		let modules=this.GetRuntime().Modules;
		if (modules[args.name]) return {message: `${args.name} is already loaded from esm.sh.`};
		if (url.searchParams.has('raw')) {
			let timeout=Number.isFinite(args.timeoutMs)?Math.max(1000, Math.min(60000, args.timeoutMs)):30000;
			await new Promise((resolve, reject)=>{
				let script=document.createElement('script');
				let timer=setTimeout(()=>{script.remove();reject(new Error('Timed out loading '+url.href));}, timeout);
				script.onload=()=>{clearTimeout(timer);resolve();};
				script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Failed to load '+url.href));};
				script.src=url.href;
				(document.head||document.body||document.documentElement).appendChild(script);
			});
			let value=args.globalName?globalThis[args.globalName]:true;
			if (args.globalName) {
				let deadline=Date.now()+timeout;
				while (Date.now()<deadline) {
					value=globalThis[args.globalName];
					if (value&&typeof value.then==='function') value=await value;
					if (value&&(!args.readyMember||value[args.readyMember])) break;
					await new Promise((resolve)=>setTimeout(resolve, 50));
				}
				if (!value||args.readyMember&&!value[args.readyMember]) throw new Error('Timed out waiting for '+args.globalName);
			}
			modules[args.name]=value;
			return {message: `${args.name} loaded as a raw script from ${url.href}.`};
		}
		let value=await import(url.href);
		modules[args.name]=value;
		return {message: `${args.name} loaded as an ES module from ${url.href}; exports: ${Object.keys(value).slice(0, 40).join(', ')||'(none)'}.`};
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

	_['public'].Execute=async function (action, image, sourceUrl) {
		if (!action?.arguments||typeof action.arguments!=='object'||Array.isArray(action.arguments)) throw new Error('Action arguments must be an object.');
		let args=action.arguments;
		switch (action.name) {
			case 'drawRectangle':
				return {message: 'Rectangle drawn on the current image.', image: await DrawingActions.Execute(action, image)};
			case 'readAppSource': return this.ReadSource(args, sourceUrl);
			case 'inspectRuntime': {
				let runtime=this.GetRuntime();
				if (typeof args.name==='string') {
					if (typeof runtime[args.name]!=='function') throw new Error('Runtime function not found: '+args.name);
					return {message: `${args.name}: ${String(runtime[args.name]).slice(0,12000)}`};
				}
				return {message: `AppRuntime functions: ${this.GetNames().join(', ')||'(none)'}. Loaded modules: ${Object.keys(runtime.Modules).join(', ')||'(none)'}. UI slots: ${_(this).m_ui?.Slots.join(', ')||'(unavailable)'}. Mounted UI: ${_(this).m_ui?.Mounted().join(', ')||'(none)'}. Custom conversation: ${_(this).m_ui?.HasConversationHandler()||false}. Reversible versions: ${_(this).m_versions.length}. Built-in actions: drawRectangle, readAppSource, inspectRuntime, installCode, loadModule, callRuntime, rollbackCode, resetConversation.`};
			}
			case 'installCode': return this.InstallCode(args);
			case 'loadModule': return this.LoadModule(args);
			case 'callRuntime': {
				let fn=this.GetRuntime()[args.name];
				if (typeof fn!=='function') throw new Error('Runtime function not found: '+String(args.name));
				let value=await fn(args.arguments??{}, {image});
				let output=value&&typeof value==='object'&&'image' in value?value.image:value;
				if (output&&typeof output.base64==='string'&&/^image\/(png|jpeg|webp)$/.test(output.mimeType)) {
					return {message: typeof value.message==='string'?value.message:`${args.name} updated the current image.`, image: {
						...image, id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
						, base64: output.base64, mimeType: output.mimeType, mediaId: undefined
						, prompt: `Local runtime edit: ${args.name}`
						, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
						, aspectRatio: image?.aspectRatio||'1:1'
						, title: output.title||`${image?.title||'Image'} · ${args.name}`
					}};
				}
				return {message: `${args.name}: ${(typeof value==='string'?value:JSON.stringify(value)??'completed').slice(0,12000)}`};
			}
			case 'rollbackCode': return {message: this.Rollback()};
			case 'resetConversation':
				if (!_(this).m_ui) throw new Error('App UI is unavailable.');
				_(this).m_ui.ResetConversation();
				return {message: 'Conversation cleared.', conversationReset: true};
			default: throw new Error('Unsupported local action: '+action.name);
		}
	};

	_['private'].m_versions=null;
	_['private'].m_ui=null;
	_['private'].m_installing=false;
	_['private'].m_startup=null;
	_['private'].m_sources=null;
});
