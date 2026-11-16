var VideoDetails=Function.extend(Object, function () {
	var _=this(VideoDetails);
	VideoDetails=_[VideoDetails];
	function VideoDetails(value={}) {
		_['base'].apply(this, arguments);
		this.DurationSeconds=value.durationSeconds;
		this.Resolution=value.resolution;
		this.ModelDisplayName=value.modelDisplayName;
	}
	_['public'].DurationSeconds=null;
	_['public'].Resolution=null;
	_['public'].ModelDisplayName=null;
});
