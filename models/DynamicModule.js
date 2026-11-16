var DynamicModule=Function.extend(Object, function () {
	var _=this(DynamicModule);
	DynamicModule=_[DynamicModule];
	function DynamicModule(name) {
		_['base'].apply(this, arguments);
		this.Name=name;
		this.Time=new Date().toLocaleTimeString();
	}
	_['public'].Name=null;
	_['public'].Time=null;
});
