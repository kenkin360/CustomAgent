var MediaContent=Function.extend(Object, function () {
	var _=this(MediaContent);
	MediaContent=_[MediaContent];
	function MediaContent(value={}) {
		_['base'].apply(this, arguments);
		this.Base64=value.base64;
		this.MimeType=value.mimeType;
		this.MediaId=value.mediaId;
	}
	_['public'].Base64=null;
	_['public'].MimeType=null;
	_['public'].MediaId=null;
});
