var Provenance=Function.extend(Object, function () {
	var _=this(Provenance);
	Provenance=_[Provenance];
	function Provenance(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_title=value.title;
		$this.m_prompt=value.prompt;
		$this.m_timestamp=value.timestamp;
	}
	for (let [name, field] of [['title', 'm_title'], ['prompt', 'm_prompt'], ['timestamp', 'm_timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_title=null;
	_['private'].m_prompt=null;
	_['private'].m_timestamp=null;
});
