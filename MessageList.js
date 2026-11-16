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
