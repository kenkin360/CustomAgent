var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];
	function Message(value={}) {
		_['base'].apply(this, arguments);
		this.Id=value.id;
		this.Sender=value.sender;
		this.Text=value.text;
		this.Timestamp=value.timestamp;
		this.Content=new MessageContent(value);
	}
	_['public'].toJSON=function () {
		let content=this.Content;
		return {id: this.Id, sender: this.Sender, text: this.Text, timestamp: this.Timestamp, includedImage: content.IncludedImage, includedArtifact: content.IncludedArtifact, suggestedPrompt: content.SuggestedPrompt, aspectRatio: content.AspectRatio, accumulatedChanges: content.AccumulatedChanges};
	};
	_['public'].Id=null;
	_['public'].Sender=null;
	_['public'].Text=null;
	_['public'].Timestamp=null;
	_['public'].Content=null;
});
