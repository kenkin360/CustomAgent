var DynamicModule=Function.extend(Object, function () {
	var _=this(DynamicModule);
	DynamicModule=_[DynamicModule];
	function DynamicModule(name) {
		_['base'].apply(this, arguments);
		this.name=name;
		this.time=new Date().toLocaleTimeString();
	}
});
