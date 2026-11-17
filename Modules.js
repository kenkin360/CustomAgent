var Modules=Function.extend(Object, function () {
	var _=this(Modules);
	Modules=_[Modules];

	function Modules(sources) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_sources=sources;
		$this.m_versions=[];
		$this.m_startup=null;
	}

	_['public'].GetSources=function () { return _(this).m_sources; };

	_['public'].GetRuntime=function () {
		let runtime=globalThis.AppRuntime||=Object.create(null);
		runtime.Modules||=Object.create(null);
		return runtime;
	};

	_['public'].GetNames=function () { return Object.keys(this.GetRuntime().Modules); };

	_['public'].Initialize=function () {
		let $this=_(this);
		if (!$this.m_startup) {
			$this.m_startup=(async ()=>{
				let runtime=this.GetRuntime().Modules;
				for (let name of ['DrawRectangle', 'Upscale']) {
					let url=Bundle.CustomAgent(name+'.js');
					runtime[name]=await new Resource.Module(name, url);
					$this.m_sources.SetInstalled(name, new Source(name, url));
				}
			})().catch((error)=>{
				$this.m_startup=null;
				return Helper.Error(error);
			});
		}

		return $this.m_startup;
	};

	_['private'].Dispose=async function (name, Type) {
		let disposable='function'===typeof Type?.Dispose?Type:Type?.Default;
		if ('function'===typeof disposable?.Dispose) {
			try {
				let result=await disposable.Dispose();
				if (result instanceof Error) {
					return result;
				}
			}
			catch (error) {
				return Helper.Error(error);
			}
		}

		this.GetRuntime().UI?.Unmount(name);
		return null;
	};

	_['public'].Install=async function (name, Type, code) {
		if ('string'!==typeof name||!/^[A-Za-z_$][\w$]*$/.test(name)) {
			return Helper.Error('Provide a valid module name.');
		}

		if ('function'!==typeof Type) {
			return Helper.Error('Provide a module class.');
		}

		let $this=_(this);
		let runtime=this.GetRuntime().Modules;
		let previous=runtime[name];
		let previousSource=$this.m_sources.GetInstalled(name);
		let error=await $this.Dispose(name, previous);
		if (error) {
			return error;
		}

		runtime[name]=Type;
		$this.m_sources.SetInstalled(name, new Source(name, code, undefined, false));
		$this.m_versions.push({Name: name, Previous: previous, PreviousSource: previousSource, Current: Type});
		return Type;
	};

	_['public'].Rollback=async function () {
		let $this=_(this);
		let installation=$this.m_versions.at(-1);
		if (!installation) {
			return Helper.Error('No module installation is available to undo.');
		}

		let error=await $this.Dispose(installation.Name, installation.Current);
		if (error) {
			return error;
		}

		let runtime=this.GetRuntime().Modules;
		if (installation.Previous) {
			runtime[installation.Name]=installation.Previous;
		}
		else {
			delete runtime[installation.Name];
		}

		$this.m_sources.SetInstalled(installation.Name, installation.PreviousSource);
		$this.m_versions.pop();
		if ('function'===typeof installation.Previous?.Initialize) {
			try {
				let result=await installation.Previous.Initialize();
				if (result instanceof Error) {
					return result;
				}
			}
			catch (error) {
				return Helper.Error(error);
			}
		}

		return installation.Previous||null;
	};

	_['public'].Uninstall=async function (name) {
		let $this=_(this);
		let runtime=this.GetRuntime().Modules;
		if (!Object.prototype.hasOwnProperty.call(runtime, name)) {
			return Helper.Error('Module is not installed: '+name);
		}

		let error=await $this.Dispose(name, runtime[name]);
		if (error) {
			return error;
		}

		delete runtime[name];
		$this.m_sources.SetInstalled(name, null);
		$this.m_versions=$this.m_versions.filter((entry)=>entry.Name!==name);
		return null;
	};

	_['private'].m_sources=null;
	_['private'].m_versions=null;
	_['private'].m_startup=null;
});
