var DraftState=Function.extend(Object, function () {
	var _=this(DraftState);
	DraftState=_[DraftState];
	function DraftState() {
		_['base'].apply(this, arguments);
		this.SelectedRatio='original';
		this.AccumulatedChanges=[];
		this.GenerationPrompt='';
	}
	_['public'].Apply=function (patch) {
		if ('selectedRatio' in patch) this.SelectedRatio=patch.selectedRatio;
		if ('accumulatedChanges' in patch) this.AccumulatedChanges=patch.accumulatedChanges.filter((item)=>'string'===typeof item);
		if ('generationPrompt' in patch) this.GenerationPrompt=patch.generationPrompt;
	};
	_['public'].SelectedRatio=null;
	_['public'].AccumulatedChanges=null;
	_['public'].GenerationPrompt=null;
});
