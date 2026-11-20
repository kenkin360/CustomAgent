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

	_['private'].AddMessage=function (sender, text, fields) {
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

	_['public'].GetImageInfo=async function () {
		let $this=_(this);
		let image=$this.m_state.ActiveMedia;

		if (!(image instanceof Media.Image)) { 
			return null; 
		}

		let dimensions=await new ImageService().GetDimensions(image);

		if (dimensions instanceof Error) { 
			return dimensions; 
		}

		return {...dimensions, mimeType: image.MimeType, title: image.Title};
	};

	_['public'].NotifyAssistant=async function (event, details, image) {
		try { 
			await _(this).Report(event, details, image); 
		}
		catch (error) { 
			this.ReportError(error); 
		}
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
				console.error('App subscriber failed:', error); 
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
		$this.SetValues({isConsulting: false});
	};

	_['public'].GenerateVideo=async function (args, context) {
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

		$this.m_ready=$this.Initialize().catch((error)=>{
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
		catch (error) { 
			await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); 
		}
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
		catch (error) { 
			await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); 
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
			if (image instanceof Error) { $this.ReportError(image); return; }

			$this.SetValues({media: image});
			await this.NotifyAssistant('Image generation completed', {Title: image.Title, Prompt: text, Width: image.Width, Height: image.Height}, image);
		}
		catch (error) { 
			await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); 
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
			await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); 
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
			$this.ReportError(error);
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
					$this.ReportError(loaded);
					return;
				}
			}
		}

		if ($this.m_state.Messages.length) {
			return;
		}

		let reply=await $this.InvokeText(null, $this.MakeSystemInstruction(`
`));

		if (reply instanceof Error) {
			$this.ReportError(reply);
		}
		else if (!$this.m_state.Messages.length) {
			$this.Reply(reply);
		}
	};

	_['private'].MakeSystemInstruction=function (x) {
		return {'systemInstruction': x};
	};

	_['private'].HandleMessage=async function (message, turn) {
		let $this=_(this);
		await $this.m_ready;

		if (turn.signal.aborted) {
			return;
		}

		let state=$this.GetState();
		let history=state.Messages.slice(-20).map((entry)=>`${entry.Sender}: ${entry.Text}`).join('\r\n');
		let image=await $this.GetImageInfo();

		if (image instanceof Error) { 
			$this.ReportError(image); 
			return; 
		}

		let available=Executable.Instances.map((instance)=>`${instance.Name}: ${instance.Description||'no description'}`).join('\r\n');
		let media=$this.m_state.CurrentMedia;
		let compiled=$this.ListCompiledSources();
		let previous=null;

		for (let attempt=3; attempt-->0; previous=Executable.Executions.at(-1)) {
			let options=$this.MakeSystemInstruction(
(attempt<2)?`
前一次程式執行失敗，原碼如下：
${previous?.Code||''}
實際已完成的操作：${JSON.stringify(previous?.Changes||[])}
錯誤：${reply.message}
目前已安裝執行類型：${Executable.GetNames().join(', ')}
目前媒體：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 context.artifact 存取物件實例。
請依照實際狀態撰寫修正後的程式，接續執行剩餘操作。
`:`
已安裝執行類型：
${available||'(none)'}
可查閱來源：${JSON.stringify(Source.Instances.map((entry)=>entry.Name))}
${compiled}
目前影像：${JSON.stringify(image)}
目前媒體類型：${media?.constructor.name||'none'}；欄位：${media?Object.keys(media).filter(Boolean).join(', '):'(none)'}。透過 context.artifact 存取物件實例。
選定比例：${state.SelectedRatio}
已確認的修改：${JSON.stringify(state.AccumulatedChanges)}
先前對話：
${history}
使用者目前的訊息：
${message}
`);

			if (image) {
				let current=$this.m_state.ActiveMedia;
				options['images']=[{base64: await current.ToBase64(), mimeType: current.MimeType}];
			}

			let reply=await $this.InvokeText(null, options, turn);

			if (turn.signal.aborted) {
				return;
			}

			if (!(reply instanceof Error)) {
				$this.Reply(reply, {IncludedMedia: $this.m_state.CurrentMedia});
				return;
			}

			$this.ReportError(reply);
			media=$this.m_state.CurrentMedia;
		}
	};

	_['public'].InvokeText=async function (prompt, options) {
		let x=options['systemInstruction'];

		options['systemInstruction']=`
請以 Javascript 程式碼回應
你的回應將會由 Executable.Execute 以 async function 方式執行後將 return value 作為給 user 文字回應
若要處裡較複雜的需求則應正確設計程式碼以避免在 return 前因錯誤而適用者無法收到答覆
你也可以利用 this.InvokeText 來使用和自己相同的模型能力
透過對自己能力的了解最終達成 user 的要求並給予答覆
`;

		let response=await Flow.generate.text(prompt??'.', options);
		return Executable.Execute(response?.text, this);
	};

/*
	_['private'].ApplyResult=async function (result) {
		let applied=await this.m_state.Accept(result);
		if (!(applied instanceof Error)) {
			this.SetValues({});
		}

		return applied;
	};

	_['public'].Reply=function (text, fields) {
		_(this).AddMessage('agent', text, fields);
	};

	_['public'].ReportError=function (error) {
		_(this).AddMessage('system', error.message||String(error));
	};

	_['private'].Report=async function (event, details, image) {
		let $this=_(this);
		await $this.m_ready;

		let messages=this.GetState().Messages.slice(-8).map((entry)=>`${entry.Sender}: ${entry.Text}`).join('\r\n');
		let reply=await $this.InvokeText(null, $this.MakeSystemInstruction(`
回報實際結果結果
`)});

		if (reply instanceof Error) {
			this.ReportError(reply);
			return;
		}

		this.Reply(reply, image?{IncludedMedia: image}:{});
	};
*/

	_['private'].m_state=null;
	_['private'].m_listeners=null;
	_['private'].m_activeTurn=null;
	_['private'].m_ready=null;
	_['private'].m_view=null;
	_['private'].m_errorEvents=null;
});
