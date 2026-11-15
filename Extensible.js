var Extensible=Function.extend(Object, function () {
	var _=this(Extensible);
	Extensible=_[Extensible];

	function Extensible() {
		_['base'].apply(this, arguments);
	}
});
