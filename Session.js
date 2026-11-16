var Turn=Function.extend(Object, function () {
	var _=this(Turn);
	Turn=_[Turn];
	function Turn() {
		_['base'].apply(this, arguments);
		_(this).m_cancelled=false;
	}
	Object.defineProperty(_['public'], 'cancelled', {get() { return _(this).m_cancelled; }, set(value) { _(this).m_cancelled=!!value; }});
	_['private'].m_cancelled=false;
});

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
