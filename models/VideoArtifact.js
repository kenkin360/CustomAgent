var VideoArtifact=Function.extend(Artifact, function () {
	var _=this(VideoArtifact);
	VideoArtifact=_[VideoArtifact];
	function VideoArtifact(value={}) {
		let data=value instanceof Artifact?value.toJSON():value;
		_['base'].call(this, {...data, kind: 'video'});
		_(this).m_details=new VideoDetails(data);
	}
	_['public'].GetDetails=function () { return _(this).m_details; };
	_['public'].toJSON=function () {
		let details=this.GetDetails();
		return {...Artifact.prototype.toJSON.call(this), durationSeconds: details.DurationSeconds, resolution: details.Resolution, modelDisplayName: details.ModelDisplayName};
	};
	_['private'].m_details=null;
});
