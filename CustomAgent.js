var CustomAgent=Function.extend(React.Component, function () {
	var _=this(CustomAgent);
	CustomAgent=_[CustomAgent];

	function CustomAgent(props) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_component=this;
		$this.m_root=React.createRef();
		$this.m_state={
			activeImage: null
			, history: []
			, messages: [{
				id: 'welcome'
				, sender: 'agent'
				, text: '您好！可以要求本地畫矩形、查閱 App 程式碼、載入新功能，或討論影像修改。只有按下生成按鈕才會生成新影像。'
				, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
			}]
			, inputText: ''
			, selectedRatio: '16:9'
			, accumulatedChanges: []
			, generationPrompt: ''
			, isConsulting: false
			, isGenerating: false
		};
		$this.m_runtime=new RuntimeActions();
		$this.m_conversation=new ConversationController();
		$this.m_images=new ImageService(Flow);
		$this.m_ui=null;
		$this.m_lastMessages=null;
		$this.m_lastHistory=null;
	}

	_['private'].Node=function (role) {
		return this.m_root.current?.querySelector(`[data-role="${role}"]`);
	};

	_['private'].SetValues=function (patch) {
		Object.assign(this.m_state, patch);
		this.Update();
		this.m_ui?.Notify();
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

	_['private'].MakeUI=function () {
		let $this=this;
		let root=this.m_root.current;
		return new AppUI({
			Slots: Object.fromEntries(['header','canvas','chat','overlay'].map((name)=>[name,root.querySelector(`[data-slot="${name}"]`)]))
			, GetState: ()=>$this.m_state
			, ResetCopied: ()=>{}
			, RollbackCode: ()=>$this.m_runtime.Rollback()
			, GenerateText: (prompt, options)=>Flow.generate.text(prompt, options)
			, SendMessage: (text)=>$this.m_component.Send(text)
			, Generate: (prompt)=>$this.m_component.Generate(prompt)
			, PickMedia: ()=>$this.m_component.SelectMedia()
			, CaptureCamera: ()=>$this.m_component.CaptureCamera()
			, Download: ()=>$this.m_component.Download()
			, SelectVersion: (id)=>{
				let image=$this.m_state.history.find((item)=>item.id===id);
				if (!image) throw new Error('Image version not found: '+id);
				$this.SetValues({activeImage: image});
			}
			, RunAction: async (action)=>{
				let result=await $this.m_runtime.Execute(action, $this.m_state.activeImage, $this.m_component.props.HostSourceUrl);
				if (result.image) $this.SetValues({activeImage: result.image, history: [result.image, ...$this.m_state.history]});
				return result;
			}
			, UpdateConversation: (patch)=>$this.SetValues(patch)
		});
	};

	_['public'].componentDidMount=function () {
		let $this=_(this);
		$this.m_ui=$this.MakeUI();
		$this.m_detach=$this.m_runtime.AttachUI($this.m_ui);
		$this.m_click=(event)=>$this.HandleClick(event);
		$this.m_input=(event)=>{
			if (event.target===$this.Node('input')) $this.m_state.inputText=event.target.value;
		};
		$this.m_key=(event)=>{
			if (event.target===$this.Node('input')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing) {
				event.preventDefault();
				$this.m_component.Send();
			}
		};
		let root=$this.m_root.current;
		root.addEventListener('click', $this.m_click);
		root.addEventListener('input', $this.m_input);
		root.addEventListener('keydown', $this.m_key);
		$this.Update();
		$this.m_runtime.Initialize().catch((error)=>$this.AddMessage('agent', `Runtime initialization failed: ${error.message||String(error)}`));
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
			case 'send': $this.m_component.Send(); break;
			case 'select': $this.m_component.SelectMedia(); break;
			case 'camera': $this.m_component.CaptureCamera(); break;
			case 'download': $this.m_component.Download(); break;
			case 'generate': $this.m_component.Generate(); break;
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
			picture.style.display='block';
		}
		else picture.style.display='none';
		this.Node('empty').style.display=state.activeImage?'none':'block';
		this.Node('image-ratio').textContent=state.activeImage?.aspectRatio||'';
		this.Node('generating').style.display=state.isGenerating?'flex':'none';
		this.Node('thinking').hidden=!state.isConsulting;
		let input=this.Node('input');
		if (input.value!==state.inputText) input.value=state.inputText;
		this.Node('pending').style.display=state.accumulatedChanges.length?'block':'none';
		this.Node('pending-count').textContent=`${state.accumulatedChanges.length} confirmed changes`;
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
				time.textContent=(message.sender==='user'?'You':'Agent')+' · '+message.timestamp;
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
					prompt.textContent='Suggested prompt: '+message.suggestedPrompt;
					item.appendChild(prompt);
					let copy=document.createElement('button');
					copy.dataset.action='copy-message-prompt';
					copy.dataset.messageId=message.id;
					copy.textContent='Copy prompt';
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
		if (/^(?:reset|清除|清空|重設)\s*(?:對話|聊天|對話紀錄)$/i.test(message)) {
			$this.m_ui.ResetConversation();
			return;
		}
		$this.AddMessage('user', message);
		$this.SetValues({inputText: '', isConsulting: true});
		try {
			let restored=await $this.m_runtime.RecoverIfRequested(message);
			if (restored) { $this.AddMessage('agent', restored); return; }
			let handler=$this.m_ui.GetConversationHandler();
			if (handler) {
				try { await handler(message, $this.m_ui); }
				catch (error) {
					let recovery='';
					while ($this.m_runtime.HasVersion()&&$this.m_ui.GetConversationHandler()===handler) recovery=$this.m_runtime.Rollback();
					if ($this.m_ui.GetConversationHandler()===handler) $this.m_ui.SetConversationHandler(null);
					throw new Error(`${error.message||String(error)}. ${recovery}`);
				}
			}
			else {
				await $this.m_runtime.Initialize();
				await $this.m_conversation.Send(message, $this.m_ui);
			}
		}
		catch (error) { $this.AddMessage('agent', `Conversation failed: ${error.message||String(error)}`); }
		finally { $this.SetValues({isConsulting: false}); }
	};

	_['public'].SelectMedia=async function () {
		let $this=_(this);
		try {
			let image=await $this.m_images.Select($this.m_state.selectedRatio);
			if (!image) return;
			$this.SetValues({activeImage: image, history: [image, ...$this.m_state.history]});
			$this.AddMessage('agent', `Loaded image “${image.title}”. You can request a local edit or discuss changes.`, {includedImage: image});
		}
		catch (error) { $this.AddMessage('agent', `Failed to select media: ${error.message||String(error)}`); }
	};

	_['public'].CaptureCamera=async function () {
		let $this=_(this);
		try {
			let image=await $this.m_images.Capture($this.m_state.selectedRatio);
			if (!image) return;
			$this.SetValues({activeImage: image, history: [image, ...$this.m_state.history]});
			$this.AddMessage('agent', 'Camera image loaded.', {includedImage: image});
		}
		catch (error) { $this.AddMessage('agent', `Camera failed: ${error.message||String(error)}`); }
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
			$this.AddMessage('agent', 'New image version generated.', {includedImage: image});
		}
		catch (error) { $this.AddMessage('agent', `Image generation failed: ${error.message||String(error)}`); }
		finally { $this.SetValues({isGenerating: false}); }
	};

	_['public'].Download=async function () {
		let $this=_(this);
		try { await $this.m_images.Download($this.m_state.activeImage); }
		catch (error) { $this.AddMessage('agent', `Download failed: ${error.message||String(error)}`); }
	};

	_['public'].componentWillUnmount=function () {
		let $this=_(this);
		let root=$this.m_root.current;
		root?.removeEventListener('click', $this.m_click);
		root?.removeEventListener('input', $this.m_input);
		root?.removeEventListener('keydown', $this.m_key);
		$this.m_detach?.();
		$this.m_ui?.Destroy();
	};

	_['public'].render=function () {
		return React.createElement('div', {ref: _(this).m_root, style: {height: '100%', width: '100%'}, dangerouslySetInnerHTML: {__html: agentTemplate}});
	};

	_['private'].m_component=null;
	_['private'].m_root=null;
	_['private'].m_state=null;
	_['private'].m_runtime=null;
	_['private'].m_conversation=null;
	_['private'].m_images=null;
	_['private'].m_ui=null;
	_['private'].m_lastMessages=null;
	_['private'].m_lastHistory=null;
	_['private'].m_detach=null;
	_['private'].m_click=null;
	_['private'].m_input=null;
	_['private'].m_key=null;
});
globalThis.CustomAgent=CustomAgent;
