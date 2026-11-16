var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];
	function Message(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_id=value.id;
		$this.m_sender=value.sender;
		$this.m_text=value.text;
		$this.m_timestamp=value.timestamp;
		$this.m_content=new MessageContent(value);
	}
	for (let [name, field] of [['id', 'm_id'], ['sender', 'm_sender'], ['text', 'm_text'], ['timestamp', 'm_timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	for (let name of ['includedImage', 'includedArtifact', 'suggestedPrompt', 'aspectRatio', 'accumulatedChanges']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_content[name]; }});
	}
	_['public'].toJSON=function () {
		let {id, sender, text, timestamp, includedImage, includedArtifact, suggestedPrompt, aspectRatio, accumulatedChanges}=this;
		return {id, sender, text, timestamp, includedImage, includedArtifact, suggestedPrompt, aspectRatio, accumulatedChanges};
	};
	_['private'].m_id=null;
	_['private'].m_sender=null;
	_['private'].m_text=null;
	_['private'].m_timestamp=null;
	_['private'].m_content=null;
});
