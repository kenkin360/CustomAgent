var Dimensions=Function.extend(Object, function () {
	var _=this(Dimensions);
	Dimensions=_[Dimensions];
	function Dimensions(value={}) {
		_['base'].apply(this, arguments);
		this.Width=value.width;
		this.Height=value.height;
		this.AspectRatio=value.aspectRatio;
	}
	_['public'].Width=null;
	_['public'].Height=null;
	_['public'].AspectRatio=null;
});
