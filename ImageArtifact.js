var ImageArtifact=Function.extend(Artifact, function () {
	var _=this(ImageArtifact);
	ImageArtifact=_[ImageArtifact];
	function ImageArtifact(value={}) {
		let data=value instanceof Artifact?value.ToJSON():value;
		_['base'].call(this, {...data, kind: 'image'});
		_(this).m_dimensions=new Dimensions(data);
	}
	for (let name of ['width', 'height', 'aspectRatio']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_dimensions[name]; }});
	}
	_['public'].ToJSON=function () { return {...Artifact.prototype.ToJSON.call(this), width: this.width, height: this.height, aspectRatio: this.aspectRatio}; };
	_['private'].m_dimensions=null;
});
