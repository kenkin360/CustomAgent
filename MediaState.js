var MediaState=Function.extend(Object, function () {
	var _=this(MediaState);
	MediaState=_[MediaState];
	function MediaState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_activeImage=null;
		$this.m_currentArtifact=null;
		$this.m_history=[];
		$this.m_isGenerating=false;
	}
	for (let [name, field, convert] of [
		['activeImage', 'm_activeImage', (value)=>value?value instanceof ImageArtifact?value:new ImageArtifact(value):null]
		, ['currentArtifact', 'm_currentArtifact', Artifact.From]
		, ['history', 'm_history', (value)=>value.map((image)=>image instanceof ImageArtifact?image:new ImageArtifact(image))]
		, ['isGenerating', 'm_isGenerating', (value)=>value]
	]) Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	_['private'].m_activeImage=null;
	_['private'].m_currentArtifact=null;
	_['private'].m_history=null;
	_['private'].m_isGenerating=null;
});
