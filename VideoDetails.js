var VideoDetails=Function.extend(Object, function () {
	var _=this(VideoDetails);
	VideoDetails=_[VideoDetails];
	function VideoDetails(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_durationSeconds=value.durationSeconds;
		$this.m_resolution=value.resolution;
		$this.m_modelDisplayName=value.modelDisplayName;
	}
	for (let [name, field] of [['durationSeconds', 'm_durationSeconds'], ['resolution', 'm_resolution'], ['modelDisplayName', 'm_modelDisplayName']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_durationSeconds=null;
	_['private'].m_resolution=null;
	_['private'].m_modelDisplayName=null;
});
