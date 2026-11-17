var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_view=new View();
		$this.m_state=new AgentState();
		$this.m_listeners=new Set();
		$this.m_activeTurn=null;
		$this.m_ready=null;
		$this.m_modules=new Modules(new Sources(props.SourceFiles, props.HostSourceUrl));
		$this.m_executions=[];
		$this.m_errorEvents=null;
	}
	
	var DisplayText=Function.extend(Promise, function () {
		var _=this(DisplayText);
		DisplayText=_[DisplayText];

		function DisplayText(locale) {
			if ('function'===typeof locale) {
				_['base'].call(this, locale);
				return;
			}

			let resolve;
			_['base'].call(this, (done)=>{
				resolve=done;
			})(function () {
				this.Locale=locale;
				this.Entries=DisplayText.Default?.Entries||this.Entries;
				if ('en'===locale) {
					resolve(this.Entries);
					return;
				}

				Flow.generate.text(`Translate every value into the ${locale} locale. Preserve all keys. Return only a JSON object that JSON.parse can read directly.\n${JSON.stringify(DisplayText.Default.Entries)}`).then((result)=>{
					let entries=JSON.parse(result.text);
					if (!entries||Object.keys(DisplayText.Default.Entries).some((key)=>'string'!==typeof entries[key])) {
						Helper.Error('The translated text is incomplete.');
						resolve(this.Entries);
						return;
					}

					this.Entries=entries;
					resolve(entries);
				}).catch((error)=>{
					Helper.Error(error);
					resolve(this.Entries);
				});
			});
		}

		_['public'].Entries={
			tagline: 'Describe an edit to use local tools, or generate an image'
			, help: 'Help'
			, target: 'Target Media'
			, download: 'Download'
			, empty: 'No media selected. Load an image or describe an idea in chat.'
			, media: '＋ Media'
			, camera: 'Camera'
			, generating: 'Generating image…'
			, history: 'Media versions'
			, copyPrompt: 'Copy prompt'
			, generate: 'Generate image from confirmed changes'
			, ratio: 'Output ratio'
			, original: 'Original'
			, input: 'Discuss an idea, draw a rectangle, inspect code, or create a local tool…'
			, send: 'Send'
			, stop: 'Stop'
			, about: "Discuss image changes or ask for local operations. Only the Generate button creates a new image. You can also inspect and extend this session's code."
			, close: 'Close'
			, confirmedChanges: 'Confirmed changes'
			, you: 'You'
			, agent: 'Assistant'
			, promptDraft: 'Combined prompt draft: '
			, copy: 'Copy'
			, thinking: 'Thinking and running local operations…'
		};
		
		_['public'].Locale=null;

		DisplayText.GetInstance=function (locale) {
			let instance=DisplayText.Instances.get(locale);
			if (!instance) {
				instance=new DisplayText(locale);
				DisplayText.Instances.set(locale, instance);
			}

			return instance;
		};

		DisplayText.GetText=function (locale, key) {
			return (DisplayText.GetInstance(locale).Entries||DisplayText.Default.Entries)[key]||key;
		};

		DisplayText.Default=new DisplayText('en');
		DisplayText.Instances=new Map([['en', DisplayText.Default]]);
	});

	_['private'].SetValues=function (patch) {
		this.m_state.Apply(patch);
		this.Update();
		this.Notify();
	};

	_['private'].AddMessage=function (sender, text, fields={}) {
		let $this=_(this);
		$this.SetValues({messages: [...$this.m_state.Messages, new Message({
			id: `${sender}_${Date.now()}_${Math.random()}`
			, sender
			, text
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, ...fields
		})]});
	};

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];

	_['private'].Update=function () {
		let locale=this.m_view.GetLocale();
		this.m_view.Update(this.m_state, (key)=>DisplayText.GetText(locale, key), (id)=>this.SelectVersion(id));
	};

	_['public'].GetState=function () {
		return _(this).m_state;
	};

	_['public'].GetImageInfo=async function () {
		let $this=_(this);
		let image=$this.m_state.ActiveMedia;
		if (!(image instanceof Media.Image)) { return null; }

		let dimensions=await new ImageService().GetDimensions(image);
		if (dimensions instanceof Error) { return dimensions; }

		return {...dimensions, mimeType: image.MimeType, title: image.Title};
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

	_['public'].Mount=function (name, element, slot='header') { _(this).m_view.Mount(name, element, slot, this.Slots); };

	_['public'].Unmount=function (name) { _(this).m_view.Unmount(name); };

	_['public'].Mounted=function () { return _(this).m_view.Mounted(); };

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
		if ($this.m_state.IsGenerating) { return Helper.Error('Wait for image generation to finish before resetting the conversation.'); }

		$this.SetValues({messages: [], accumulatedChanges: [], generationPrompt: '', inputText: ''});
	};

	_['public'].SetInput=function (value) { this.UpdateConversation({inputText: value}); };

	_['public'].SetRatio=function (value) {
		if (!['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) { return Helper.Error('Unsupported aspect ratio.'); }

		this.UpdateConversation({selectedRatio: value});
	};

	_['public'].SelectVersion=function (id) {
		let $this=_(this);
		let media=$this.m_state.History.find((item)=>item.Id===id);
		if (!media) { return Helper.Error('Media version not found: '+id); }

		$this.SetValues({activeMedia: media, currentMedia: media});
	};

	_['public'].Stop=function () {
		let $this=_(this);
		if (!$this.m_activeTurn) {
			return;
		}

		$this.m_activeTurn.abort();
		$this.m_activeTurn=null;
		$this.SetValues({isConsulting: false});
	};

	_['public'].GenerateVideo=async function (args={}, context={}) {
		let image=context.image;
		if ((args.useCurrentImageAsFirstFrame||args.useCurrentImageAsReference)&&!image) { return Helper.Error('No current image is available.'); }

		if (args.useCurrentImageAsFirstFrame&&args.firstFrameImageMediaId) { return Helper.Error('Choose one first-frame image.'); }

		let references=args.referenceImageMediaIds||[];
		if (!Array.isArray(references)) { return Helper.Error('Reference image media IDs must be an array.'); }

		let artifact=await new VideoService().Generate({
			prompt: args.prompt
			, aspectRatio: args.aspectRatio
			, durationSeconds: args.durationSeconds
			, resolution: args.resolution
			, firstFrameImage: args.useCurrentImageAsFirstFrame?image:args.firstFrameImageMediaId
			, referenceImages: args.useCurrentImageAsReference?[image, ...references]:references
			, sourceVideoMediaId: args.sourceVideoMediaId
		});

		if (artifact instanceof Error) {
			return artifact;
		}

		return {message: `Video generated and saved to Flow Assets (${artifact.MediaId}).`, artifact};
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
		$this.m_modules.GetRuntime().UI=this;
		let root=$this.m_view.GetRoot();
		let actions=[
			['send', ()=>$this.m_state.IsConsulting?$this.Stop():$this.Send()]
			, ['select', ()=>$this.SelectMedia()]
			, ['camera', ()=>$this.CaptureCamera()]
			, ['download', ()=>$this.Download()]
			, ['generate', ()=>$this.Generate()]
			, ['info', ()=>new HtmlNode($this.m_view.Node('dialog')).SetStyle('display', 'flex')]
			, ['close-info', ()=>new HtmlNode($this.m_view.Node('dialog')).SetStyle('display', 'none')]
			, ['copy-prompt', async ()=>{
				try {
					await navigator.clipboard.writeText($this.m_state.GenerationPrompt||'');
				}
				catch (error) {
					$this.ReportError(error);
				}
			}]
		];
		for (let [name, callback] of actions) {
			for (let button of root.querySelectorAll(`[data-action="${name}"]`)) {
				button.onclick=callback;
			}
		}

		for (let button of root.querySelectorAll('[data-ratio]')) {
			button.onclick=()=>$this.SetRatio(button.dataset.ratio);
		}

		root.oninput=(event)=>{
			if (event.target===$this.m_view.Node('input')) {
				$this.m_state.InputText=event.target.value;
			}
		};

		root.onkeydown=(event)=>{
			if (event.target===$this.m_view.Node('input')&&'Enter'===event.key&&!event.shiftKey&&!event.isComposing) {
				event.preventDefault();
				if (!$this.m_state.IsConsulting) {
					$this.Send();
				}
			}
		};

		if ('function'===typeof globalThis.addEventListener) {
			$this.m_errorEvents=new AbortController();
			let capture=(event, error)=>{
				let stack=String(error?.stack||event.filename||'');
				if (!stack.includes('CustomAgentGenerated.js')) {
					return;
				}

				event.preventDefault();
				$this.ReportError(error||new Error(event.message||'Generated code failed.'));
			};

			globalThis.addEventListener('error', (event)=>capture(event, event.error), {signal: $this.m_errorEvents.signal});
			globalThis.addEventListener('unhandledrejection', (event)=>capture(event, event.reason), {signal: $this.m_errorEvents.signal});
		}

		$this.m_ready=$this.Welcome().catch((error)=>{
			$this.m_view.Node('app').style.visibility='visible';
			$this.ReportError(error);
		});
	};
	
	_['public'].Send=async function (text) {
		let $this=_(this);
		let message=String(text??$this.m_state.InputText).trim();
		if (!message||$this.m_state.IsConsulting) {
			return;
		}

		let turn=new AbortController();
		$this.m_activeTurn=turn;
		$this.AddMessage('user', message);
		$this.SetValues({inputText: '', isConsulting: true});
		try {
			await $this.HandleMessage(message, turn);
		}
		catch (error) {
			if (!turn.signal.aborted) {
				await this.NotifyAssistant('Conversation failed', {Error: error.message||String(error)});
			}
		}
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
			let image=await new ImageService().Select();
			if (image instanceof Error) { $this.ReportError(image); return; }

			if (!image) {
				return;
			}

			$this.SetValues({activeMedia: image, currentMedia: image, history: [image, ...$this.m_state.History]});
			await this.NotifyAssistant('Media selected', {Title: image.Title, Width: image.Width, Height: image.Height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].CaptureCamera=async function () {
		let $this=_(this);
		try {
			let image=await new ImageService().Capture();
			if (image instanceof Error) { $this.ReportError(image); return; }

			if (!image) {
				return;
			}

			$this.SetValues({activeMedia: image, currentMedia: image, history: [image, ...$this.m_state.History]});
			await this.NotifyAssistant('Camera image captured', {Title: image.Title, Width: image.Width, Height: image.Height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].Generate=async function (prompt) {
		let $this=_(this);
		let state=$this.m_state;
		let text=String(prompt||state.GenerationPrompt).trim();
		if (!text||state.IsGenerating) {
			return;
		}

		$this.SetValues({isGenerating: true});
		try {
			let image=await new ImageService().Generate(text, state.ActiveMedia instanceof Media.Image?state.ActiveMedia:null, state.SelectedRatio, state.History.length+1);
			if (image instanceof Error) { $this.ReportError(image); return; }

			$this.SetValues({activeMedia: image, currentMedia: image, history: [image, ...state.History]});
			await this.NotifyAssistant('Image generation completed', {Title: image.Title, Prompt: text, Width: image.Width, Height: image.Height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
		finally { $this.SetValues({isGenerating: false}); }
	};

	_['public'].Download=async function () {
		let $this=_(this);
		try {
			let media=$this.m_state.ActiveMedia;
			if (media instanceof Media.Video) {
				await new VideoService().Download(media);
			}
			else if (media instanceof Media.Image) {
				await new ImageService().Download(media);
			}
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].componentWillUnmount=function () {
		let $this=_(this);
		this.Stop();
		$this.m_errorEvents?.abort();
		let root=$this.m_view.GetRoot();
		if (root) {
			root.oninput=root.onkeydown=null;
		}

		let runtime=$this.m_modules.GetRuntime();
		if (runtime.UI===this) {
			delete runtime.UI;
		}

		for (let name of this.Mounted()) this.Unmount(name);
		$this.m_view.Dispose();
		$this.m_listeners.clear();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: (element)=>_(this).m_view.SetRoot(element), style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let locale=$this.m_view.GetLocale();
		await DisplayText.GetInstance(locale);
		$this.Update();
		$this.m_view.Node('app').style.visibility='visible';
		let startup=await $this.m_modules.Initialize();
		if (startup instanceof Error) {
			$this.ReportError(startup);
			return;
		}

		if ($this.m_state.Messages.length) {
			return;
		}

		let reply=await $this.InvokeText(`Welcome the user briefly. Browser locale: ${locale}. Available modules: ${$this.m_modules.GetNames().join(', ')}.`, {systemInstruction: $this.Instruction()});
		if (reply instanceof Error) {
			$this.ReportError(reply);
		}
		else if (!$this.m_state.Messages.length) {
			$this.Reply(reply);
		}
	};

	_['private'].Instruction=function () {
		return `You are the assistant inside CustomAgent. Return only a JavaScript async function body, without Markdown fences or JSON packaging. Your code must return a plain string in the language of the current user conversation. For a text-only answer, return a string directly.
The body receives "modules". Available members:
- modules.Runtime: installed classes by name. Call their static Run methods directly and await them.
- modules.Context: the actual {image, artifact} Media instances. Inspect their types and members directly.
- await modules.Apply(result): display an image or video produced by a module and add it to media history.
- await modules.Install(name, Type): install a class defined in this function body. A class may define static Dispose() to release listeners, timers, and other resources. UI mounted under its module name is removed automatically. Classes with resources that must be restored after rollback should also define static Initialize(); call it after the initial installation.
- await modules.Rollback(): undo the latest installation. await modules.Uninstall(name): remove a module and its installed source.
- modules.Sources: read source files with ReadCompiledSource({file}), ReadRemoteSource({name}), and ReadInstalledSource({name}).
- modules.UI: the current agent. Use UpdateConversation({accumulatedChanges, generationPrompt, selectedRatio}) for confirmed edits, ResetConversation() to clear conversation, and GenerateVideo(options, modules.Context) for video requests. Image generation only starts when the user presses Generate.
- modules.Executions: previous generated programs and their actual results for this session.
Await all asynchronous work, including concurrent work through Promise.all. Check Error return values from APIs. Never use throw, switch, action names, or JSON action plans. Use tabs, C# style names, braces for every if, and no spaces around operators. Avoid Chinese in code except text intended for the user's conversation. Do not run an already completed operation again when repairing a failed program.`;
	};

	_['private'].ApplyResult=async function (result) {
		if (result instanceof Error) {
			return result;
		}

		let value=result?.artifact||result?.image||result;
		if (!(value instanceof Media)&&!value?.mimeType&&!value?.MimeType) {
			return result;
		}

		if (!(value instanceof Media)&&!value.data&&!value.base64&&value.mediaId) {
			try {
				value={...value, ...await Flow.media.getBase64({mediaId: value.mediaId})};
			}
			catch (error) {
				return Helper.Error(error);
			}
		}

		let media=Media.From(value);
		if (media instanceof Error) {
			return media;
		}

		if (!media.Data) {
			return Helper.Error('Media content is unavailable.');
		}

		if (media instanceof Media.Image||media instanceof Media.Video) {
			this.SetValues({activeMedia: media, currentMedia: media, history: [media, ...this.m_state.History]});
		}
		else {
			this.SetValues({currentMedia: media});
		}

		return result;
	};

	_['private'].InvokeText=async function (prompt, options, turn) {
		let $this=_(this);
		let response;
		try {
			response=await Flow.generate.text(prompt, options);
		}
		catch (error) {
			return Helper.Error(error);
		}

		if (turn?.signal.aborted) {
			return null;
		}

		let code=response?.text;
		let execution={Code: code, Reply: null, Error: null, Changes: []};
		$this.m_executions.push(execution);
		let pending=[];
		let track=(operation, description)=>{
			let task=Promise.resolve(operation).then((value)=>{
				execution.Changes.push({Operation: description, Result: value instanceof Error?value.message:'completed'});
				return value;
			}, (error)=>{
				let failure=Helper.Error(error);
				execution.Changes.push({Operation: description, Result: failure.message});
				return failure;
			});

			pending.push(task);
			return task;
		};

		let image=$this.m_state.ActiveMedia instanceof Media.Image?$this.m_state.ActiveMedia:null;
		let modules={
			Runtime: $this.m_modules.GetRuntime().Modules
			, Context: {image, artifact: $this.m_state.CurrentMedia}
			, Sources: $this.m_modules.GetSources()
			, Executions: $this.m_executions
			, UI: $this.m_modules.GetRuntime().UI
			, Install: (name, Type)=>track($this.m_modules.Install(name, Type, code), `Install ${name}`)
			, Rollback: ()=>track($this.m_modules.Rollback(), 'Rollback')
			, Uninstall: (name)=>track($this.m_modules.Uninstall(name), `Uninstall ${name}`)
			, Apply: (value)=>track($this.ApplyResult(value), 'Apply media')
		};

		try {
			let AsyncFunction=(async function () {}).constructor;
			let Run=new AsyncFunction('modules', code+'\n//# sourceURL=CustomAgentGenerated.js');
			execution.Reply=await Run(modules);
		}
		catch (error) {
			execution.Error=error instanceof Error?error:Helper.Error(error);
		}

		let results=await Promise.all(pending);
		execution.Error||=results.find((value)=>value instanceof Error)||null;
		if (execution.Reply instanceof Error) {
			execution.Error||=execution.Reply;
		}

		if (!execution.Error&&'string'!==typeof execution.Reply) {
			execution.Error=Helper.Error('Generated code must return a string.');
		}

		return execution.Error||execution.Reply;
	};

	_['private'].HandleMessage=async function (message, turn) {
		let $this=_(this);
		await $this.m_ready;
		if (turn.signal.aborted) {
			return;
		}

		let state=$this.GetState();
		let history=state.Messages.slice(-20).map((entry)=>`${entry.Sender}: ${entry.Text}`).join('\n\n');
		let image=await $this.GetImageInfo();
		if (image instanceof Error) { $this.ReportError(image); return; }

		let available=Object.entries($this.m_modules.GetRuntime().Modules).map(([name, Type])=>`${name}: ${Type.Run?.Description||'no description'}`).join('\n');
		let media=$this.m_state.CurrentMedia;
		let prompt=`Installed modules:\n${available||'(none)'}\nCompiled source files: ${JSON.stringify($this.m_modules.GetSources().CompiledNames())}\nCurrent image: ${JSON.stringify(image)}\nCurrent media type: ${media?.constructor.name||'none'}; fields: ${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}. Access the instance through modules.Context.artifact.\nSelected ratio: ${state.SelectedRatio}\nConfirmed changes: ${JSON.stringify(state.AccumulatedChanges)}\nPrevious conversation:\n${history}\nCurrent user message:\n${message}`;
		let options={systemInstruction: $this.Instruction()};
		if (image) {
			let current=$this.m_state.ActiveMedia;
			options.images=[{base64: await current.ToBase64(), mimeType: current.MimeType}];
		}

		for (let attempt=0; attempt<3; attempt++) {
			let reply=await $this.InvokeText(prompt, options, turn);
			if (turn.signal.aborted) {
				return;
			}

			if (!(reply instanceof Error)) {
				$this.Reply(reply, {includedMedia: $this.m_state.CurrentMedia});
				return;
			}

			let previous=$this.m_executions.at(-1);
			media=$this.m_state.CurrentMedia;
			prompt+=`\nThe previous program failed. Its source was:\n${previous?.Code||''}\nActual completed operations: ${JSON.stringify(previous?.Changes||[])}\nError: ${reply.message}\nInstalled modules now: ${$this.m_modules.GetNames().join(', ')}\nCurrent media now: ${media?.constructor.name||'none'}; fields: ${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}. Access the instance through modules.Context.artifact.\nWrite a corrected program. Continue from actual state; do not repeat successful side effects.`;
			if (attempt===2) {
				$this.ReportError(reply);
			}
		}
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_ready;

		let messages=this.GetState().Messages.slice(-8)
			.map((entry)=>`${entry.Sender}: ${entry.Text}`)
			.join('\n');

		let prompt=`
Recent conversation:
${messages}
App event: ${event}
Actual result: ${JSON.stringify(details)}
Reply briefly to the user in the language of the current conversation.
`;
		let reply=await _(this).InvokeText(prompt, {systemInstruction: _(this).Instruction()});
		if (reply instanceof Error) {
			this.ReportError(reply);
			return;
		}

		this.Reply(reply, image?{includedMedia: image}:{});
	};

	_['private'].m_state=null;
	_['private'].m_listeners=null;
	_['private'].m_activeTurn=null;
	_['private'].m_ready=null;
	_['private'].m_view=null;
	_['private'].m_modules=null;
	_['private'].m_executions=null;
	_['private'].m_errorEvents=null;
});
