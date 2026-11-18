var Executable=Function.extend(Object, function () {
	var _=this(Executable);
	Executable=_[Executable];

	function Executable() {
		_['base'].apply(this, arguments);
	}

	_['public'].Name=null;

	_['public'].Run=async function () {
		return Helper.Error('This executable has no Run method.');
	};

	_['public'].Dispose=function () {
		return null;
	};

	_['public'].Initialize=function () {
		return null;
	};

	function Track(operation, description) {
		let execution=Executable.CurrentExecution;
		let task=Promise.resolve(operation).then((result)=>{
			execution?.Changes.push({Operation: description, Result: result instanceof Error?result.message:'completed'});
			return result;
		}, (error)=>{
			let failure=Helper.Error(error);
			execution?.Changes.push({Operation: description, Result: failure.message});
			return failure;
		});

		execution?.Pending.push(task);
		return task;
	}

	Executable.Create=function (name, executableClass) {
		if ('string'!==typeof name||!/^[A-Za-z_$][\w$]*$/.test(name)) {
			return Helper.Error('Provide a valid executable name.');
		}

		if ('function'!==typeof executableClass||!(executableClass.prototype instanceof Executable)) {
			return Helper.Error('Provide a class derived from Executable.');
		}

		try {
			let instance=new executableClass();
			instance.Name=name;
			return instance;
		}
		catch (error) {
			return Helper.Error(error);
		}
	};

	Executable.GetInstance=function (name) {
		return Executable.Instances.find((instance)=>instance.Name===name);
	};

	Executable.GetNames=function () {
		return Executable.Instances.map((instance)=>instance.Name);
	};

	Executable.Initialize=function (sourceFiles, hostSourceUrl, names) {
		if (Executable.Shutdown) {
			return Executable.Shutdown.then(()=>Executable.Initialize(sourceFiles, hostSourceUrl, names));
		}

		if (!Executable.Startup) {
			Source.Initialize(sourceFiles, hostSourceUrl);
			Executable.Startup=(async ()=>{
				for (let name of names) {
					if (Executable.GetInstance(name)) {
						continue;
					}

					let source=Source.GetRemote(name);
					if (!source) {
						return Helper.Error('Executable source not found: '+name);
					}

					let executableClass=await new Resource.Module(name, source.Value);
					let instance=Executable.Create(name, executableClass);
					if (instance instanceof Error) {
						return instance;
					}

					let result=await instance.Initialize();
					if (result instanceof Error) {
						return result;
					}

					Executable.Instances.push(instance);
					Source.SetInstalled(name, source);
				}
			})().then((result)=>{
				if (result instanceof Error) {
					Executable.Startup=null;
				}

				return result;
			}, (error)=>{
				Executable.Startup=null;
				return Helper.Error(error);
			});
		}

		return Executable.Startup;
	};

	Executable.Remove=async function (instance, app) {
		let error=null;
		try {
			error=await instance.Dispose();
		}
		catch (failure) {
			error=Helper.Error(failure);
		}

		try {
			app.Unmount(instance.Name);
		}
		catch (failure) {
			error||=Helper.Error(failure);
		}

		return error instanceof Error?error:null;
	};

	Executable.Install=function (name, executableClass, source, app) {
		return Track((async ()=>{
			let instance=Executable.Create(name, executableClass);
			if (instance instanceof Error) {
				return instance;
			}

			let previous=Executable.GetInstance(name);
			let previousSource=Source.GetInstalled(name);
			if (previous) {
				let error=await Executable.Remove(previous, app);
				if (error) {
					return error;
				}

				Executable.Instances.splice(Executable.Instances.indexOf(previous), 1);
			}

			Executable.Instances.push(instance);
			Source.SetInstalled(name, new Source(name, source, undefined, false));
			let failure=null;
			try {
				let result=await instance.Initialize();
				if (result instanceof Error) {
					failure=result;
				}
			}
			catch (error) {
				failure=Helper.Error(error);
			}

			if (failure) {
				await Executable.Remove(instance, app);
				Executable.Instances.splice(Executable.Instances.indexOf(instance), 1);
				Source.SetInstalled(name, previousSource);
				if (previous) {
					Executable.Instances.push(previous);
					try {
						let restored=await previous.Initialize();
						if (restored instanceof Error) {
							return restored;
						}
					}
					catch (error) {
						return Helper.Error(error);
					}
				}

				return failure;
			}

			Executable.Versions.push({Name: name, Previous: previous, PreviousSource: previousSource, Current: instance});
			return instance;
		})(), `Install ${name}`);
	};

	Executable.Rollback=function (app) {
		return Track((async ()=>{
			let installation=Executable.Versions.at(-1);
			if (!installation) {
				return Helper.Error('No executable installation is available to undo.');
			}

			let error=await Executable.Remove(installation.Current, app);
			if (error) {
				return error;
			}

			Executable.Instances.splice(Executable.Instances.indexOf(installation.Current), 1);
			if (installation.Previous) {
				Executable.Instances.push(installation.Previous);
			}

			Source.SetInstalled(installation.Name, installation.PreviousSource);
			Executable.Versions.pop();
			if (installation.Previous) {
				try {
					let result=await installation.Previous.Initialize();
					if (result instanceof Error) {
						return result;
					}
				}
				catch (failure) {
					return Helper.Error(failure);
				}
			}

			return installation.Previous||null;
		})(), 'Rollback');
	};

	Executable.Uninstall=function (name, app) {
		return Track((async ()=>{
			let instance=Executable.GetInstance(name);
			if (!instance) {
				return Helper.Error('Executable is not installed: '+name);
			}

			let error=await Executable.Remove(instance, app);
			if (error) {
				return error;
			}

			Executable.Instances.splice(Executable.Instances.indexOf(instance), 1);
			Source.SetInstalled(name, null);
			Executable.Versions=Executable.Versions.filter((entry)=>entry.Name!==name);
			return null;
		})(), `Uninstall ${name}`);
	};

	Executable.Execute=async function (code, app, context, apply) {
		let execution={Code: code, Reply: null, Error: null, Changes: [], Pending: []};
		Executable.Executions.push(execution);
		Executable.CurrentExecution=execution;
		try {
			let AsyncFunction=(async function () {}).constructor;
			let Run=new AsyncFunction('Executable', 'app', 'context', 'apply', 'source', code+'\n//# sourceURL=CustomAgentGenerated.js');
			execution.Reply=await Run(Executable, app, context, (result)=>Track(apply(result), 'Apply media'), code);
		}
		catch (error) {
			execution.Error=error instanceof Error?error:Helper.Error(error);
		}

		let results=await Promise.all(execution.Pending);
		Executable.CurrentExecution=null;
		execution.Error||=results.find((result)=>result instanceof Error)||null;
		if (execution.Reply instanceof Error) {
			execution.Error||=execution.Reply;
		}

		if (!execution.Error&&'string'!==typeof execution.Reply) {
			execution.Error=Helper.Error('Generated code must return a string.');
		}

		return execution.Error||execution.Reply;
	};

	Executable.DisposeAll=function (app) {
		if (!Executable.Shutdown) {
			Executable.Shutdown=(async ()=>{
				await Executable.Startup;
				let instances=Executable.Instances;
				Executable.Instances=[];
				Executable.Versions=[];
				Executable.Executions=[];
				Executable.CurrentExecution=null;
				Executable.Startup=null;
				let failures=[];
				for (let instance of instances) {
					let error=await Executable.Remove(instance, app);
					if (error) {
						failures.push(error);
					}
				}

				Source.Dispose();
				Executable.Shutdown=null;
				return failures[0]||null;
			})().catch((error)=>{
				Executable.Shutdown=null;
				return Helper.Error(error);
			});
		}

		return Executable.Shutdown;
	};

	Executable.Instances=[];
	Executable.Versions=[];
	Executable.Executions=[];
	Executable.CurrentExecution=null;
	Executable.Startup=null;
	Executable.Shutdown=null;
});
