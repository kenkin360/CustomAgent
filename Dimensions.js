var Dimensions=Function.extend(Object, function () {
	var _=this(Dimensions);
	Dimensions=_[Dimensions];
	function Dimensions(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_width=value.width;
		$this.m_height=value.height;
		$this.m_aspectRatio=value.aspectRatio;
	}
	for (let [name, field] of [['width', 'm_width'], ['height', 'm_height'], ['aspectRatio', 'm_aspectRatio']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_width=null;
	_['private'].m_height=null;
	_['private'].m_aspectRatio=null;
});
