var ChatState=Function.extend(Object, function () {
	var _=this(ChatState);
	ChatState=_[ChatState];
	function ChatState() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_messages=[];
		$this.m_inputText='';
		$this.m_isConsulting=false;
	}
	for (let [name, field, convert] of [['messages', 'm_messages', (value)=>value.map((entry)=>entry instanceof Message?entry:new Message(entry))], ['inputText', 'm_inputText', (value)=>value], ['isConsulting', 'm_isConsulting', (value)=>value]]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=convert(value); }});
	}
	_['private'].m_messages=null;
	_['private'].m_inputText=null;
	_['private'].m_isConsulting=null;
});
