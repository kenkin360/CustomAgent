var ImageArtifact=Function.extend(Artifact, function () {
	var _=this(ImageArtifact);
	ImageArtifact=_[ImageArtifact];
	function ImageArtifact(value={}) {
		let data=value instanceof Artifact?value.ToJSON():value;
		_['base'].call(this, {...data, kind: 'image'});
		_(this).m_dimensions=new Dimensions(data);
	}
	_['public'].GetDimensions=function () { return _(this).m_dimensions; };
	_['public'].ToJSON=function () {
		let dimensions=this.GetDimensions();
		return {...Artifact.prototype.ToJSON.call(this), width: dimensions.Width, height: dimensions.Height, aspectRatio: dimensions.AspectRatio};
	};
	_['private'].m_dimensions=null;
});
