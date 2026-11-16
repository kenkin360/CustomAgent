var AgentState=Function.extend(Object, function () {
	var _=this(AgentState);
	AgentState=_[AgentState];
	function AgentState() {
		_['base'].apply(this, arguments);
		this.Media=new MediaState();
		this.Draft=new DraftState();
		this.Chat=new ChatState();
	}
	_['public'].Apply=function (patch) {
		this.Media.Apply(patch);
		this.Draft.Apply(patch);
		this.Chat.Apply(patch);
	};
	_['public'].ToSnapshot=function () {
		let media=this.Media;
		let draft=this.Draft;
		let chat=this.Chat;
		return {
			activeImage: media.ActiveImage?.ToJSON()
			, currentArtifact: media.CurrentArtifact?.ToJSON()
			, history: media.History.map((image)=>image.ToJSON())
			, isGenerating: media.IsGenerating
			, selectedRatio: draft.SelectedRatio
			, accumulatedChanges: [...draft.AccumulatedChanges]
			, generationPrompt: draft.GenerationPrompt
			, messages: chat.Messages.map((message)=>message.ToJSON())
			, inputText: chat.InputText
			, isConsulting: chat.IsConsulting
		};
	};
	_['public'].Media=null;
	_['public'].Draft=null;
	_['public'].Chat=null;
});
