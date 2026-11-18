var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];
	function Message(value={}) {
		_['base'].apply(this, arguments);
		this.Id=value.Id||value.id;
		this.Sender=value.Sender||value.sender;
		this.Text=value.Text||value.text;
		this.Timestamp=value.Timestamp||value.timestamp;
		this.IncludedMedia=value.IncludedMedia||value.includedMedia;
		this.SuggestedPrompt=value.SuggestedPrompt||value.suggestedPrompt;
	}

	_['public'].Id=null;
	_['public'].Sender=null;
	_['public'].Text=null;
	_['public'].Timestamp=null;
	_['public'].IncludedMedia=null;
	_['public'].SuggestedPrompt=null;
});
