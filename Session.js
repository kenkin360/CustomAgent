var Session=Function.extend(Object, function () {
	var _=this(Session);
	Session=_[Session];
	function Session() {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_state=new AgentState();
		$this.m_listeners=new Set();
		$this.m_activeTurn=null;
		$this.m_ready=null;
	}
	for (let [name, field] of [['State', 'm_state'], ['Listeners', 'm_listeners'], ['ActiveTurn', 'm_activeTurn'], ['Ready', 'm_ready']]) {
		Object.defineProperty(_['public'], name, {get() { return _(this)[field]; }, set(value) { _(this)[field]=value; }});
	}
	_['private'].m_state=null;
	_['private'].m_listeners=null;
	_['private'].m_activeTurn=null;
	_['private'].m_ready=null;
});
