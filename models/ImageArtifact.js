var ImageArtifact=Function.extend(Artifact, function () {
	var _=this(ImageArtifact);
	ImageArtifact=_[ImageArtifact];
	function ImageArtifact(value={}) {
		let data=value instanceof Artifact?JSON.parse(JSON.stringify(value)):value;
		_['base'].call(this, {...data, kind: 'image'});
		_(this).m_dimensions=new Dimensions(data);
	}
	_['public'].GetDimensions=function () { return _(this).m_dimensions; };
	_['public'].toJSON=function () {
		let dimensions=this.GetDimensions();
		return {kind: this.Kind, id: this.Id, base64: this.Content.Base64, mimeType: this.Content.MimeType, mediaId: this.Content.MediaId, title: this.Provenance.Title, prompt: this.Provenance.Prompt, timestamp: this.Provenance.Timestamp, width: dimensions.Width, height: dimensions.Height, aspectRatio: dimensions.AspectRatio};
	};
	_['private'].m_dimensions=null;
});
