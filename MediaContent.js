var MediaContent=Function.extend(Object, function () {
	var _=this(MediaContent);
	MediaContent=_[MediaContent];
	function MediaContent(value={}) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_base64=value.base64;
		$this.m_mimeType=value.mimeType;
		$this.m_mediaId=value.mediaId;
	}
	for (let [name, field] of [['base64', 'm_base64'], ['mimeType', 'm_mimeType'], ['mediaId', 'm_mediaId']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }});
	}
	_['private'].m_base64=null;
	_['private'].m_mimeType=null;
	_['private'].m_mediaId=null;
});
