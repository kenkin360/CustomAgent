var AgentState=Function.extend(Object, function () {
	var _=this(AgentState);
	AgentState=_[AgentState];
	function AgentState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_media=new MediaState();
		$this.m_draft=new DraftState();
		$this.m_chat=new ChatState();
	}
	for (let [owner, names] of [['m_media', ['activeImage', 'currentArtifact', 'history', 'isGenerating']], ['m_draft', ['selectedRatio', 'accumulatedChanges', 'generationPrompt']], ['m_chat', ['messages', 'inputText', 'isConsulting']]]) {
		for (let name of names) Object.defineProperty(_['public'], name, {get() { return _(this)[owner][name]; }, set(value) { _(this)[owner][name]=value; }});
	}
	_['public'].ToSnapshot=function () {
		let {activeImage, currentArtifact, history, isGenerating, selectedRatio, accumulatedChanges, generationPrompt, messages, inputText, isConsulting}=this;
		return {activeImage, currentArtifact, history: [...history], isGenerating, selectedRatio, accumulatedChanges: [...accumulatedChanges], generationPrompt, messages: [...messages], inputText, isConsulting};
	};
	_['private'].m_media=null;
	_['private'].m_draft=null;
	_['private'].m_chat=null;
});
