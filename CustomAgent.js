var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_view=new View();
		$this.m_session=new Session();
		$this.m_modules=new Modules(new Sources(props.SourceFiles, props.HostSourceUrl));
	}

	_['private'].Node=function (role) {
		return this.m_view.Node(role);
	};

	_['private'].SetValues=function (patch) {
		this.m_session.State.Apply(patch);
		this.Update();
		this.Notify();
	};

	_['private'].AddMessage=function (sender, text, fields={}) {
		let $this=_(this);
		$this.SetValues({messages: [...$this.m_session.State.Chat.Messages, {
			id: `${sender}_${Date.now()}_${Math.random()}`
			, sender
			, text
			, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			, ...fields
		}]});
	};

	_['public'].Slots=['header', 'canvas', 'chat', 'overlay'];
	CustomAgent.ActionNames=['readCompiledSource', 'readRemoteSource', 'readInstalledSource', 'inspectRuntime', 'loadModule', 'rollback', 'resetConversation', 'generateVideo'];
	_['public'].Text=function (key) {
		let english={tagline: 'Describe an edit to use local tools, or generate an image', help: 'Help', target: 'Target Image', download: 'Download', empty: 'No image selected. Load an image or describe an idea in chat.', media: '＋ Media', camera: 'Camera', generating: 'Generating image…', history: 'Image versions', copyPrompt: 'Copy prompt', generate: 'Generate image from confirmed changes', ratio: 'Output ratio', original: 'Original', input: 'Discuss an idea, draw a rectangle, inspect code, or create a local tool…', send: 'Send', stop: 'Stop', about: "Discuss image changes or ask for local operations. Only the Generate button creates a new image. You can also inspect and extend this session's code.", close: 'Close', confirmedChanges: 'Confirmed changes', you: 'You', agent: 'Assistant', promptDraft: 'Combined prompt draft: ', copy: 'Copy', thinking: 'Thinking and running local operations…'};
		let chinese={tagline: '描述修改即可執行本地操作，也可選擇生成影像', help: '使用說明', target: '當前聚焦影像 (Target Image)', download: '下載', empty: '尚未選擇或拍攝影像。請載入圖片，或在對話中描述構想。', media: '＋ 媒體庫', camera: '拍照', generating: 'AI 正在修訂影像…', history: '迭代歷程版本', copyPrompt: '複製提示詞', generate: '依已確認改動生成影像', ratio: '輸出比例', original: '原圖', input: '討論構想、畫矩形、查看程式碼，或編寫本地功能…', send: '傳送', stop: '停止', about: '可討論影像修改或要求本地操作。只有按下生成按鈕才會產生新影像，也可以要求查閱及擴充本次執行的程式碼。', close: '關閉', confirmedChanges: '已確認的改動項目', you: '您', agent: 'AI 助理 (Agent)', promptDraft: '整合提示詞草稿：', copy: '複製', thinking: '正在理解要求並處理本地操作…'};
		return ('zh'===_(this).m_view.GetLocale()?chinese:english)[key]||english[key]||key;
	};
	_['public'].Localize=function () { _(this).m_view.Localize((key)=>this.Text(key)); };

	_['public'].GetState=function () {
		return _(this).m_session.State.ToSnapshot();
	};

	_['public'].GetImageInfo=async function () {
		let $this=_(this);
		let image=$this.m_session.State.Media.ActiveImage;
		if (!image) return null;
		let dimensions=await new ImageService().GetDimensions(image.toJSON());
		return {...dimensions, mimeType: image.Content.MimeType, title: image.Provenance.Title};
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
		$this.m_session.Listeners.add(listener);
		listener(this.GetState());
		return ()=>$this.m_session.Listeners.delete(listener);
	};

	_['public'].Notify=function () {
		for (let listener of _(this).m_session.Listeners) {
			try { listener(this.GetState()); }
			catch (error) { console.error('App subscriber failed:', error); }
		}
	};

	_['public'].UpdateConversation=function (patch) { _(this).SetValues(patch); };
	_['public'].ResetConversation=function () {
		let $this=_(this);
		if ($this.m_session.State.Media.IsGenerating) throw new Error('Wait for image generation to finish before resetting the conversation.');
		$this.SetValues({messages: [], accumulatedChanges: [], generationPrompt: '', inputText: ''});
	};
	_['public'].SetInput=function (value) { this.UpdateConversation({inputText: value}); };
	_['public'].SetRatio=function (value) {
		if (!['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(value)) throw new Error('Unsupported aspect ratio.');
		this.UpdateConversation({selectedRatio: value});
	};
	_['public'].SelectVersion=function (id) {
		let $this=_(this);
		let image=$this.m_session.State.Media.History.find((item)=>item.Id===id);
		if (!image) throw new Error('Image version not found: '+id);
		$this.SetValues({activeImage: image, currentArtifact: image});
	};
	_['public'].SendMessage=function (text) { return this.Send(text); };
	_['public'].Stop=function () {
		let $this=_(this);
		if (!$this.m_session.ActiveTurn) return;
		$this.m_session.ActiveTurn.Cancelled=true;
		$this.m_session.ActiveTurn=null;
		$this.SetValues({isConsulting: false});
	};
	_['public'].PickMedia=function () { return this.SelectMedia(); };
	_['public'].RunAction=async function (action, track=true, source, Type) {
		let $this=_(this);
		await $this.m_modules.GetStartup();
		let image=$this.m_session.State.Media.ActiveImage?.toJSON();
		let result=await $this.ExecuteAction(action, {image, artifact: $this.m_session.State.Media.CurrentArtifact?.toJSON(), track, source, Type});
		if (result.artifact) {
			let artifact=result.artifact;
			$this.SetValues({
				currentArtifact: artifact
				, ...('image'===artifact.kind?{activeImage: artifact, history: [artifact, ...$this.m_session.State.Media.History]}:{})
			});
		}
		return result;
	};

	_['public'].GenerateVideo=async function (args={}, context={}) {
		let image=context.image;
		if ((args.useCurrentImageAsFirstFrame||args.useCurrentImageAsReference)&&!image) throw new Error('No current image is available.');
		if (args.useCurrentImageAsFirstFrame&&args.firstFrameImageMediaId) throw new Error('Choose one first-frame image.');
		let references=args.referenceImageMediaIds||[];
		if (!Array.isArray(references)) throw new Error('Reference image media IDs must be an array.');
		let artifact=await new VideoService().Generate({
			prompt: args.prompt
			, aspectRatio: args.aspectRatio
			, durationSeconds: args.durationSeconds
			, resolution: args.resolution
			, firstFrameImage: args.useCurrentImageAsFirstFrame?image:args.firstFrameImageMediaId
			, referenceImages: args.useCurrentImageAsReference?[image, ...references]:references
			, sourceVideoMediaId: args.sourceVideoMediaId
		});
		return {message: `Video generated and saved to Flow Assets (${artifact.mediaId}).`, artifact};
	};

	_['public'].InspectRuntime=function (args={}) {
		let runtime=this.GetRuntime();
		if ('string'===typeof args.name) {
			let fn=runtime.Modules[args.name]?.Run;
			if ('function'!==typeof fn) throw new Error('Runtime function not found: '+args.name);
			return {message: `${args.name}: ${fn.Description||String(fn)}`};
		}
		let modules=_(this).m_modules;
		return {message: `Callable modules: ${this.GetNames().map((name)=>name+(runtime.Modules[name].Run.Description?': '+runtime.Modules[name].Run.Description:'')).join('; ')||'(none)'}. Loaded modules: ${Object.keys(runtime.Modules).join(', ')||'(none)'}. Compiled source files: ${JSON.stringify(modules.GetSources().CompiledNames())}. Bundle.Config: ${JSON.stringify(Bundle.Config)}. UI slots: ${this.Slots.join(', ')||'(unavailable)'}. Mounted UI: ${this.Mounted().join(', ')||'(none)'}. Reversible installations: ${modules.GetVersionCount()}. Built-in actions: ${CustomAgent.ActionNames.join(', ')}.`};
	};

	_['public'].GetRuntime=function () { return _(this).m_modules.GetRuntime(); };
	_['public'].GetNames=function () { return _(this).m_modules.GetNames(); };
	_['public'].HasVersion=function () { return _(this).m_modules.HasVersion(); };
	_['public'].Rollback=function () { return _(this).m_modules.Rollback(); };
	_['public'].Initialize=function () { return _(this).m_modules.Initialize(); };
	_['public'].ReadCompiledSource=function (args={}) { return _(this).m_modules.GetSources().ReadCompiledSource(args); };
	_['public'].ReadRemoteSource=function (args={}) { return _(this).m_modules.GetSources().ReadRemoteSource(args); };
	_['public'].ReadInstalledSource=function (args={}) { return _(this).m_modules.GetSources().ReadInstalledSource(args); };
	_['public'].LoadModule=function (source, options={}) { return _(this).m_modules.LoadModule(source, options); };

	_['private'].ResolveAction=function (name) {
		switch (name) {
			case 'readCompiledSource': return (args)=>this.ReadCompiledSource(args);
			case 'readRemoteSource': return (args)=>this.ReadRemoteSource(args);
			case 'readInstalledSource': return (args)=>this.ReadInstalledSource(args);
			case 'inspectRuntime': return (args)=>this.InspectRuntime(args);
			case 'loadModule': return (args, context)=>this.LoadModule(context.source, {name: args.name, Type: context.Type, readyMember: args.readyMember, track: context.track});
			case 'rollback': return ()=>({message: this.Rollback()});
			case 'resetConversation': return ()=>{ this.ResetConversation(); return {message: 'Conversation cleared.', conversationReset: true}; };
			case 'generateVideo': return (args, context)=>this.GenerateVideo(args, context);
			default: return this.GetRuntime().Modules[name]?.Run;
		}
	};

	_['private'].ExecuteAction=async function (action, context) {
		if (!action?.arguments||'object'!==typeof action.arguments||Array.isArray(action.arguments)) throw new Error('Action arguments must be an object.');
		let args=action.arguments;
		let callback=_(this).ResolveAction(action.name);
		if ('function'!==typeof callback) throw new Error('Runtime function not found: '+String(action.name));
		let value=await callback(args, context);
		if (undefined!==value?.artifact) {
			if (!value.artifact||'object'!==typeof value.artifact||'string'!==typeof value.artifact.kind||!value.artifact.kind) throw new Error('An action artifact needs a kind.');
			if ('image'===value.artifact.kind) {
				let image=await new ImageService().ReadActionResult({image: value.artifact}, context.image, action.name);
				if (!image) throw new Error('An image artifact needs supported image content.');
				return {message: 'string'===typeof value.message?value.message:`${action.name} updated the current image.`, artifact: image, image};
			}
			return {message: 'string'===typeof value.message?value.message:`${action.name} completed.`, artifact: value.artifact};
		}
		let image=await new ImageService().ReadActionResult(value, context.image, action.name);
		if (image) return {message: 'string'===typeof value.message?value.message:`${action.name} updated the current image.`, artifact: image, image};
		if (value&&'string'===typeof value.message) return value;
		return {message: `${action.name}: ${('string'===typeof value?value:JSON.stringify(value)??'completed').slice(0,12000)}`};
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
		$this.GetRuntime().UI=this;
		let root=$this.m_view.GetRef().current;
		root.onclick=(event)=>{
			let target=event.target.closest?.('[data-action],[data-ratio]');
			if (!target||!root.contains(target)) return;
			if (target.dataset.ratio) { $this.SetRatio(target.dataset.ratio); return; }
			switch (target.dataset.action) {
				case 'send': $this.m_session.State.Chat.IsConsulting?$this.Stop():$this.Send(); break;
				case 'select': $this.SelectMedia(); break;
				case 'camera': $this.CaptureCamera(); break;
				case 'download': $this.Download(); break;
				case 'generate': $this.Generate(); break;
				case 'info': new HtmlNode($this.Node('dialog')).SetStyle('display', 'flex'); break;
				case 'close-info': new HtmlNode($this.Node('dialog')).SetStyle('display', 'none'); break;
				case 'copy-prompt': navigator.clipboard.writeText($this.m_session.State.Draft.GenerationPrompt||''); break;
			}
		};
		root.oninput=(event)=>{
			if (event.target===$this.Node('input')) $this.m_session.State.Chat.InputText=event.target.value;
		};
		root.onkeydown=(event)=>{
			if (event.target===$this.Node('input')&&'Enter'===event.key&&!event.shiftKey&&!event.isComposing) {
				event.preventDefault();
				if (!$this.m_session.State.Chat.IsConsulting) $this.Send();
			}
		};
		$this.Update();
		$this.m_session.Ready=$this.Welcome();
	};

	_['private'].Update=function () {
		this.m_view.Update(this.m_session.State, (key)=>this.Text(key), (id)=>this.SelectVersion(id));
	};

	_['public'].Send=async function (text) {
		let $this=_(this);
		let message=String(text??$this.m_session.State.Chat.InputText).trim();
		if (!message||$this.m_session.State.Chat.IsConsulting) return;
		let turn=new Turn();
		$this.m_session.ActiveTurn=turn;
		$this.AddMessage('user', message);
		$this.SetValues({inputText: '', isConsulting: true});
		try {
			await $this.HandleMessage(message, turn);
		}
		catch (error) { if (!turn.Cancelled) await this.NotifyAssistant('Conversation failed', {Error: error.message||String(error)}); }
		finally {
			if ($this.m_session.ActiveTurn===turn) {
				$this.m_session.ActiveTurn=null;
				$this.SetValues({isConsulting: false});
			}
		}
	};

	_['public'].SelectMedia=async function () {
		let $this=_(this);
		try {
			let image=await new ImageService().Select();
			if (!image) return;
			$this.SetValues({activeImage: image, currentArtifact: new ImageArtifact(image), history: [image, ...$this.m_session.State.Media.History]});
			await this.NotifyAssistant('Media selected', {Title: image.title, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].CaptureCamera=async function () {
		let $this=_(this);
		try {
			let image=await new ImageService().Capture();
			if (!image) return;
			$this.SetValues({activeImage: image, currentArtifact: new ImageArtifact(image), history: [image, ...$this.m_session.State.Media.History]});
			await this.NotifyAssistant('Camera image captured', {Title: image.title, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].Generate=async function (prompt) {
		let $this=_(this);
		let state=$this.m_session.State;
		let text=String(prompt||state.Draft.GenerationPrompt).trim();
		if (!text||state.Media.IsGenerating) return;
		$this.SetValues({isGenerating: true});
		try {
			let generated=await new ImageService().Generate(text, state.Media.ActiveImage?.toJSON(), state.Draft.SelectedRatio, state.Media.History.length+1);
			let image=generated.Image;
			$this.SetValues({activeImage: image, currentArtifact: new ImageArtifact(image), history: [image, ...state.Media.History]});
			await this.NotifyAssistant('Image generation completed', {Title: image.title, Prompt: text, Width: image.width, Height: image.height}, image);
		}
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
		finally { $this.SetValues({isGenerating: false}); }
	};

	_['public'].Download=async function () {
		let $this=_(this);
		try { await new ImageService().Download($this.m_session.State.Media.ActiveImage?.toJSON()); }
		catch (error) { await this.NotifyAssistant('App operation failed', {Error: error.message||String(error)}); }
	};

	_['public'].componentWillUnmount=function () {
		let $this=_(this);
		this.Stop();
		let root=$this.m_view.GetRef().current;
		if (root) root.onclick=root.oninput=root.onkeydown=null;
		let runtime=this.GetRuntime();
		if (runtime.UI===this) delete runtime.UI;
		for (let name of this.Mounted()) this.Unmount(name);
		$this.m_session.Listeners.clear();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: _(this).m_view.GetRef(), style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let app=$this;
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

				if ('loadModule'===data.localAction?.name) {
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
		let dynamicList=$this.m_modules.DescribeDynamic();

		return `
你是此 App 的 Assistant。你可以討論需求，也可以請 App 執行本地操作；影像生成由使用者按下生成按鈕啟動。請依使用者本輪使用的語言自然答覆，參考對話或瀏覽器語系判斷語言，預設使用英文。
實際能力：${runtime.message}
本次對話中經由 loadModule 載入的模組：${dynamicList}

需要操作時，在答覆最後附一個 json 程式碼區塊，包含 {"attemptPlan":[{"action":"操作名稱","attempts":1,"reason":"目的與重試條件"}],"localAction":{"name":"操作名稱","arguments":{}}}。一般討論直接以文字答覆。App 每次執行一項操作並回傳結果；依結果繼續、調整或答覆。
readCompiledSource 空參數列出啟動時已完整拆解的固定 host 檔案，{file} 取得完整原碼；readRemoteSource 空參數列出 Bundle.Config 等遠端來源，{name} 可重新取得其內容；readInstalledSource 空參數列出已安裝模組，{name} 取得安裝時保留的完整原碼，遠端安裝者可重新取得。inspectRuntime 檢查現有函數、模組及原碼入口。
loadModule 接收獨立的 JavaScript 程式碼或遠端腳本 URL。需要載入時，先輸出 javascript 程式碼區塊（原碼）或 text 程式碼區塊（URL），再於答覆最後輸出操作控制 JSON，其 localAction 為 {"name":"loadModule","arguments":{"name":"模組名稱"}}，並在 attemptPlan 列出 loadModule。自行撰寫類型時，以頂層 var 和 Function.extend(Base, factory) 宣告，將建構子、方法及靜態成員寫在類別定義內；需要完整範例時，可透過 readInstalledSource 查看 DrawRectangle 原碼。可呼叫的模組提供靜態 Run。
直接以模組名稱作為操作名稱呼叫其 Run；rollback 撤銷上一項模組安裝；resetConversation 清空對話。需要實作新功能時可讀程式碼並撰寫、載入模組。
generateVideo 可由使用者提出影片生成要求時執行，參數為 {prompt,aspectRatio,durationSeconds,resolution}；aspectRatio 為 16:9 或 9:16，durationSeconds 為 3 至 15，resolution 為 720p 或 360p。可選 useCurrentImageAsFirstFrame: true 作為首幀，或 useCurrentImageAsReference: true 作為參考；也可傳 firstFrameImageMediaId、referenceImageMediaIds，或 sourceVideoMediaId 作為影片編輯來源。首幀不得與參考圖或來源影片同時使用。完成後影片自動存入 Flow Assets，目前沒有影片播放 UI。
可用模組可使用瀏覽器標準 API，Run 收到參數與 {artifact,image,track,source,Type}；有產物時回傳 {message,artifact:{kind,...}}，其中 artifact.kind 指出產物類型，影片可保留 mediaId、mimeType 與時長。既有影像模組仍可回傳 {message,image:{base64,mimeType}}。UI 可透過 AppRuntime.UI.Mount 掛入介面。模組可以只保留類型與靜態方法，若自行建立單例，應在 Function.extend 的類別定義內完成。
若有待使用者確認的生成修改，可於 JSON 加入 accumulatedChanges、suggestedPrompt、aspectRatio。操作結果與錯誤由 App 回傳；答覆使用者時以自然語言說明結果。
`;
	};

	_['private'].DescribeArtifact=function (artifact) {
		if (!artifact) return null;
		let {kind, id, title, mimeType, mediaId, width, height, durationSeconds}=artifact;
		return {kind, id, title, mimeType, mediaId, width, height, durationSeconds};
	};

	_['private'].HandleMessage=async function (message, turn) {
		let $this=_(this);
		await $this.m_session.Ready;
		if (turn?.Cancelled) return;

		let app=$this;
		let initial=app.GetState();
		let imageInfo=await app.GetImageInfo();
		if (turn?.Cancelled) return;

		let prior=initial.messages.slice();
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();

		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length
			?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n')
			:'(none)';

		let artifact=initial.currentArtifact;
		let question=()=>`
Current image: ${imageInfo?`${imageInfo.width} × ${imageInfo.height} pixels (${imageInfo.mimeType})`:'none'}
Current artifact: ${JSON.stringify($this.DescribeArtifact(artifact))}
Selected generation aspect ratio: ${initial.selectedRatio}
Pending generation changes:
${changes}
Previous conversation (up to 20 messages):
${history}
Current user message:
${message}
`;

		let image=!artifact||'image'===artifact.kind?initial.activeImage:null;
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
			if (turn?.Cancelled) return;

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
			if (turn?.Cancelled) return;

			let control=$this.ReadControl(response.text);
			answer=control.Text;

			let data=control.Data;
			if (data) {
				structured=true;
				if (Array.isArray(data.accumulatedChanges)) {
					changesOut=data.accumulatedChanges.filter((item)=>'string'===typeof item);
				}
				if ('string'===typeof data.suggestedPrompt) promptOut=data.suggestedPrompt;
				if (['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(data.aspectRatio)) {
					ratioOut=data.aspectRatio;
				}
				if (Array.isArray(data.attemptPlan)&&data.attemptPlan.length) plan=data.attemptPlan;
			}

			let action=data?.localAction;
			if (!action||'string'!==typeof action.name) break;

			if (!plan.some((entry)=>entry.action===action.name)) {
				reports.push({
					action: action.name
					, status: 'error'
					, result: 'The action needs an attemptPlan entry before execution.'
				});
				continue;
			}

			try {
				if (turn?.Cancelled) return;

				let result=await app.RunAction(action, true, control.Source, control.Type);
				if (turn?.Cancelled) return;

				if (result.conversationReset) {
					let fresh=await Flow.generate.text('.', {systemInstruction: `
App 已清空對話。以使用者這次要求的語言自然回覆。
`});
					if (turn?.Cancelled) return;
					if (!fresh.text?.trim()) throw new Error('The model returned an empty answer.');
					app.Reply(fresh.text.trim());
					return;
				}

				if (result.artifact) {
					artifact=result.artifact;
					image='image'===artifact.kind?artifact:null;
					if (image) {
						imageInfo={width: image.width, height: image.height, mimeType: image.mimeType};
						edited=image;
					}
					else edited=null;
				}

				if ('loadModule'===action.name) {
					let modName=action.arguments?.name||'CustomModule';
					$this.m_modules.RecordDynamic(modName);
				}

				reports.push({
					action: action.name
					, status: 'success'
					, result: result.message
					, ...(result.artifact?{artifact: $this.DescribeArtifact(result.artifact)}:{})
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
			if (turn?.Cancelled) return;
			answer=response.text?.trim();
		}

		if (!answer) throw new Error('The model returned an empty answer me.');
		if (turn?.Cancelled) return;

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
			, ...('video'===artifact?.kind?{includedArtifact: $this.DescribeArtifact(artifact)}:{})
			, ...(edited?{
				includedImage: {
					base64: edited.base64
					, mimeType: edited.mimeType
				}
			}:{})
		});
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_session.Ready;

		let messages=this.GetState().messages.slice(-8)
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
		this.Reply(response.text.trim(), image?{includedImage: image}:{});
	};

	_['private'].m_session=null;
	_['private'].m_view=null;
	_['private'].m_modules=null;
});
