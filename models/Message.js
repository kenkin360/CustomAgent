var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];
	function Message(value={}) {
		_['base'].apply(this, arguments);
		this.Id=value.id;
		this.Sender=value.sender;
		this.Text=value.text;
		this.Timestamp=value.timestamp;
		this.IncludedImage=Media.From(value.includedImage);
		this.IncludedArtifact=value.includedArtifact;
		this.SuggestedPrompt=value.suggestedPrompt;
		this.AspectRatio=value.aspectRatio;
		this.AccumulatedChanges=value.accumulatedChanges?.slice();
	}
	_['public'].toJSON=function () {
		return {id: this.Id, sender: this.Sender, text: this.Text, timestamp: this.Timestamp, includedImage: this.IncludedImage?{...this.IncludedImage.toJSON(), data: this.IncludedImage.Data}:undefined, includedArtifact: this.IncludedArtifact, suggestedPrompt: this.SuggestedPrompt, aspectRatio: this.AspectRatio, accumulatedChanges: this.AccumulatedChanges?.slice()};
	};
	_['public'].Id=null;
	_['public'].Sender=null;
	_['public'].Text=null;
	_['public'].Timestamp=null;
	_['public'].IncludedImage=null;
	_['public'].IncludedArtifact=null;
	_['public'].SuggestedPrompt=null;
	_['public'].AspectRatio=null;
	_['public'].AccumulatedChanges=null;
});
