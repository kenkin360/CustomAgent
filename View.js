var ElementRef=Function.extend(Object, function () {
	var _=this(ElementRef);
	ElementRef=_[ElementRef];
	function ElementRef() {
		_['base'].apply(this, arguments);
		this.current=null;
	}
});

var Mount=Function.extend(Object, function () {
	var _=this(Mount);
	Mount=_[Mount];
	function Mount(element, slot) {
		_['base'].apply(this, arguments);
		this.Element=element;
		this.Slot=slot;
	}
});

var MessageList=Function.extend(Object, function () {
	var _=this(MessageList);
	MessageList=_[MessageList];
	function MessageList() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_lastMessages=null;
		$this.m_lastNode=null;
		$this.m_lastConsulting=null;
	}
	_['public'].Update=function (list, state, text) {
		let $this=_(this);
		if (!list) { $this.m_lastNode=null; return; }
		if (state.messages===$this.m_lastMessages&&state.isConsulting===$this.m_lastConsulting&&list===$this.m_lastNode) return;
		let items=state.messages.map((message)=>{
			let item=document.createElement('div');
			item.className=`ca-message ca-${message.sender}`;
			let time=document.createElement('small');
			time.textContent=(message.sender==='user'?text('you'):message.sender==='system'?'App':text('agent'))+' · '+message.timestamp;
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
				prompt.textContent=text('promptDraft')+message.suggestedPrompt;
				item.appendChild(prompt);
				let copy=document.createElement('button');
				copy.textContent=text('copy');
				copy.onclick=()=>navigator.clipboard.writeText(message.suggestedPrompt);
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
			thinking.textContent=text('thinking');
			items.splice(pendingIndex+1, 0, thinking);
		}
		list.replaceChildren(...items);
		$this.m_lastMessages=state.messages;
		$this.m_lastNode=list;
		$this.m_lastConsulting=state.isConsulting;
		(list.querySelector('.ca-thinking')||list.lastElementChild)?.scrollIntoView({block: 'nearest'});
	};
	_['private'].m_lastMessages=null;
	_['private'].m_lastNode=null;
	_['private'].m_lastConsulting=null;
});

var HistoryList=Function.extend(Object, function () {
	var _=this(HistoryList);
	HistoryList=_[HistoryList];
	function HistoryList() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_lastHistory=null;
		$this.m_lastNode=null;
	}
	_['public'].Update=function (area, state, select) {
		let $this=_(this);
		if (!area) { $this.m_lastNode=null; return; }
		if (state.history!==$this.m_lastHistory||area!==$this.m_lastNode) {
			area.replaceChildren(...state.history.map((image)=>{
				let button=document.createElement('button');
				button.dataset.version=image.id;
				button.title=image.title;
				button.onclick=()=>select(image.id);
				let thumbnail=document.createElement('img');
				thumbnail.src=`data:${image.mimeType};base64,${image.base64}`;
				thumbnail.alt=image.title;
				button.appendChild(thumbnail);
				return button;
			}));
			$this.m_lastHistory=state.history;
			$this.m_lastNode=area;
		}
		for (let button of area.children) button.classList.toggle('ca-selected', button.dataset.version===state.activeImage?.id);
	};
	_['private'].m_lastHistory=null;
	_['private'].m_lastNode=null;
});

var View=Function.extend(Object, function () {
	var _=this(View);
	View=_[View];
	function View() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_ref=new ElementRef();
		$this.m_mounted=new Map();
		$this.m_messages=new MessageList();
		$this.m_history=new HistoryList();
		$this.m_locale=(navigator.languages||[]).find((language)=>/^zh\b/i.test(language))?'zh':/^zh\b/i.test(navigator.language||'')?'zh':'en';
	}
	Object.defineProperty(_['public'], 'Ref', {get() { return _(this).m_ref; }});
	Object.defineProperty(_['public'], 'Locale', {get() { return _(this).m_locale; }});
	_['public'].Node=function (role) { return _(this).m_ref.current?.querySelector(`[data-role="${role}"]`); };
	_['public'].Localize=function (text) {
		let root=_(this).m_ref.current;
		if (!root) return;
		for (let node of root.querySelectorAll('[data-i18n]')) node.textContent=text(node.dataset.i18n);
		for (let node of root.querySelectorAll('[data-i18n-placeholder]')) node.placeholder=text(node.dataset.i18nPlaceholder);
	};
	_['public'].Mount=function (name, element, slot, slots) {
		let target=_(this).m_ref.current?.querySelector(`[data-slot="${slot}"]`);
		if (!name||!(element instanceof HTMLElement)||!slots.includes(slot)||!target) throw new Error('Provide an extension name, an HTML element, and an available UI slot.');
		this.Unmount(name);
		_(this).m_mounted.set(name, new Mount(element, slot));
		target.appendChild(element);
	};
	_['public'].Unmount=function (name) {
		let mounted=_(this).m_mounted;
		mounted.get(name)?.Element.remove();
		mounted.delete(name);
	};
	_['public'].Mounted=function () { return [..._(this).m_mounted.keys()]; };
	_['public'].Update=function (state, text, select) {
		let root=_(this).m_ref.current;
		if (!root) return;
		let node=(role)=>new HtmlNode(this.Node(role));
		let picture=node('image');
		let image=picture.GetElement();
		if (state.activeImage) {
			let url=`data:${state.activeImage.mimeType};base64,${state.activeImage.base64}`;
			if (image&&image.src!==url) picture.SetSource(url);
			picture.Show(true);
		}
		else picture.Show(false);
		node('empty').SetStyle('display', state.activeImage?'none':'block');
		node('image-ratio').SetText(state.activeImage?.width&&state.activeImage?.height?`${state.activeImage.width} × ${state.activeImage.height}`:'');
		node('generating').SetStyle('display', state.isGenerating?'flex':'none');
		this.Localize(text);
		new HtmlNode(root.querySelector('[data-action="send"]')).SetText(state.isConsulting?text('stop'):text('send'));
		let input=node('input');
		if (input.GetElement()?.value!==state.inputText) input.SetValue(state.inputText);
		node('pending').SetStyle('display', state.accumulatedChanges.length?'block':'none');
		node('pending-count').SetText(`${text('confirmedChanges')} (${state.accumulatedChanges.length})`);
		node('pending-list').SetText(state.accumulatedChanges.map((item, index)=>`${index+1}. ${item}`).join('\n'));
		node('pending-list').SetStyle('whiteSpace', 'pre-wrap');
		node('pending-prompt').SetText(state.generationPrompt||'');
		let ratios=node('ratios').GetElement();
		for (let button of ratios?.querySelectorAll('[data-ratio]')||[]) button.classList.toggle('ca-selected', button.dataset.ratio===state.selectedRatio);
		_(this).m_messages.Update(node('message-list').GetElement(), state, text);
		_(this).m_history.Update(node('history').GetElement(), state, select);
		node('history-count').SetText(state.history.length);
	};
	_['private'].m_ref=null;
	_['private'].m_mounted=null;
	_['private'].m_messages=null;
	_['private'].m_history=null;
	_['private'].m_locale=null;
});
