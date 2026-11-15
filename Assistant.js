var Assistant=Function.extend(Object, function () {
	var _=this(Assistant);
	Assistant=_[Assistant];

	function Assistant(app) {
		_['base'].apply(this, arguments);
		let $this=_(this);
		$this.m_app=app;
		$this.m_detach=app.SubscribeMessage((message)=>$this.HandleMessage(message));
		$this.m_detachEvent=app.SubscribeEvent((event, details, image)=>$this.Report(event, details, image));
		$this.m_ready=$this.Welcome();
	}

	_['public'].GenerateText=function (prompt, options) {
		return Flow.generate.text(prompt, options);
	};

	_['public'].Destroy=function () {
		_(this).m_detach?.();
		_(this).m_detachEvent?.();
	};

	_['private'].Welcome=async function () {
		let $this=_(this);
		let app=$this.m_app;
		let setupError='';
		let capabilities={message: ''};
		let runtime={message: ''};
		let source='';
		try {
			await app.Initialize();
		}
		catch (error) { setupError=error.message||String(error); }
		try {
			capabilities=await app.ReadSource({});
			runtime=await app.InspectRuntime({});
			try { source=(await app.ReadSource({file: 'CustomAgent.js', limit: 9000}, app.props.HostSourceUrl)).message; }
			catch (error) { console.warn('Startup source inspection failed:', error); }
		}
		catch (error) { setupError=[setupError,error.message||String(error)].filter(Boolean).join('; '); }
		try {
			let response=await this.GenerateText(`
You are running inside this App. Inspect its actual capabilities before introducing yourself.
${capabilities.message}
${runtime.message}
${source}
Startup result: ${setupError||'success'}
Interface locale: ${navigator.language}. Briefly greet the user in the language appropriate for the interface or conversation. Describe only capabilities verified above. If startup failed, explain the actual failure.
`, {
				systemInstruction: `
You are the assistant inside this App. Reply to the user naturally in the appropriate language. Do not claim an action occurred unless the App reported it.
`
			});
			if (response.text?.trim()&&!app.GetState().messages.length) app.Reply(response.text.trim());
		}
		catch (error) {
			app.ReportError(error);
		}
	};

	_['private'].ReadControl=function (value) {
		let marker=String.fromCharCode(96).repeat(3);
		let pattern=new RegExp(`${marker}json\\s*([\\s\\S]*?)\\s*${marker}`, 'gi');
		for (let block of [...String(value).matchAll(pattern)].reverse()) {
			try {
				let data=JSON.parse(block[1]);
				if (!data||!Object.prototype.hasOwnProperty.call(data, 'localAction')) continue;
				return {Data: data, Text: (value.slice(0, block.index)+value.slice(block.index+block[0].length)).trim()};
			}
			catch (error) { console.warn('Invalid conversation control', error); }
		}
		try {
			let data=JSON.parse(String(value).trim());
			if (data&&Object.prototype.hasOwnProperty.call(data, 'localAction')) return {Data: data, Text: ''};
		}
		catch (error) { /* A normal answer need not be JSON. */ }
		return {Data: null, Text: String(value).trim()};
	};

	_['private'].RepairControl=async function (question, response, runtime, images) {
		let options={systemInstruction: `
You are deciding whether the user's current request requires an App operation. The App can perform local actions; do not conclude that an action is unavailable merely because the previous answer did not request it. Available capabilities: ${runtime.message}
Return exactly one JSON object with keys attemptPlan and localAction. If the user asks the App to inspect, modify, install, run, or verify something, choose the first necessary action and include it in attemptPlan. If the user only asks for an explanation or discussion, set localAction to null and attemptPlan to []. For an action use {"attemptPlan":[{"action":"actionName","attempts":1,"reason":"purpose"}],"localAction":{"name":"actionName","arguments":{}}}. Do not claim an action ran. Do not answer the user here.
`};
		if (images) options.images=images;
		let decision=await this.GenerateText(`
${question}
Previous answer without a valid action decision:
${response}
Decide whether the App needs to act now. Return JSON only.
`, options);
		return this.ReadControl(decision.text);
	};

	_['private'].RecoverIfRequested=async function (message) {
		let app=this.m_app;
		if (!app.HasVersion()) return false;
		if (/^\s*\/(?:rollback|undo)\s*$/i.test(message)) {
			await this.Report('The App restored the previous runtime code version.', {Result: app.Rollback()});
			return true;
		}
		let response=await this.GenerateText(`
${message}
`, {
			systemInstruction: `
Classify whether the user asks to undo a recent runtime code change or says the latest change is broken and should be undone. Answer exactly ROLLBACK or CONTINUE. A question about an error or a request for a new fix is CONTINUE.
`
		});
		if (!/^ROLLBACK\b/i.test(response.text.trim())) return false;
		await this.Report('The App restored the previous runtime code version.', {Result: app.Rollback()});
		return true;
	};

	_['private'].HandleMessage=async function (message) {
		let $this=_(this);
		await $this.m_ready;
		if (await $this.RecoverIfRequested(message)) return;
		let app=$this.m_app;
		let initial=app.GetState();
		let imageInfo=await app.GetImageInfo();
		let prior=initial.messages.slice();
		if (prior.at(-1)?.sender==='user'&&prior.at(-1)?.text===message) prior.pop();
		let history=prior.slice(-20).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n\n');
		let changes=initial.accumulatedChanges.length?initial.accumulatedChanges.map((entry, index)=>`${index+1}. ${entry}`).join('\n'):'(none)';
		let question=()=>`
Current image: ${imageInfo?`${imageInfo.width} × ${imageInfo.height} pixels (${imageInfo.mimeType})`:'none'}
Selected generation aspect ratio: ${initial.selectedRatio}
Pending generation changes:
${changes}
Previous conversation (up to 20 messages):
${history}
Current user message:
${message}
`;
		let image=initial.activeImage;
		let changesOut=initial.accumulatedChanges;
		let promptOut=initial.generationPrompt;
		let ratioOut=initial.selectedRatio;
		let edited=null;
		let plan=[];
		let reports=[];
		let answer='';
		let structured=false;
		let runtime=await app.InspectRuntime({});
		for (;;) {
			let request=reports.length?`
${question()}
Current action plan: ${JSON.stringify(plan)}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Choose the next action, revise the plan, or give a final answer. Do not repeat successful actions or claim failed actions succeeded.
`:question();
			let options={systemInstruction: `
You are the assistant running in this App. Actual capabilities: ${runtime.message}
You may discuss freely. Only the user's Generate button starts image generation. To request a local operation, append one final fenced json block with {"attemptPlan":[{"action":"name","attempts":1,"reason":"reason"}],"localAction":{"name":"name","arguments":{}}}. If no operation is needed use {"localAction":null}. The App executes one action and returns its actual result; decide what to do next after reading it. readAppSource with empty arguments lists files; use it to inspect implementation whenever needed. loadModule accepts {name,specifier} for an external classic script or {name,code} for new JavaScript. In either case the script declares exactly one top-level var with that name whose value is a Function.extend(Extensible, ...) class; its constructor receives AppRuntime and registers functions or mounts UI. Do not use import, export, or explicit globalThis assignment in this class. Use a new class name for each update; it may replace an existing runtime function. AppRuntime.UI is this App. An extension can use standard browser Image and canvas APIs to edit the image as DrawRectangle.js does, return {image:{base64,mimeType}}, or mount controls through AppRuntime.UI.Mount. If a requested function is absent, inspect relevant source and implement an extension when requested; absence of a built-in action does not mean it cannot be done. Only report an operation as completed after its successful App result, including actual output dimensions. Local operations that completed are not pending image generation changes. Optional JSON fields: accumulatedChanges, suggestedPrompt, aspectRatio. Answer naturally in the user's language. Never claim unreported success or show control JSON unless asked.
`};
			if (image) options.images=[{base64: image.base64, mimeType: image.mimeType}];
			let response=await this.GenerateText(request, options);
			let control=$this.ReadControl(response.text);
			if (!control.Data) {
				let repaired=await $this.RepairControl(request, response.text, runtime, options.images);
				if (!repaired.Data) throw new Error('The model did not return a valid local action decision. No App operation was executed.');
				if (repaired.Data.localAction) control=repaired;
			}
			answer=control.Text;
			let data=control.Data;
			if (data) {
				structured=true;
				if (Array.isArray(data.accumulatedChanges)) changesOut=data.accumulatedChanges.filter((item)=>typeof item==='string');
				if (typeof data.suggestedPrompt==='string') promptOut=data.suggestedPrompt;
				if (['original', '1:1', '16:9', '9:16', '4:3', '3:4'].includes(data.aspectRatio)) ratioOut=data.aspectRatio;
				if (Array.isArray(data.attemptPlan)&&data.attemptPlan.length) plan=data.attemptPlan;
			}
			let action=data?.localAction;
			if (!action||typeof action.name!=='string') break;
			if (!plan.some((entry)=>entry.action===action.name)) {
				reports.push({action: action.name, status: 'error', result: 'The action needs an attemptPlan entry before execution.'});
				continue;
			}
			try {
				let result=await app.RunAction(action);
				if (result.conversationReset) {
					let fresh=await this.GenerateText(`
The App has cleared the conversation. Greet the user naturally in the language of their request. Do not refer to earlier conversation.
`, {systemInstruction: `
Reply naturally to the user. Do not output control JSON.
`});
					if (!fresh.text?.trim()) throw new Error('The model returned an empty answer.');
					app.Reply(fresh.text.trim());
					return;
				}
				if (result.image) {
					image=result.image;
					imageInfo={width: image.width, height: image.height, mimeType: image.mimeType};
					edited=result.image;
				}
				reports.push({action: action.name, status: 'success', result: result.message, ...(result.image?{image: {width: result.image.width, height: result.image.height, mimeType: result.image.mimeType}}:{})});
				runtime=await app.InspectRuntime({});
			}
			catch (error) {
				reports.push({action: action.name, status: 'error', result: error instanceof Error?error.message:String(error)});
			}
		}
		if (reports.length||!answer) {
			let response=await this.GenerateText(`
${question()}
Actual action results:
${reports.map(JSON.stringify).join('\n')}
Give the user your final answer based on these results, without requesting another action or outputting control JSON.
`, {systemInstruction: `
Answer in the user's language. State only actions confirmed successful by the App and explain failures accurately.
`});
			answer=response.text?.trim();
		}
		if (!answer) throw new Error('The model returned an empty answer.');
		if (structured) app.UpdateConversation({accumulatedChanges: changesOut, generationPrompt: changesOut.length?promptOut:'', selectedRatio: ratioOut});
		app.Reply(answer, {
			accumulatedChanges: changesOut
			, suggestedPrompt: promptOut||undefined
			, aspectRatio: ratioOut
			, ...(edited?{includedImage: {base64: edited.base64, mimeType: edited.mimeType}}:{})
		});
	};

	_['private'].Report=async function (event, details={}, image) {
		await _(this).m_ready;
		let messages=_(this).m_app.GetState().messages.slice(-8).map((entry)=>`${entry.sender}: ${entry.text}`).join('\n');
		let response=await this.GenerateText(`
Recent conversation:
${messages}
App event: ${event}
Actual result: ${JSON.stringify(details)}
Reply briefly to the user in the language of the current conversation.
`, {systemInstruction: `
Describe only the actual App result. Do not claim unreported actions. Do not output control JSON.
`});
		if (!response.text?.trim()) throw new Error('The model returned an empty answer.');
		_(this).m_app.Reply(response.text.trim(), image?{includedImage: image}:{});
	};

	_['private'].m_app=null;
	_['private'].m_detach=null;
	_['private'].m_detachEvent=null;
	_['private'].m_ready=null;
});
