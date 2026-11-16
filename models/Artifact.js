var Artifact=Function.extend(Object, function () {
	var _=this(Artifact);
	Artifact=_[Artifact];
	function Artifact(value={}) {
		_['base'].apply(this, arguments);
		this.Kind=value.kind;
		this.Id=value.id;
		this.Content=new MediaContent(value);
		this.Provenance=new Provenance(value);
	}
	Artifact.From=function (value) {
		if (!value||value instanceof Artifact) return value;
		if ('image'===value.kind) return new ImageArtifact(value);
		if ('video'===value.kind) return new VideoArtifact(value);
		return new Artifact(value);
	};
	_['public'].toJSON=function () {
		return {kind: this.Kind, id: this.Id, base64: this.Content.Base64, mimeType: this.Content.MimeType, mediaId: this.Content.MediaId, title: this.Provenance.Title, prompt: this.Provenance.Prompt, timestamp: this.Provenance.Timestamp};
	};
	_['public'].Kind=null;
	_['public'].Id=null;
	_['public'].Content=null;
	_['public'].Provenance=null;
});
