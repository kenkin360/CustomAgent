var ChatState=Function.extend(Object, function () {
	var _=this(ChatState);
	ChatState=_[ChatState];
	function ChatState() {
		_['base'].apply(this, arguments);
		this.Messages=[];
		this.InputText='';
		this.IsConsulting=false;
	}
	_['public'].Apply=function (patch) {
		if ('messages' in patch) this.Messages=patch.messages.map((entry)=>entry instanceof Message?entry:new Message(entry));
		if ('inputText' in patch) this.InputText=patch.inputText;
		if ('isConsulting' in patch) this.IsConsulting=patch.isConsulting;
	};
	_['public'].Messages=null;
	_['public'].InputText=null;
	_['public'].IsConsulting=null;
});
