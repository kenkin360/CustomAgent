var MessageContent=Function.extend(Object, function () {
	var _=this(MessageContent);
	MessageContent=_[MessageContent];
	function MessageContent(value={}) {
		_['base'].apply(this, arguments);
		this.IncludedImage=value.includedImage?new ImageArtifact(value.includedImage):undefined;
		this.IncludedArtifact=Artifact.From(value.includedArtifact);
		this.SuggestedPrompt=value.suggestedPrompt;
		this.AspectRatio=value.aspectRatio;
		this.AccumulatedChanges=value.accumulatedChanges?.slice();
	}
	_['public'].IncludedImage=null;
	_['public'].IncludedArtifact=null;
	_['public'].SuggestedPrompt=null;
	_['public'].AspectRatio=null;
	_['public'].AccumulatedChanges=null;
});
