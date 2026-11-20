var MessageList=Function.extend(Object, function () {
	var _=this(MessageList);
	MessageList=_[MessageList];

	function MessageList() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_lastMessages=null;
		$this.m_lastNode=null;
	}

	_['public'].Update=function (list, state, text, url) {
		let $this=_(this);
		if (!list) { $this.m_lastNode=null; return; }

		if (state.Messages===$this.m_lastMessages&&list===$this.m_lastNode) { return; }

		let scroll=()=>{
			list.parentElement.scrollTop=list.parentElement.scrollHeight;
		};

		let items=state.Messages.map((message)=>{
			if ('string'!==typeof message.Text) {
				let thinking=document.createElement('div');
				thinking.className='ca-thinking';
				thinking.setAttribute('role', 'status');
				thinking.setAttribute('aria-live', 'polite');
				thinking.textContent=text('thinking');
				return thinking;
			}

			let item=document.createElement('div');
			item.className='ca-message '+(message instanceof Message.User?'ca-user':message instanceof Message.Error?'ca-error':'ca-agent');
			let time=document.createElement('small');
			time.textContent=(message instanceof Message.User?text('you'):text('agent'))+' · '+message.Timestamp;
			item.appendChild(time);
			if (message.IncludedMedia instanceof Media.Image||message.IncludedMedia instanceof Media.Video) {
				let preview=document.createElement(message.IncludedMedia instanceof Media.Video?'video':'img');
				if (message.IncludedMedia instanceof Media.Video) {
					preview.controls=true;
					preview.playsInline=true;
					preview.preload='metadata';
					preview.onloadedmetadata=scroll;
				}
				else {
					preview.onload=scroll;
				}

				preview.src=url(message.IncludedMedia);
				if (message.IncludedMedia instanceof Media.Image) { preview.alt='Media result'; }

				item.appendChild(preview);
			}

			let body=document.createElement('div');
			body.textContent=message.Text;
			item.appendChild(body);
			return item;
		});

		list.replaceChildren(...items);
		$this.m_lastMessages=state.Messages;
		$this.m_lastNode=list;
		scroll();
	};

	_['private'].m_lastMessages=null;
	_['private'].m_lastNode=null;
});
