var Artifact=Function.extend(Object, function () {
	var _=this(Artifact);
	Artifact=_[Artifact];
	function Artifact(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_kind=value.kind;
		$this.m_id=value.id;
		$this.m_content=new MediaContent(value);
		$this.m_provenance=new Provenance(value);
	}
	Artifact.From=function (value) {
		if (!value||value instanceof Artifact) return value;
		if (value.kind==='image') return new ImageArtifact(value);
		if (value.kind==='video') return new VideoArtifact(value);
		return new Artifact(value);
	};
	for (let [name, field] of [['kind', 'm_kind'], ['id', 'm_id']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	for (let [name, owner, field] of [['base64', 'm_content', 'base64'], ['mimeType', 'm_content', 'mimeType'], ['mediaId', 'm_content', 'mediaId'], ['title', 'm_provenance', 'title'], ['prompt', 'm_provenance', 'prompt'], ['timestamp', 'm_provenance', 'timestamp']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[owner][field]; }});
	}
	_['public'].ToJSON=function () {
		let {kind, id, base64, mimeType, mediaId, title, prompt, timestamp}=this;
		return {kind, id, base64, mimeType, mediaId, title, prompt, timestamp};
	};
	_['public'].toJSON=function () { return this.ToJSON(); };
	_['private'].m_kind=null;
	_['private'].m_id=null;
	_['private'].m_content=null;
	_['private'].m_provenance=null;
});
