var Turn=Function.extend(Object, function () {
	var _=this(Turn);
	Turn=_[Turn];
	function Turn() {
		_['base'].apply(this, arguments);
		this.Cancelled=false;
	}
	_['public'].Cancelled=null;
});
