var Mount=Function.extend(Object, function () {
	var _=this(Mount);
	Mount=_[Mount];
	function Mount(element, slot) {
		_['base'].apply(this, arguments);
		this.Element=element;
		this.Slot=slot;
	}
});
