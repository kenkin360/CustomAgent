var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_view=new View();
		$this.m_state=new MediaSession();
		$this.m_listeners=new Set();
		$this.m_activeTurn=null;
		$this.m_ready=null;
		$this.m_errorEvents=null;
	}
	
	_['private'].SetValues=function (patch) {
		this.m_state.Update(patch);
		this.Update();
		this.Notify();
	};

	_['private'].AddMessage=function (sender, text, fields={}) {
		let $this=_(this);
		$this.SetValues({messages: [...$this.m_state.Messages, {
			Id: `${sender}_${Date.now()}_${Math.random()}`
			, Sender: sender
			, Text: text
			, Timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, ...fields
		}]});
	};

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];

	_['private'].Update=function () {
		let locale=this.m_view.GetLocale();
		this.m_view.Update(this.m_state, (key)=>DisplayText.GetText(locale, key), (id)=>this.SelectVersion(id));
	};

	_['public'].GetState=function () {
		return _(this).m_state;
	};

	_['public'].ReadCompiledSource=function (args={}) {
		let prefix='data:text/javascript;base64,';
		let url=this.props.HostSourceUrl;
		if (!url?.startsWith(prefix)) {
			return Helper.Error('The bundled source is unavailable from import.meta.url.');
		}

		try {
			let bytes=Uint8Array.from(atob(url.slice(prefix.length)), (char)=>char.charCodeAt(0));
			let code=new TextDecoder().decode(bytes);
			let markers=[...code.matchAll(/^\/\/ virtual:([^\r\n]+)\r?\n/gm)];
			let files=[];
			markers.forEach((marker, index)=>{
				let start=marker.index+marker[0].length;
				let end=index+1<markers.length?markers[index+1].index:code.length;
				let name=marker[1].trim();
				let value=code.slice(start, end).replace(/^\/\/ virtual-export:default [^\r\n]+\r?\n/, '');
				let file=files.find((entry)=>entry.Name===name);
				if (file) {
					file.Value+=value;
				}
				else {
					files.push({Name: name, Value: value});
				}
			});
			if (!markers.length) {
				files.push({Name: 'bundle', Value: code});
			}
			if ('string'!==typeof args.file) {
				return {message: `Compiled source files: ${JSON.stringify(files.map((file)=>file.Name))}`};
			}

			let file=files.find((entry)=>entry.Name===args.file);
			if (!file) {
				return Helper.Error('Compiled source file not found: '+args.file);
			}

			return {message: `${file.Name}:\n${file.Value}`};
		}
		catch (error) {
			return Helper.Error(error);
		}
	};

	_['public'].ReadRemoteSource=function (args={}) {
		if ('string'!==typeof args.name) {
			return {message: `Remote source entries: ${JSON.stringify(Source.Instances.map((entry)=>({name: entry.Name, url: entry.Value, readyMember: entry.ReadyMember})))}`};
		}

		let source=Source.GetInstance(args.name);
		if (!source) {
			return Helper.Error('Remote source not found: '+args.name);
		}

		return source.Read();
	};

	_['public'].ReadInstalledSource=function (args={}) {
		if ('string'!==typeof args.name) {
			return {message: `Installed modules: ${JSON.stringify(Executable.GetNames())}`};
		}

		let instance=Executable.GetInstance(args.name);
		if (!instance) {
			return Helper.Error('Installed module not found: '+args.name);
		}

		return instance.Source.Read();
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
		let media=$this.m_state.Select(id);
		if (media instanceof Error) {
			return media;
		}

		$this.SetValues({});
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
		let artifact=await new VideoService().Generate(args, context);

		if (artifact instanceof Error) {
			return artifact;
		}

		return {message: `Video generated and saved to Flow Assets (${artifact.MediaId}).`, artifact};
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
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

			$this.SetValues({media: image});
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

			$this.SetValues({media: image});
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

			$this.SetValues({media: image});
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

		$this.m_view.Dispose();
		$this.m_listeners.clear();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: (element)=>_(this).m_view.SetRoot(element), style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		await DisplayText.GetInstance(locale);
		$this.Update();
		$this.m_view.Node('app').SetStyle('visibility', 'visible');
		for (let [name, url, readyMember] of this.props.SourceFiles||[]) {
			Source.GetInstance(name, url, readyMember);
		}

		for (let [name, path] of [['DrawRectangle', 'Executables/DrawRectangle.js'], ['Upscale', 'Executables/Upscale.js']]) {
			let source=Source.GetInstance(name, Bundle.CustomAgent(path));
			if (!Executable.GetInstance(name)) {
				let loaded=await Executable.Load(source, this);
				if (loaded instanceof Error) {
					$this.ReportError(loaded);
					return;
				}
			}
		}

		if ($this.m_state.Messages.length) {
			return;
		}

		let reply=await $this.InvokeText('.', {systemInstruction: $this.Instruction()});

		if (reply instanceof Error) {
			$this.ReportError(reply);
		}
		else if (!$this.m_state.Messages.length) {
			$this.Reply(reply);
		}
	};

	'@@DeveloperWarn("禁止催眠式及 negative prompt")'
	_['private'].Instruction=function () {
		return `
輸出可直接作為 JavaScript AsyncFunction 函式本體執行的原始碼。
函式必須回傳依目前使用者對話語言撰寫的字串；單純回答文字時，直接回傳字串。
函式本體收到 Executable、app、context、apply、source 參數，可用成員如下：
- Executable.GetInstance(name)：取得已安裝的 Executable 實例，直接呼叫並 await 其 Run 方法。
- context：實際的 {image, artifact} Media 物件實例；直接檢查類型與成員。
- await apply(result)：顯示執行結果中的影像或影片，並加入媒體歷史。
- Source.GetInstance(name)：取得 CustomAgent 提供的遠端來源。可用來源先以 app.ReadRemoteSource() 查詢；清單包含一般應用程式碼，只有定義 Executable 衍生類型的來源能以 Executable.Load 載入。
- await Executable.Load(Source.GetInstance(name), app)：執行期載入來源檔案中以 Function.extend(Executable, factory) 定義的類型，並安裝實例。需要使用尚未安裝的工具時，先查詢來源，再呼叫此方法。例如：let loaded=await Executable.Load(Source.GetInstance('Upscale'), app); if (loaded instanceof Error) { return loaded; } return 'Loaded';。內建工具啟動時也使用此方法。
- await Executable.Install(name, executableClass, source, app)：安裝在本函式本體中以 Function.extend(Executable, factory) 定義的類型。類型的 constructor 須呼叫基底 constructor；實例可定義 Dispose() 釋放監聽器、計時器等資源；以名稱掛載的畫面會自動移除。若 rollback 後需要重新建立資源，也應定義 Initialize()。
- await Executable.Rollback(app)：撤銷最近一次安裝。await Executable.Uninstall(name, app)：移除執行類型及其已安裝的原碼。
- app.ReadCompiledSource({file})、app.ReadRemoteSource({name})、app.ReadInstalledSource({name})：查詢及讀取原碼。
- app：目前的 CustomAgent 實例。使用 UpdateConversation({accumulatedChanges, generationPrompt, selectedRatio}) 記錄已確認的修改、ResetConversation() 清除對話，影片請求使用 GenerateVideo(options, context)。只有使用者按下 Generate 才會開始影像生成。
- Executable.Executions：本次工作階段先前產生的程式及其實際執行結果。
所有非同步工作都要 await，包括透過 Promise.all 並行的工作。檢查 API 回傳的 Error，並以 Helper.Error(error) 回傳錯誤。流程分派使用實際類型與方法呼叫。使用 tab 縮排、C# 風格命名、每個 if 都加大括號，運算子左右不留空格。程式識別字與註解使用英文；向使用者顯示的文字依對話語言撰寫。修復失敗程式時，根據已完成的操作接續執行剩餘部分。

--
瀏覽器語系：
${_(this).m_view.GetLocale()}
可用模組：
${Executable.GetNames().join('\r\n')}
`;
	};

	_['private'].ApplyResult=async function (result) {
		let applied=await this.m_state.Accept(result);
		if (!(applied instanceof Error)) {
			this.SetValues({});
		}

		return applied;
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

		let image=$this.m_state.ActiveMedia instanceof Media.Image?$this.m_state.ActiveMedia:null;
		return Executable.Execute(response?.text, this, {image, artifact: $this.m_state.CurrentMedia}, (result)=>this.ApplyResult(result));
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

		let available=Executable.Instances.map((instance)=>`${instance.Name}: ${instance.Description||'no description'}`).join('\n');
		let media=$this.m_state.CurrentMedia;
		let compiled=$this.ReadCompiledSource();
		let prompt=`已安裝執行類型：\n${available||'(none)'}\n可查閱來源：${JSON.stringify(Source.Instances.map((entry)=>entry.Name))}\n${compiled.message}\n目前影像：${JSON.stringify(image)}\n目前媒體類型：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 context.artifact 存取物件實例。\n選定比例：${state.SelectedRatio}\n已確認的修改：${JSON.stringify(state.AccumulatedChanges)}\n先前對話：\n${history}\n使用者目前的訊息：\n${message}`;
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
				$this.Reply(reply, {IncludedMedia: $this.m_state.CurrentMedia});
				return;
			}

			let previous=Executable.Executions.at(-1);
			media=$this.m_state.CurrentMedia;
			prompt+=`\n前一次程式執行失敗，原碼如下：\n${previous?.Code||''}\n實際已完成的操作：${JSON.stringify(previous?.Changes||[])}\n錯誤：${reply.message}\n目前已安裝執行類型：${Executable.GetNames().join(', ')}\n目前媒體：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 context.artifact 存取物件實例。\n請依照實際狀態撰寫修正後的程式，接續執行剩餘操作。`;
			if (attempt===2) {
				$this.ReportError(reply);
			}
		}
	};

	_['private'].Report=async function (event, details, image) {
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

		this.Reply(reply, image?{IncludedMedia: image}:{});
	};

	_['private'].m_state=null;
	_['private'].m_listeners=null;
	_['private'].m_activeTurn=null;
	_['private'].m_ready=null;
	_['private'].m_view=null;
	_['private'].m_errorEvents=null;
});
