var Message=Function.extend(Object, function () {
	var _=this(Message);
	Message=_[Message];

	function Message(text, media) {
		_['base'].apply(this, arguments);
		this.Text=text;
		this.IncludedMedia=media;
		this.Timestamp=new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
	}

	_['public'].Text=null;
	_['public'].IncludedMedia=null;
	_['public'].Timestamp=null;

	Message.User=Function.extend(Message, function () {
		var _=this(User);
		User=_[User];

		function User() {
			_['base'].apply(this, arguments);
		}
	});

	Message.Assistant=Function.extend(Message, function () {
		var _=this(Assistant);
		Assistant=_[Assistant];

		function Assistant() {
			_['base'].apply(this, arguments);
		}
	});

	Message.Error=Function.extend(Message, function () {
		var _=this(ErrorMessage);
		ErrorMessage=_[ErrorMessage];

		function ErrorMessage(error) {
			_['base'].call(this, error?.message||String(error));
		}
	});
});
