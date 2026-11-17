var Helper=Function.extend(Function, function () {
	var _=this(Helper);
	Helper=_[Helper];

	function Helper() {
		_['base'].apply(this, arguments);
	}
	
	Helper.Error=function(x){
		console.error(x);
		return new Error(x);
	}
});
