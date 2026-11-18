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

				Flow.generate.text(`請保持以下字典的所有 key，將每個 value 翻譯為 ${locale} 語系，並只回傳可供 JSON.parse 直接解析的 JSON 物件文字。\n${JSON.stringify(DisplayText.Default.Entries)}`).then((result)=>{
					this.Entries=JSON.parse(result.text);
					resolve(this.Entries);
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
			let instance=DisplayText.Instances.find((value)=>value.Locale===locale);
			if (!instance) {
				instance=new DisplayText(locale);
				DisplayText.Instances.push(instance);
			}

			return instance;
		};

		DisplayText.GetText=function (locale, key) {
			return DisplayText.GetInstance(locale).Entries?.[key]??DisplayText.Default.Entries[key]??key;
		};

		DisplayText.Default=new DisplayText('en');
		DisplayText.Instances=[DisplayText.Default];
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
		let input=$this.m_view.Node('input').GetElement();
		let actions=[
			['send', ()=>$this.m_state.IsConsulting?$this.Stop():$this.Send()]
			, ['select', ()=>$this.SelectMedia()]
			, ['camera', ()=>$this.CaptureCamera()]
			, ['download', ()=>$this.Download()]
			, ['generate', ()=>$this.Generate()]
			, ['info', ()=>$this.m_view.Node('dialog').SetStyle('display', 'flex')]
			, ['close-info', ()=>$this.m_view.Node('dialog').SetStyle('display', 'none')]
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
			if (event.target===input) {
				$this.m_state.InputText=event.target.value;
			}
		};

		root.onkeydown=(event)=>{
			if (event.target===input&&'Enter'===event.key&&!event.shiftKey&&!event.isComposing) {
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
			$this.m_view.Node('app').SetStyle('visibility', 'visible');
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
		$this.m_view.Node('app').SetStyle('visibility', 'visible');
		let startup=await $this.m_modules.Initialize();
		if (startup instanceof Error) {
			$this.ReportError(startup);
			return;
		}

		if ($this.m_state.Messages.length) {
			return;
		}

		let reply=await $this.InvokeText(`你是否了解自己的能力？請簡短歡迎使用者。瀏覽器語系：${locale}。可用模組：${$this.m_modules.GetNames().join(', ')}。`, {systemInstruction: $this.Instruction()});
		if (reply instanceof Error) {
			$this.ReportError(reply);
		}
		else if (!$this.m_state.Messages.length) {
			$this.Reply(reply);
		}
	};

	_['private'].Instruction=function () {
		return `你是 CustomAgent App 內的 Assistant。只回傳 JavaScript async 函式本體，不要 Markdown 程式碼區塊或 JSON 包裝。程式必須依目前使用者對話的語言回傳純字串；若只需回答文字，直接回傳字串。
函式本體收到 modules 參數，可用成員如下：
- modules.Runtime：依名稱取得已安裝的類型；直接呼叫並 await 其靜態 Run 方法。
- modules.Context：實際的 {image, artifact} Media 物件實例；直接檢查類型與成員。
- await modules.Apply(result)：顯示模組產出的影像或影片，並加入媒體歷史。
- await modules.Install(name, Type)：安裝在本函式本體中定義的類型。類型可定義靜態 Dispose() 釋放監聽器、計時器等資源；以模組名稱掛載的 UI 會自動移除。若類型的資源在 rollback 後需要重新建立，也應定義靜態 Initialize()，並在首次安裝後呼叫。
- await modules.Rollback()：撤銷最近一次安裝。await modules.Uninstall(name)：移除模組及其已安裝的原碼。
- modules.Sources：使用 ReadCompiledSource({file})、ReadRemoteSource({name})、ReadInstalledSource({name}) 讀取原碼。
- modules.UI：目前的 App。使用 UpdateConversation({accumulatedChanges, generationPrompt, selectedRatio}) 記錄已確認的修改、ResetConversation() 清除對話，影片請求使用 GenerateVideo(options, modules.Context)。只有使用者按下 Generate 才會開始影像生成。
- modules.Executions：本次工作階段先前產生的程式及其實際執行結果。
所有非同步工作都要 await，包括透過 Promise.all 並行的工作。檢查 API 回傳的 Error。禁止使用 throw、switch、操作名稱或 JSON 操作計畫。使用 tab 縮排、C# 風格命名、每個 if 都加大括號，運算子左右不留空格。程式碼不使用中文，但要向使用者顯示的文字依對話語言撰寫。修復失敗程式時，不要再次執行已完成的操作。`;
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
		let prompt=`已安裝模組：\n${available||'(none)'}\n已編譯的原碼檔案：${JSON.stringify($this.m_modules.GetSources().CompiledNames())}\n目前影像：${JSON.stringify(image)}\n目前媒體類型：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 modules.Context.artifact 存取物件實例。\n選定比例：${state.SelectedRatio}\n已確認的修改：${JSON.stringify(state.AccumulatedChanges)}\n先前對話：\n${history}\n使用者目前的訊息：\n${message}`;
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
			prompt+=`\n前一次程式執行失敗，原碼如下：\n${previous?.Code||''}\n實際已完成的操作：${JSON.stringify(previous?.Changes||[])}\n錯誤：${reply.message}\n目前已安裝模組：${$this.m_modules.GetNames().join(', ')}\n目前媒體：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 modules.Context.artifact 存取物件實例。\n請撰寫修正後的程式，依照實際狀態繼續，不要重複已成功的副作用。`;
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
最近的對話：
${messages}
App 事件：${event}
實際結果：${JSON.stringify(details)}
根據 App 回報的結果，依使用者當前對話語言簡短回覆。
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
