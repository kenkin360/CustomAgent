var MediaState=Function.extend(Object, function () {
	var _=this(MediaState);
	MediaState=_[MediaState];
	function MediaState() {
		_['base'].apply(this, arguments);
		this.ActiveImage=null;
		this.CurrentArtifact=null;
		this.History=[];
		this.IsGenerating=false;
	}
	_['public'].Apply=function (patch) {
		if ('activeImage' in patch) this.ActiveImage=patch.activeImage?patch.activeImage instanceof ImageArtifact?patch.activeImage:new ImageArtifact(patch.activeImage):null;
		if ('currentArtifact' in patch) this.CurrentArtifact=Artifact.From(patch.currentArtifact);
		if ('history' in patch) this.History=patch.history.map((image)=>image instanceof ImageArtifact?image:new ImageArtifact(image));
		if ('isGenerating' in patch) this.IsGenerating=patch.isGenerating;
	};
	_['public'].ActiveImage=null;
	_['public'].CurrentArtifact=null;
	_['public'].History=null;
	_['public'].IsGenerating=null;
});
