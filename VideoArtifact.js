var VideoArtifact=Function.extend(Artifact, function () {
	var _=this(VideoArtifact);
	VideoArtifact=_[VideoArtifact];
	function VideoArtifact(value={}) {
		let data=value instanceof Artifact?value.ToJSON():value;
		_['base'].call(this, {...data, kind: 'video'});
		_(this).m_details=new VideoDetails(data);
	}
	for (let name of ['durationSeconds', 'resolution', 'modelDisplayName']) {
		Object.defineProperty(_['public'], name, {get() { return _(this).m_details[name]; }});
	}
	_['public'].ToJSON=function () { return {...Artifact.prototype.ToJSON.call(this), durationSeconds: this.durationSeconds, resolution: this.resolution, modelDisplayName: this.modelDisplayName}; };
	_['private'].m_details=null;
});
