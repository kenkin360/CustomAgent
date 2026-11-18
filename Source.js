var Source=Function.extend(Object, function () {
	var _=this(Source);
	Source=_[Source];

	function Source(name, value, readyMember, remote=true) {
		_['base'].apply(this, arguments);
		this.Name=name;
		this.Value=value;
		this.ReadyMember=readyMember;
		this.Remote=remote;
	}

	_['public'].Name=null;
	_['public'].Value=null;
	_['public'].ReadyMember=null;
	_['public'].Remote=null;

	_['public'].Read=async function () {
		if (!this.Remote) {
			return {message: `${this.Name}:\n${this.Value}`};
		}

		try {
			let response=await fetch(this.Value);
			if (!response.ok) {
				return Helper.Error(`Failed to read ${this.Name}: HTTP ${response.status}`);
			}

			return {message: `${this.Name}:\n${await response.text()}`};
		}
		catch (error) {
			return Helper.Error(error);
		}
	};

	Source.GetInstance=function (name, value, readyMember) {
		let instance=Source.Instances.find((entry)=>entry.Name===name);
		if (!instance&&value) {
			instance=new Source(name, value, readyMember);
			Source.Instances.push(instance);
		}

		return instance;
	};

	Source.Instances=[];
});
