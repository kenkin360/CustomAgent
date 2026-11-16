var Descriptor=Function.extend(Object, function () {
	var _=this(Descriptor);
	Descriptor=_[Descriptor];
	function Descriptor(value) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_value=value.value;
		$this.m_get=value.get;
		$this.m_set=value.set;
		$this.m_flags=(value.configurable?1:0)|(value.enumerable?2:0)|(value.writable?4:0);
	}
	Descriptor.Capture=function (target, name) {
		let value=Object.getOwnPropertyDescriptor(target, name);
		return value?new Descriptor(value):null;
	};
	_['public'].Restore=function (target, name) {
		let $this=_(this);
		let descriptor={configurable: !!($this.m_flags&1), enumerable: !!($this.m_flags&2)};
		if ($this.m_get||$this.m_set) {
			descriptor.get=$this.m_get;
			descriptor.set=$this.m_set;
		}
		else {
			descriptor.value=$this.m_value;
			descriptor.writable=!!($this.m_flags&4);
		}
		Object.defineProperty(target, name, descriptor);
	};
	_['private'].m_value=null;
	_['private'].m_get=null;
	_['private'].m_set=null;
	_['private'].m_flags=null;
});
