var AgentState=Function.extend(Object, function () {
	var _=this(AgentState);
	AgentState=_[AgentState];
	function AgentState() {
		_['base'].apply(this, arguments);
		this.ActiveImage=null;
		this.CurrentArtifact=null;
		this.History=[];
		this.IsGenerating=false;
		this.SelectedRatio='original';
		this.AccumulatedChanges=[];
		this.GenerationPrompt='';
		this.Messages=[];
		this.InputText='';
		this.IsConsulting=false;
		this.Labels=new Map();
		this.MediaIds=new Map();
	}
	_['public'].Remember=function (media, value) {
		if (!media||!value) return;
		if (value.title) this.Labels.set(media.Id, value.title);
		if (value.mediaId) this.MediaIds.set(media.Id, value.mediaId);
	};
	_['public'].Apply=function (patch) {
		if ('activeImage' in patch) {
			this.ActiveImage=patch.activeImage?Media.From(patch.activeImage):null;
			this.Remember(this.ActiveImage, patch.activeImage);
		}
		if ('currentArtifact' in patch) {
			this.CurrentArtifact=Media.From(patch.currentArtifact);
			this.Remember(this.CurrentArtifact, patch.currentArtifact);
		}
		if ('history' in patch) {
			this.History=patch.history.map((image)=>Media.From(image));
			for (let i=0; i<this.History.length; i++) this.Remember(this.History[i], patch.history[i]);
		}
		if ('isGenerating' in patch) this.IsGenerating=patch.isGenerating;
		if ('selectedRatio' in patch) this.SelectedRatio=patch.selectedRatio;
		if ('accumulatedChanges' in patch) this.AccumulatedChanges=patch.accumulatedChanges.filter((item)=>'string'===typeof item);
		if ('generationPrompt' in patch) this.GenerationPrompt=patch.generationPrompt;
		if ('messages' in patch) this.Messages=patch.messages.map((entry)=>entry instanceof Message?entry:new Message(entry));
		if ('inputText' in patch) this.InputText=patch.inputText;
		if ('isConsulting' in patch) this.IsConsulting=patch.isConsulting;
	};
	_['public'].ToSnapshot=function () {
		let describe=(media)=>media?{...media.toJSON(), data: media.Data, title: this.Labels.get(media.Id), mediaId: this.MediaIds.get(media.Id)}:null;
		return {
			activeImage: describe(this.ActiveImage)
			, currentArtifact: describe(this.CurrentArtifact)
			, history: this.History.map(describe)
			, isGenerating: this.IsGenerating
			, selectedRatio: this.SelectedRatio
			, accumulatedChanges: this.AccumulatedChanges.slice()
			, generationPrompt: this.GenerationPrompt
			, messages: this.Messages.map((message)=>message.toJSON())
			, inputText: this.InputText
			, isConsulting: this.IsConsulting
		};
	};
	_['public'].ActiveImage=null;
	_['public'].CurrentArtifact=null;
	_['public'].History=null;
	_['public'].IsGenerating=null;
	_['public'].SelectedRatio=null;
	_['public'].AccumulatedChanges=null;
	_['public'].GenerationPrompt=null;
	_['public'].Messages=null;
	_['public'].InputText=null;
	_['public'].IsConsulting=null;
	_['public'].Labels=null;
	_['public'].MediaIds=null;
});
