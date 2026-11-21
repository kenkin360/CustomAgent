var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_view=new View();
		$this.m_state=new AgentSession();
		$this.m_listeners=new Set();
	}
	
	_['private'].SetValues=function (patch) {
		this.m_state.Update(patch);
		this.Update();
		this.Notify();
	};

	_['public'].AddMessage=function (message) {
		let $this=_(this);
		$this.SetValues({messages: [...$this.m_state.Messages, message]});
		return message;
	};

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];

	_['private'].Update=function () {
		let locale=this.m_view.GetLocale();
		this.m_view.Update(this.m_state, (key)=>DisplayText.GetText(locale, key), (id)=>this.SelectVersion(id));
	};

	_['public'].GetState=function () {
		return _(this).m_state;
	};

	_['public'].ListCompiledSources=function () {
		return `Compiled source files: ${JSON.stringify(Source.Instances.filter((entry)=>!entry.Remote).map((entry)=>entry.Name))}`;
	};

	_['public'].ReadCompiledSource=function (file) {
		let source=Source.GetInstance(file);

		if (!source||source.Remote) {
			return Helper.Error('Compiled source file not found: '+file);
		}

		return `
${source.Name}:
${source.Value}
`;
	};

	_['public'].ListRemoteSources=function () {
		return `Remote source entries: ${JSON.stringify(Source.Instances.filter((entry)=>entry.Remote).map((entry)=>({name: entry.Name, url: entry.Value, readyMember: entry.ReadyMember})))}`;
	};

	_['public'].ReadRemoteSource=function (name) {
		let source=Source.GetInstance(name);

		if (!source||!source.Remote) {
			return Helper.Error('Remote source not found: '+name);
		}

		return source.Read();
	};

	_['public'].ListInstalledSources=function () {
		return `Installed modules: ${JSON.stringify(Executable.GetNames())}`;
	};

	_['public'].ReadInstalledSource=function (name) {
		let instance=Executable.GetInstance(name);

		if (!instance) {
			return Helper.Error('Installed module not found: '+name);
		}

		return instance.Source.Read();
	};

	_['public'].Mount=function (name, element, slot='header') { 
		_(this).m_view.Mount(name, element, slot, this.Slots); 
	};

	_['public'].Unmount=function (name) { 
		_(this).m_view.Unmount(name); 
	};

	_['public'].Mounted=function () { 
		return _(this).m_view.Mounted(); 
	};

	_['public'].Subscribe=function (listener) {
		let $this=_(this);
		$this.m_listeners.add(listener);
		listener(this.GetState());
		return ()=>$this.m_listeners.delete(listener);
	};

	_['public'].Notify=function () {
		for (let listener of _(this).m_listeners) {
			try { 
				listener(this.GetState()); 
			}
			catch (error) { 
				console.error('Agent subscriber failed:', error);
			}
		}
	};

	_['public'].UpdateConversation=function (patch) { 
		_(this).SetValues(patch); 
	};

	_['public'].ResetConversation=function () {
		let $this=_(this);

		if ($this.m_state.IsGenerating) { 
			return Helper.Error('Wait for image generation to finish before resetting the conversation.'); 
		}

		$this.SetValues({messages: [], accumulatedChanges: [], generationPrompt: '', inputText: ''});
	};

	_['public'].SetInput=function (value) { 
		this.UpdateConversation({inputText: value}); 
	};

	_['public'].SetRatio=function (value) {
		if (!['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) { 
			return Helper.Error('Unsupported aspect ratio.'); 
		}

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
		let state=$this.m_state;
		let index=state.Messages.findLastIndex((entry)=>entry instanceof Message.User);
		$this.SetValues({messages: state.Messages.filter((entry, position)=>position<=index||'string'===typeof entry.Text), isConsulting: false});
	};

	_['public'].GenerateVideo=async function (args) {
		try {
			let media=await new VideoService().Generate(args, this.GetState().ActiveMedia);
			if (media instanceof Error) {
				return media;
			}

			this.UpdateConversation({media});
			return `Video generated and saved to Flow Assets (${media.MediaId}).`;
		}
		catch (error) {
			return Helper.Error(error);
		}
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
					$this.AddMessage(new Message.Error(error));
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
				$this.AddMessage(new Message.Error(error||new Error(event.message||'Generated code failed.')));
			};

			globalThis.addEventListener('error', (event)=>capture(event, event.error), {signal: $this.m_errorEvents.signal});
			globalThis.addEventListener('unhandledrejection', (event)=>capture(event, event.reason), {signal: $this.m_errorEvents.signal});
		}

		$this.m_ready=$this.Initialize().catch((error)=>{
			$this.m_view.Node('app').SetStyle('visibility', 'visible');
			$this.AddMessage(new Message.Error(error));
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
		$this.AddMessage(new Message.User(message));
		$this.SetValues({inputText: '', isConsulting: true});

		try {
			await $this.HandleMessage(turn);
		}
		catch (error) {
			if (!turn.signal.aborted) {
				$this.AddMessage(new Message.Error(error));
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
			if (image instanceof Error) {
				$this.AddMessage(new Message.Error(image));
				return;
			}

			if (!image) {
				return;
			}

			$this.SetValues({media: image});
			$this.AddMessage(new Message.Assistant('Media selected: '+image.Title, image));
		}
		catch (error) { 
			$this.AddMessage(new Message.Error(error));
		}
	};

	_['public'].CaptureCamera=async function () {
		let $this=_(this);

		try {
			let image=await new ImageService().Capture();
			if (image instanceof Error) {
				$this.AddMessage(new Message.Error(image));
				return;
			}

			if (!image) {
				return;
			}

			$this.SetValues({media: image});
			$this.AddMessage(new Message.Assistant('Camera image captured: '+image.Title, image));
		}
		catch (error) { 
			$this.AddMessage(new Message.Error(error));
		}
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
			if (image instanceof Error) {
				$this.AddMessage(new Message.Error(image));
				return;
			}

			$this.SetValues({media: image});
			$this.AddMessage(new Message.Assistant('Image generation completed: '+image.Title, image));
		}
		catch (error) { 
			$this.AddMessage(new Message.Error(error));
		}
		finally { 
			$this.SetValues({isGenerating: false}); 
		}
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
		catch (error) { 
			$this.AddMessage(new Message.Error(error));
		}
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

	_['private'].Initialize=async function () {
		let $this=_(this);
		let error=Source.SetMetaUrl(this.props.HostSourceUrl);

		if (error instanceof Error) {
			$this.AddMessage(new Message.Error(error));
			return;
		}

		await DisplayText.GetInstance(($this.m_view).GetLocale());
		$this.Update();
		$this.m_view.Node('app').SetStyle('visibility', 'visible');

		for (let [name, url, readyMember] of this.props.SourceFiles||[]) {
			Source.Register(new Source(name, url, readyMember));
		}

		Source.Register(new Source('Function.extend.README.md', Bundle.CustomAgent('Function.extend.README.md')));

		for (let [name, path] of [['DrawRectangle', 'Executables/DrawRectangle.js'], ['Upscale', 'Executables/Upscale.js']]) {
			let source=Source.Register(new Source(name, Bundle.CustomAgent(path)));

			if (!Executable.GetInstance(name)) {
				let loaded=await Executable.Load(source, this);
				if (loaded instanceof Error) {
					$this.AddMessage(new Message.Error(loaded));
					return;
				}
			}
		}

		if ($this.m_state.Messages.length) {
			return;
		}

		let message=$this.AddMessage(new Message.Assistant());
		let text;

		try {
			let response=await this.InvokeText('請用使用者的語言簡短介紹你可以協助的事。');
			text=response instanceof Error?response:await Executable.Execute(response?.text, this);
		}
		catch (failure) {
			text=Helper.Error(failure);
		}

		if ($this.m_state.Messages.includes(message)) {
			message.Text=text;
			if (text instanceof Error) {
				$this.m_state.Messages[$this.m_state.Messages.indexOf(message)]=new Message.Error(text);
			}

			$this.SetValues({messages: [...$this.m_state.Messages]});
		}
	};

	_['private'].HandleMessage=async function (turn) {
		let $this=_(this);
		let message=$this.AddMessage(new Message.Assistant());
		await $this.m_ready;

		if (turn.signal.aborted) {
			return;
		}

		let state=$this.GetState();
		let current=state.Messages.findLast((entry)=>entry instanceof Message.User);
		let history=state.Messages.slice(-20).filter((entry)=>entry!==current&&'string'===typeof entry.Text).map((entry)=>`${entry instanceof Message.User?'User':entry instanceof Message.Error?'Error':'Assistant'}: ${entry.Text}`).join('\r\n');
		let media=state.CurrentMedia;
		let previous=null;
		let failure=null;

		for (let attempt=3; attempt-->0;) {
			let options={systemInstruction: attempt<2?`
前一次程式執行失敗，原碼如下：
${previous?.Code||''}
實際已完成的操作：${JSON.stringify(previous?.Changes||[])}
錯誤：${failure?.message||''}
目前已安裝執行類型：${Executable.GetNames().join(', ')}
請透過 this.GetState() 取得目前訊息與媒體，透過 Executable.GetInstance(name).Run(args) 執行已安裝的類型。
請依照實際狀態撰寫修正後的程式，接續執行剩餘操作。
`:`
已安裝執行類型：
${Executable.Instances.map((instance)=>`${instance.Name}: ${instance.Description||'no description'}`).join('\r\n')||'(none)'}
可查閱來源：${JSON.stringify(Source.Instances.map((entry)=>entry.Name))}
${$this.ListCompiledSources()}
請透過 this.GetState() 取得目前訊息、媒體、選定比例與已確認的修改；透過 Executable.GetInstance(name).Run(args) 執行已安裝的類型。
可使用 this.ReadCompiledSource(name)、this.ReadRemoteSource(name) 查閱原始碼。需要載入執行類型時，可使用 Source.GetInstance(name) 取得來源，並呼叫 Executable.Load(source, this) 或 Executable.Install(name, executableClass, source)。
先前對話：
${history}
`};

			try {
				if (state.ActiveMedia instanceof Media.Image) {
					let base64=await state.ActiveMedia.ToBase64();
					if (base64 instanceof Error) {
						failure=base64;
						break;
					}

					options.images=[{base64, mimeType: state.ActiveMedia.MimeType}];
				}

				let response=await $this.InvokeText(current.Text, options);
				if (turn.signal.aborted) {
					return;
				}

				failure=response instanceof Error?response:await Executable.Execute(response?.text, this);
				if (!(response instanceof Error)) {
					previous=Executable.Executions.at(-1);
				}
			}
			catch (error) {
				failure=Helper.Error(error);
			}

			if (turn.signal.aborted) {
				return;
			}

			if (!(failure instanceof Error)) {
				message.Text=failure;
				if (state.CurrentMedia!==media) {
					message.IncludedMedia=state.CurrentMedia;
				}

				$this.SetValues({messages: [...state.Messages]});
				return;
			}
		}

		if (turn.signal.aborted) {
			return;
		}

		state.Messages[state.Messages.indexOf(message)]=new Message.Error(failure);
		$this.SetValues({messages: [...state.Messages]});
	};

	_['public'].InvokeText=function (prompt, options) {
		return Flow.generate.text(prompt??'.', {...options, systemInstruction: `
一般對話請直接回答純文字，不要包成 JSON 或 JavaScript。
只有需要執行程式時，才回傳完整的匿名非同步函式：async function () { /* operations */ return 'message'; }
程式由 Executable.Execute 執行，函式內可透過 this 取得 CustomAgent，並且必須回傳字串。
請不要使用 Markdown 程式碼區塊；請 await 非同步操作並處理回傳的 Error。
你也可以利用 this.InvokeText 來使用和自己相同的模型能力

${options?.systemInstruction||''}
`}).catch((error)=>Helper.Error(error));
	};

	_['private'].m_state=null;
	_['private'].m_listeners=null;
	_['private'].m_activeTurn=null;
	_['private'].m_ready=null;
	_['private'].m_view=null;
	_['private'].m_errorEvents=null;
});
