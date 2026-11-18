var Source=Function.extend(Object, function () {
	var _=this(Source);
	Source=_[Source];
	let metaUrl=null;

	function Source(name, value, readyMember, remote=true) {
		_['base'].apply(this, arguments);
		this.Name=name;
		this.Value=value;
		this.ReadyMember=readyMember;
		this.Remote=remote;
		_(this).m_content=remote?null:value;
	}

	_['public'].Name=null;
	_['public'].Value=null;
	_['public'].ReadyMember=null;
	_['public'].Remote=null;

	_['public'].Read=async function () {
		let $this=_(this);
		if ($this.m_content!==null) {
			return `${this.Name}:\n${$this.m_content}`;
		}

		try {
			let response=await fetch(this.Value);
			if (!response.ok) {
				return Helper.Error(`Failed to read ${this.Name}: HTTP ${response.status}`);
			}

			$this.m_content=await response.text();
		return `${this.Name}:\n${$this.m_content}`;
		}
		catch (error) {
			return Helper.Error(error);
		}
	};

	_['private'].m_content=null;

	Source.SetMetaUrl=function (url) {
		if (metaUrl!==null) {
			return metaUrl;
		}

		metaUrl=url;
		let prefix='data:text/javascript;base64,';

		if (!url?.startsWith(prefix)) {
			// return Helper.Error('The bundled source is unavailable from import.meta.url.');
		}

		try {
			let bytes=Uint8Array.from(atob(url.slice(prefix.length)), (char)=>char.charCodeAt(0));
			let code=new TextDecoder().decode(bytes);
			let markers=[...code.matchAll(/^\/\/ virtual:([^\r\n]+)\r?\n/gm)];
			let files=[];
			markers.forEach((marker, index)=>{
				let start=marker.index+marker[0].length;
				let end=index+1<markers.length?markers[index+1].index:code.length;
				let name=marker[1].trim();
				let value=code.slice(start, end).replace(/^\/\/ virtual-export:default [^\r\n]+\r?\n/, '');
				let file=files.find((entry)=>entry.Name===name);
				if (file) {
					file.Value+=value;
				}
				else {
					files.push({Name: name, Value: value});
				}
			});
			if (!markers.length) {
				files.push({Name: 'bundle', Value: code});
			}

			for (let file of files) {
				Source.Register(new Source(file.Name, file.Value, undefined, false));
			}
		}
		catch (error) {
			// return Helper.Error(error);
		}

		return metaUrl;		
	};

	Source.GetInstance=function (name) {
		return Source.Instances.find((entry)=>entry.Name===name);
	};

	Source.Register=function (instance) {
		let existing=Source.GetInstance(instance.Name);
		if (existing) {
			return existing;
		}

		Source.Instances.push(instance);
		return instance;
	};

	Source.Instances=[];
});
