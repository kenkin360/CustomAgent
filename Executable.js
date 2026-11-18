var Executable=Function.extend(Object, function () {
	var _=this(Executable);
	Executable=_[Executable];

	function Executable(name, source) {
		_['base'].apply(this, arguments);
		this.Name=name;
		this.Source=source;
	}

	_['public'].Name=null;
	_['public'].Source=null;

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

	Executable.GetInstance=function (name) {
		return Executable.Instances.find((instance)=>instance.Name===name);
	};

	Executable.GetNames=function () {
		return Executable.Instances.map((instance)=>instance.Name);
	};

	Executable.Load=async function (source, app) {
		if (!(source instanceof Source)||!source.Remote) {
			return Helper.Error('Provide a remote executable source.');
		}

		try {
			let executableClass=await new Resource.Module(source.Name, source.Value, source.ReadyMember);
			return await Executable.Install(source.Name, executableClass, source, app);
		}
		catch (error) {
			return Helper.Error(error);
		}
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
			if ('string'!==typeof name||!/^[A-Za-z_$][\w$]*$/.test(name)) {
				return Helper.Error('Provide a valid executable name.');
			}

			if ('function'!==typeof executableClass||!(executableClass.prototype instanceof Executable)) {
				return Helper.Error('Provide a class derived from Executable.');
			}

			let instance;
			try {
				instance=new executableClass(name, source instanceof Source?source:new Source(name, source, undefined, false));
			}
			catch (error) {
				return Helper.Error(error);
			}

			if (instance.Name!==name) {
				return Helper.Error('The executable constructor must call its base constructor.');
			}

			let previous=Executable.GetInstance(name);
			if (previous) {
				let error=await Executable.Remove(previous, app);
				if (error) {
					return error;
				}

				Executable.Instances.splice(Executable.Instances.indexOf(previous), 1);
			}

			Executable.Instances.push(instance);
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

			Executable.Versions.push({Name: name, Previous: previous, Current: instance});
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
			let Run=new AsyncFunction('Executable', 'app', 'context', 'run', 'apply', 'source', code+'\n//# sourceURL=CustomAgentGenerated.js');
			execution.Reply=await Run(Executable, app, context, (name, args)=>Track((async ()=>{
				let instance=Executable.GetInstance(name);
				if (!instance) {
					return Helper.Error('Executable is not installed: '+name);
				}

				return instance.Run(args, context);
			})(), `Run ${name}`), (result)=>Track(apply(result), 'Apply media'), code);
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

	Executable.Instances=[];
	Executable.Versions=[];
	Executable.Executions=[];
	Executable.CurrentExecution=null;
});
