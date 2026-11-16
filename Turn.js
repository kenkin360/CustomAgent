var Turn=Function.extend(Object, function () {
	var _=this(Turn);
	Turn=_[Turn];
	function Turn() {
		_['base'].apply(this, arguments);
		_(this).m_cancelled=false;
	}
	Object.defineProperty(_['public'], 'cancelled', {get() { return _(this).m_cancelled; }, set(value) { _(this).m_cancelled=!!value; }});
	_['private'].m_cancelled=false;
});
