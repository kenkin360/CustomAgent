var AgentState=Function.extend(Object, function () {
	var _=this(AgentState);
	AgentState=_[AgentState];
	function AgentState() {
		_['base'].apply(this, arguments);
		this.ActiveMedia=null;
		this.CurrentMedia=null;
		this.History=[];
		this.IsGenerating=false;
		this.SelectedRatio='original';
		this.AccumulatedChanges=[];
		this.GenerationPrompt='';
		this.Messages=[];
		this.InputText='';
		this.IsConsulting=false;
	};

	_['public'].Apply=function (patch) {
		if ('activeMedia' in patch) {
			this.ActiveMedia=patch.activeMedia;
		}

		if ('currentMedia' in patch) {
			this.CurrentMedia=patch.currentMedia;
		}

		if ('history' in patch) {
			this.History=patch.history;
		}

		if ('isGenerating' in patch) { this.IsGenerating=patch.isGenerating; }

		if ('selectedRatio' in patch) { this.SelectedRatio=patch.selectedRatio; }

		if ('accumulatedChanges' in patch) { this.AccumulatedChanges=patch.accumulatedChanges.filter((item)=>'string'===typeof item); }

		if ('generationPrompt' in patch) { this.GenerationPrompt=patch.generationPrompt; }

		if ('messages' in patch) {
			this.Messages=patch.messages;
		}

		if ('inputText' in patch) { this.InputText=patch.inputText; }

		if ('isConsulting' in patch) { this.IsConsulting=patch.isConsulting; }
	};

	_['public'].ActiveMedia=null;
	_['public'].CurrentMedia=null;
	_['public'].History=null;
	_['public'].IsGenerating=null;
	_['public'].SelectedRatio=null;
	_['public'].AccumulatedChanges=null;
	_['public'].GenerationPrompt=null;
	_['public'].Messages=null;
	_['public'].InputText=null;
	_['public'].IsConsulting=null;
});
