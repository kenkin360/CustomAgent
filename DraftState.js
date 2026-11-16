var DraftState=Function.extend(Object, function () {
	var _=this(DraftState);
	DraftState=_[DraftState];
	function DraftState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_selectedRatio='original';
		$this.m_accumulatedChanges=[];
		$this.m_generationPrompt='';
	}
	for (let [name, field, convert] of [['selectedRatio', 'm_selectedRatio', (value)=>value], ['generationPrompt', 'm_generationPrompt', (value)=>value], ['accumulatedChanges', 'm_accumulatedChanges', (value)=>value.filter((item)=>typeof item==='string')]]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	}
	_['private'].m_selectedRatio=null;
	_['private'].m_accumulatedChanges=null;
	_['private'].m_generationPrompt=null;
});
