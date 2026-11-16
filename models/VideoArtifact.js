var VideoArtifact=Function.extend(Artifact, function () {
	var _=this(VideoArtifact);
	VideoArtifact=_[VideoArtifact];
	function VideoArtifact(value={}) {
		let data=value instanceof Artifact?JSON.parse(JSON.stringify(value)):value;
		_['base'].call(this, {...data, kind: 'video'});
		_(this).m_details=new VideoDetails(data);
	}
	_['public'].GetDetails=function () { return _(this).m_details; };
	_['public'].toJSON=function () {
		let details=this.GetDetails();
		return {kind: this.Kind, id: this.Id, base64: this.Content.Base64, mimeType: this.Content.MimeType, mediaId: this.Content.MediaId, title: this.Provenance.Title, prompt: this.Provenance.Prompt, timestamp: this.Provenance.Timestamp, durationSeconds: details.DurationSeconds, resolution: details.Resolution, modelDisplayName: details.ModelDisplayName};
	};
	_['private'].m_details=null;
});
