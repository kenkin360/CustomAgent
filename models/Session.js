var Session=Function.extend(Object, function () {
	var _=this(Session);
	Session=_[Session];
	function Session() {
		_['base'].apply(this, arguments);
		this.State=new AgentState();
		this.Listeners=new Set();
		this.ActiveTurn=null;
		this.Ready=null;
	}
	_['public'].State=null;
	_['public'].Listeners=null;
	_['public'].ActiveTurn=null;
	_['public'].Ready=null;
});
