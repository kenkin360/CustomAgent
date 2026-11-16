var Provenance=Function.extend(Object, function () {
	var _=this(Provenance);
	Provenance=_[Provenance];
	function Provenance(value={}) {
		_['base'].apply(this, arguments);
		this.Title=value.title;
		this.Prompt=value.prompt;
		this.Timestamp=value.timestamp;
	}
	_['public'].Title=null;
	_['public'].Prompt=null;
	_['public'].Timestamp=null;
});
