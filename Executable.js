var Executable=Function.extend(Object, function () {
	var _=this(Executable);
	Executable=_[Executable];

	function Executable(name, source, agent) {
		_['base'].apply(this, arguments);
		this.Name=name;
		this.Source=source;
		this.Agent=agent;
		let run=this.Run;
		this.Run=function (...args) {
			return Track(Promise.resolve().then(()=>run.apply(this, args)), `Run ${this.Name}`);
		};
	}

	_['public'].Name=null;
	_['public'].Source=null;
	_['public'].Agent=null;

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
		let task=Promise.resolve(operation).then((value)=>{
			execution?.Changes.push({Operation: description, Value: value instanceof Error?value.message:'completed'});
			return value;
		}, (error)=>{
			let failure=Helper.Error(error);
			execution?.Changes.push({Operation: description, Value: failure.message});
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

	Executable.Load=function (source, agent) {
		return Track((async ()=>{
			if (!(source instanceof Source)||!source.Remote) {
				return Helper.Error('Provide a remote executable source.');
			}

			try {
				let executableClass=await new Resource.Module(source.Name, source.Value, source.ReadyMember);
				return await Executable.Install(source.Name, executableClass, source, agent);
			}
			catch (error) {
				return Helper.Error(error);
			}
		})(), `Load ${source?.Name||'executable'}`);
	};

	Executable.Remove=async function (instance) {
		let error=null;
		try {
			error=await instance.Dispose();
		}
		catch (failure) {
			error=Helper.Error(failure);
		}

		try {
			instance.Agent.Unmount(instance.Name);
		}
		catch (failure) {
			error||=Helper.Error(failure);
		}

		return error instanceof Error?error:null;
	};

	Executable.Install=function (name, executableClass, source, agent) {
		return Track((async ()=>{
			if ('string'!==typeof name||!/^[A-Za-z_$][\w$]*$/.test(name)) {
				return Helper.Error('Provide a valid executable name.');
			}

			if ('function'!==typeof executableClass||!(executableClass.prototype instanceof Executable)) {
				return Helper.Error('Provide a class derived from Executable.');
			}

			let instance;
			try {
				instance=new executableClass(name, source instanceof Source?source:new Source(name, source, undefined, false), agent||Executable.CurrentExecution?.Agent);
			}
			catch (error) {
				return Helper.Error(error);
			}

			if (instance.Name!==name) {
				return Helper.Error('The executable constructor must call its base constructor.');
			}

			let previous=Executable.GetInstance(name);
			if (previous) {
				let error=await Executable.Remove(previous);
				if (error) {
					return error;
				}

				Executable.Instances.splice(Executable.Instances.indexOf(previous), 1);
			}

			Executable.Instances.push(instance);
			let failure=null;
			try {
				let value=await instance.Initialize();
				if (value instanceof Error) {
					failure=value;
				}
			}
			catch (error) {
				failure=Helper.Error(error);
			}

			if (failure) {
				await Executable.Remove(instance);
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

	Executable.Rollback=function () {
		return Track((async ()=>{
			let installation=Executable.Versions.at(-1);
			if (!installation) {
				return Helper.Error('No executable installation is available to undo.');
			}

			let error=await Executable.Remove(installation.Current);
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
					let value=await installation.Previous.Initialize();
					if (value instanceof Error) {
						return value;
					}
				}
				catch (failure) {
					return Helper.Error(failure);
				}
			}

			return installation.Previous||null;
		})(), 'Rollback');
	};

	Executable.Uninstall=function (name) {
		return Track((async ()=>{
			let instance=Executable.GetInstance(name);
			if (!instance) {
				return Helper.Error('Executable is not installed: '+name);
			}

			let error=await Executable.Remove(instance);
			if (error) {
				return error;
			}

			Executable.Instances.splice(Executable.Instances.indexOf(instance), 1);
			Executable.Versions=Executable.Versions.filter((entry)=>entry.Name!==name);
			return null;
		})(), `Uninstall ${name}`);
	};

	Executable.Execute=async function (code, agent) {
		let execution={Code: code, Text: null, Error: null, Changes: [], Pending: [], Agent: agent};
		let previous=Executable.CurrentExecution;
		Executable.Executions.push(execution);
		Executable.CurrentExecution=execution;
		try {
			if ('string'!==typeof code) {
				execution.Error=Helper.Error('Generated response must be a string.');
			}
			else {
				if (/^async function\s*\(/.test(code.trim())) {
					let Run=new Function('Executable', 'return ('+code+');\n//# sourceURL=CustomAgentGenerated.js')(Executable);
					execution.Text=await Run.call(agent);
				}
				else {
					execution.Text=code;
				}
			}
		}
		catch (error) {
			execution.Error=error instanceof Error?error:Helper.Error(error);
		}

		let index=0;
		while (index<execution.Pending.length) {
			let pending=execution.Pending.slice(index);
			index=execution.Pending.length;
			let values=await Promise.all(pending);
			execution.Error||=values.find((value)=>value instanceof Error)||null;
		}

		Executable.CurrentExecution=previous;
		if (execution.Text instanceof Error) {
			execution.Error||=execution.Text;
		}

		if (!execution.Error&&'string'!==typeof execution.Text) {
			execution.Error=Helper.Error('Generated code must return a string.');
		}

		return execution.Error||execution.Text;
	};

	Executable.Instances=[];
	Executable.Versions=[];
	Executable.Executions=[];
	Executable.CurrentExecution=null;
});
