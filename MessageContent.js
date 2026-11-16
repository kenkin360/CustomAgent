var MessageContent=Function.extend(Object, function () {
	var _=this(MessageContent);
	MessageContent=_[MessageContent];
	function MessageContent(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_includedImage=value.includedImage?new ImageArtifact(value.includedImage):undefined;
		$this.m_includedArtifact=Artifact.From(value.includedArtifact);
		$this.m_suggestedPrompt=value.suggestedPrompt;
		$this.m_aspectRatio=value.aspectRatio;
		$this.m_accumulatedChanges=value.accumulatedChanges?.slice();
	}
	for (let [name, field] of [['includedImage', 'm_includedImage'], ['includedArtifact', 'm_includedArtifact'], ['suggestedPrompt', 'm_suggestedPrompt'], ['aspectRatio', 'm_aspectRatio'], ['accumulatedChanges', 'm_accumulatedChanges']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_includedImage=null;
	_['private'].m_includedArtifact=null;
	_['private'].m_suggestedPrompt=null;
	_['private'].m_aspectRatio=null;
	_['private'].m_accumulatedChanges=null;
});
