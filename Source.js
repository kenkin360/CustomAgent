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

	Source.Initialize=function (entries, hostSourceUrl) {
		Source.Entries=[...(entries||[]), ['DrawRectangle', Bundle.CustomAgent('Executables/DrawRectangle.js')], ['Upscale', Bundle.CustomAgent('Executables/Upscale.js')]].map(([name, url, readyMember])=>new Source(name, url, readyMember));
		Source.Compiled=new Map();
		Source.Installed=new Map();
		Source.Error=null;

		try {
			let prefix='data:text/javascript;base64,';
			if (!hostSourceUrl?.startsWith(prefix)) {
				Source.Error=Helper.Error('The bundled source is unavailable from import.meta.url.');
				return;
			}

			let bytes=Uint8Array.from(atob(hostSourceUrl.slice(prefix.length)), (char)=>char.charCodeAt(0));
			let code=new TextDecoder().decode(bytes);
			let markers=[...code.matchAll(/^\/\/ virtual:([^\r\n]+)\r?\n/gm)];
			if (!markers.length) {
				Source.Compiled.set('bundle', code);
				return;
			}

			markers.forEach((marker, index)=>{
				let start=marker.index+marker[0].length;
				let end=index+1<markers.length?markers[index+1].index:code.length;
				let name=marker[1].trim();
				Source.Compiled.set(name, (Source.Compiled.get(name)||'')+code.slice(start, end).replace(/^\/\/ virtual-export:default [^\r\n]+\r?\n/, ''));
			});
		}
		catch (error) {
			Source.Error=error;
		}
	};

	Source.CompiledNames=function () { return [...Source.Compiled.keys()]; };

	Source.InstalledNames=function () { return [...Source.Installed.keys()]; };

	Source.GetInstalled=function (name) { return Source.Installed.get(name); };

	Source.GetRemote=function (name) {
		return Source.Entries.find((entry)=>entry.Name===name||entry.Value.split(/[?#]/)[0].split('/').pop()===name);
	};

	Source.SetInstalled=function (name, entry) {
		if (entry) {
			Source.Installed.set(name, entry);
		}
		else {
			Source.Installed.delete(name);
		}
	};

	Source.ReadCompiledSource=function (args={}) {
		if (Source.Error) { return Helper.Error(Source.Error); }

		if ('string'!==typeof args.file) { return {message: `Compiled source files: ${JSON.stringify(Source.CompiledNames())}`}; }

		if (!Source.Compiled.has(args.file)) { return Helper.Error('Compiled source file not found: '+args.file); }

		return {message: `${args.file}:\n${Source.Compiled.get(args.file)}`};
	};

	Source.ReadRemoteSource=async function (args={}) {
		if ('string'!==typeof args.name) { return {message: `Remote source entries: ${JSON.stringify(Source.Entries.map((entry)=>({name: entry.Name, url: entry.Value, readyMember: entry.ReadyMember})))}`}; }

		let entry=Source.GetRemote(args.name);
		if (!entry) { return Helper.Error('Remote source not found: '+args.name); }

		let response=await fetch(entry.Value);
		if (!response.ok) { return Helper.Error(`Failed to read ${args.name}: HTTP ${response.status}`); }

		return {message: `${entry.Name}:\n${await response.text()}`};
	};

	Source.ReadInstalledSource=async function (args={}) {
		if ('string'!==typeof args.name) { return {message: `Installed modules: ${JSON.stringify(Source.InstalledNames())}`}; }

		let entry=Source.GetInstalled(args.name);
		if (!entry) { return Helper.Error('Installed module not found: '+args.name); }

		if (!entry.Remote) { return {message: `${args.name}:\n${entry.Value}`}; }

		let response=await fetch(entry.Value);
		if (!response.ok) { return Helper.Error(`Failed to read ${args.name}: HTTP ${response.status}`); }

		return {message: `${args.name}:\n${await response.text()}`};
	};

	Source.Dispose=function () {
		Source.Entries=[];
		Source.Compiled.clear();
		Source.Installed.clear();
		Source.Error=null;
	};

	Source.Entries=[];
	Source.Compiled=new Map();
	Source.Installed=new Map();
	Source.Error=null;
});
